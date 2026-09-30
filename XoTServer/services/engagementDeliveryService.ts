import { instantToDay } from '@workspace/shared';
import type { PoolClient } from 'pg';
import { getClient, getSystemClient } from '../db/poolManager.js';
import { log } from '../config/logging.js';
import { decrypt, ENCRYPTION_KEY } from '../security/encryption.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import { getEngagementSettings } from './engagementService.js';
import {
  dueEngagementCandidates,
  mayReserveEngagementCandidate,
  type ReminderCandidate,
  type ReminderKind,
} from './engagementPolicy.js';

type PushTicket = {
  status: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
};

type PushReceipt = { status: 'ok' | 'error'; details?: { error?: string } };

const PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const MESSAGE: Record<ReminderKind, { en: string; de: string }> = {
  hydration: {
    en: 'No drink is logged yet today. Add one if you have had some.',
    de: 'Heute ist noch kein Getränk erfasst. Trage eines ein, falls du etwas getrunken hast.',
  },
  meal_capture: {
    en: 'No food is logged yet today. Add a meal when you are ready.',
    de: 'Heute ist noch kein Essen erfasst. Trage eine Mahlzeit ein, wenn du möchtest.',
  },
  meal_review: {
    en: 'A food photo is waiting for review.',
    de: 'Ein Essensfoto wartet auf deine Prüfung.',
  },
  movement_break: {
    en: 'A short movement break is available when it fits your day.',
    de: 'Eine kurze Bewegungspause passt vielleicht in deinen Tag.',
  },
  mobility: {
    en: 'Your mobility session is ready when you are.',
    de: 'Deine Mobilitätseinheit ist bereit, wenn du Zeit hast.',
  },
};

async function fetchExpo(url: string, body: unknown): Promise<Response> {
  const accessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
}

async function reserveForUser(
  userId: string,
  candidate: ReminderCandidate
): Promise<void> {
  const client: PoolClient = await getClient(userId, userId);
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`engagement:${userId}:${candidate.localDay}`]
    );
    const existing = await client.query(
      `SELECT scheduled_at, status FROM engagement_occurrences
       WHERE user_id = $1 AND local_day = $2`,
      [userId, candidate.localDay]
    );
    if (
      mayReserveEngagementCandidate(
        candidate,
        (existing.rows as Array<{ scheduled_at: Date; status: string }>).map(
          (row) => ({ scheduledAt: row.scheduled_at, status: row.status })
        )
      )
    ) {
      await client.query(
        `INSERT INTO engagement_occurrences
           (user_id, kind, local_day, scheduled_at, delivery_owner)
         VALUES ($1, $2, $3, $4, 'remote')
         ON CONFLICT (user_id, kind, local_day, scheduled_at) DO NOTHING`,
        [userId, candidate.kind, candidate.localDay, candidate.scheduledAt]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Reads a bounded set of opted-in accounts; every diary lookup stays user-scoped. */
export async function planEngagementOccurrences(
  now = new Date()
): Promise<void> {
  let lastUserId: string | null = null;
  for (;;) {
    const systemClient: PoolClient = await getSystemClient();
    let userIds: string[];
    try {
      const result = await systemClient.query(
        `SELECT s.user_id FROM engagement_settings s
         WHERE ($1::uuid IS NULL OR s.user_id > $1::uuid)
           AND s.remote_enabled = TRUE AND EXISTS (
           SELECT 1 FROM engagement_devices d
           WHERE d.user_id = s.user_id AND d.enabled = TRUE
         ) ORDER BY s.user_id LIMIT 250`,
        [lastUserId]
      );
      userIds = result.rows.map((row: { user_id: string }) => row.user_id);
    } finally {
      systemClient.release();
    }
    if (userIds.length === 0) break;
    for (const userId of userIds) {
      try {
        const [timezone, settings] = await Promise.all([
          loadUserTimezone(userId),
          getEngagementSettings(userId),
        ]);
        const localDay = instantToDay(now, timezone);
        const client: PoolClient = await getClient(userId, userId);
        let context: {
          foodCount: number;
          waterCount: number;
          exerciseCount: number;
          pendingPhotoCount: number;
          remindersPaused: boolean;
        };
        try {
          const result = await client.query(
            `SELECT
            (SELECT COUNT(*) FROM food_entries WHERE user_id = $1 AND entry_date = $2) AS food_count,
            (SELECT COUNT(*) FROM water_intake_entries WHERE user_id = $1 AND entry_date = $2) AS water_count,
            (SELECT COUNT(*) FROM exercise_entries WHERE user_id = $1 AND entry_date = $2) AS exercise_count,
            (SELECT COUNT(*) FROM nutrition_captures WHERE user_id = $1 AND entry_date = $2
              AND completion_state = 'incomplete') AS pending_photo_count,
            EXISTS (SELECT 1 FROM health_context_periods WHERE user_id = $1
              AND pause_discretionary_reminders AND start_date <= $2
              AND (end_date IS NULL OR end_date >= $2)) AS reminders_paused`,
            [userId, localDay]
          );
          const row = result.rows[0];
          context = {
            foodCount: Number(row.food_count),
            waterCount: Number(row.water_count),
            exerciseCount: Number(row.exercise_count),
            pendingPhotoCount: Number(row.pending_photo_count),
            remindersPaused: row.reminders_paused === true,
          };
        } finally {
          client.release();
        }
        for (const candidate of dueEngagementCandidates({
          now,
          timezone,
          settings,
          context,
        })) {
          await reserveForUser(userId, candidate);
        }
      } catch (error) {
        log(
          'warn',
          '[Engagement] Could not plan reminders for an account',
          error
        );
      }
    }
    lastUserId = userIds[userIds.length - 1];
  }
}

interface ClaimedOccurrence {
  id: string;
  userId: string;
  kind: ReminderKind;
  language: 'en' | 'de';
  devices: Array<{
    installationId: string;
    ciphertext: string;
    iv: string;
    tag: string;
  }>;
}

/** Claims before the network call. An uncertain send is not retried, avoiding duplicate alerts. */
async function claimNextOccurrence(): Promise<ClaimedOccurrence | null> {
  const client: PoolClient = await getSystemClient();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT o.id, o.user_id, o.kind, p.language
       FROM engagement_occurrences o
       JOIN engagement_settings s ON s.user_id = o.user_id AND s.remote_enabled
       LEFT JOIN user_preferences p ON p.user_id = o.user_id
       WHERE o.status = 'pending' AND o.delivery_owner = 'remote'
         AND o.scheduled_at <= NOW() AND o.scheduled_at >= NOW() - INTERVAL '30 minutes'
       ORDER BY o.scheduled_at, o.id
       FOR UPDATE OF o SKIP LOCKED LIMIT 1`
    );
    const row = result.rows[0] as
      | {
          id: string;
          user_id: string;
          kind: ReminderKind;
          language: string | null;
        }
      | undefined;
    if (!row) {
      await client.query('COMMIT');
      return null;
    }
    const devices = await client.query(
      `SELECT installation_id, token_ciphertext, token_iv, token_tag
       FROM engagement_devices WHERE user_id = $1 AND enabled = TRUE`,
      [row.user_id]
    );
    await client.query(
      `UPDATE engagement_occurrences SET status = 'sending',
         lease_until = NOW() + INTERVAL '2 minutes', attempt_count = attempt_count + 1
       WHERE id = $1`,
      [row.id]
    );
    for (const device of devices.rows as Array<{ installation_id: string }>) {
      await client.query(
        `INSERT INTO engagement_deliveries (occurrence_id, user_id, installation_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [row.id, row.user_id, device.installation_id]
      );
    }
    await client.query('COMMIT');
    return {
      id: row.id,
      userId: row.user_id,
      kind: row.kind,
      language: row.language?.startsWith('de') ? 'de' : 'en',
      devices: devices.rows.map(
        (device: {
          installation_id: string;
          token_ciphertext: string;
          token_iv: string;
          token_tag: string;
        }) => ({
          installationId: device.installation_id,
          ciphertext: device.token_ciphertext,
          iv: device.token_iv,
          tag: device.token_tag,
        })
      ),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deliverEngagementOccurrences(): Promise<void> {
  for (let i = 0; i < 25; i += 1) {
    const occurrence = await claimNextOccurrence();
    if (!occurrence) break;
    for (const device of occurrence.devices) {
      let ticket: PushTicket | undefined;
      try {
        const token = await decrypt(
          device.ciphertext,
          device.iv,
          device.tag,
          ENCRYPTION_KEY
        );
        if (typeof token !== 'string')
          throw new Error('Invalid token ciphertext.');
        const response = await fetchExpo(PUSH_SEND_URL, {
          to: token,
          title: 'X on Track',
          body: MESSAGE[occurrence.kind][occurrence.language],
          categoryId: 'engagement-remote',
          data: {
            remoteEngagementVersion: 1,
            occurrenceId: occurrence.id,
            kind: occurrence.kind,
            userId: occurrence.userId,
            installationId: device.installationId,
          },
          sound: 'default',
        });
        if (!response.ok) throw new Error(`Expo push HTTP ${response.status}`);
        const envelope = (await response.json()) as { data?: PushTicket };
        ticket = envelope.data;
      } catch (error) {
        log('warn', '[Engagement] Push send failed', error);
      }
      const client: PoolClient = await getSystemClient();
      try {
        await client.query(
          `UPDATE engagement_deliveries SET status = $3, ticket_id = $4,
             error_code = $5, checked_at = CASE WHEN $3 = 'failed' THEN NOW() ELSE NULL END
           WHERE occurrence_id = $1 AND installation_id = $2`,
          [
            occurrence.id,
            device.installationId,
            ticket?.status === 'ok' && ticket.id ? 'accepted' : 'failed',
            ticket?.id ?? null,
            ticket?.details?.error ?? (ticket ? 'PushRejected' : 'SendUnknown'),
          ]
        );
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          await client.query(
            `UPDATE engagement_devices SET enabled = FALSE
             WHERE user_id = $1 AND installation_id = $2`,
            [occurrence.userId, device.installationId]
          );
        }
      } finally {
        client.release();
      }
    }
    const client: PoolClient = await getSystemClient();
    try {
      await client.query(
        `UPDATE engagement_occurrences SET status = CASE WHEN EXISTS (
           SELECT 1 FROM engagement_deliveries d
           WHERE d.occurrence_id = $1 AND d.status = 'accepted'
         ) THEN 'sent' ELSE 'failed' END,
         sent_at = NOW(), lease_until = NULL WHERE id = $1`,
        [occurrence.id]
      );
    } finally {
      client.release();
    }
  }
  const client: PoolClient = await getSystemClient();
  try {
    // Do not replay an uncertain send: Expo has no operation-idempotency key.
    await client.query(
      `UPDATE engagement_occurrences SET status = 'failed', lease_until = NULL
       WHERE status = 'sending' AND lease_until < NOW()`
    );
  } finally {
    client.release();
  }
}

export async function reconcileEngagementPushReceipts(): Promise<void> {
  const client: PoolClient = await getSystemClient();
  let rows: Array<{
    ticket_id: string;
    occurrence_id: string;
    installation_id: string;
    user_id: string;
  }>;
  try {
    const result = await client.query(
      `SELECT ticket_id, occurrence_id, installation_id, user_id
       FROM engagement_deliveries
       WHERE status = 'accepted' AND ticket_id IS NOT NULL
         AND claimed_at <= NOW() - INTERVAL '15 minutes'
       ORDER BY claimed_at LIMIT 100`
    );
    rows = result.rows;
  } finally {
    client.release();
  }
  if (rows.length === 0) return;
  const response = await fetchExpo(PUSH_RECEIPTS_URL, {
    ids: rows.map((row) => row.ticket_id),
  });
  if (!response.ok) throw new Error(`Expo receipts HTTP ${response.status}`);
  const envelope = (await response.json()) as {
    data?: Record<string, PushReceipt>;
  };
  for (const row of rows) {
    const receipt = envelope.data?.[row.ticket_id];
    if (!receipt) continue;
    const updateClient: PoolClient = await getSystemClient();
    try {
      await updateClient.query(
        `UPDATE engagement_deliveries SET status = $3, error_code = $4,
           checked_at = NOW() WHERE occurrence_id = $1 AND installation_id = $2`,
        [
          row.occurrence_id,
          row.installation_id,
          receipt.status === 'ok' ? 'delivered' : 'failed',
          receipt.details?.error ?? null,
        ]
      );
      if (receipt.details?.error === 'DeviceNotRegistered') {
        await updateClient.query(
          `UPDATE engagement_devices SET enabled = FALSE
           WHERE user_id = $1 AND installation_id = $2`,
          [row.user_id, row.installation_id]
        );
      }
    } finally {
      updateClient.release();
    }
  }
}
