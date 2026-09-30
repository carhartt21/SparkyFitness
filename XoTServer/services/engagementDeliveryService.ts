import {
  selectOptionalReminderSlots,
  engagementQuietAt,
  type EngagementReminderKindV2,
} from '@workspace/shared';
import {
  engagementPlanForUser,
  sameEngagementSlot,
  occurrenceEligible,
} from './engagementPlanningService.js';
import type { PoolClient } from 'pg';
import { getClient, getSystemClient } from '../db/poolManager.js';
import { log } from '../config/logging.js';
import { decrypt, ENCRYPTION_KEY } from '../security/encryption.js';
type ReminderKind = EngagementReminderKindV2;

type PushTicket = {
  status: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
};

type PushReceipt = { status: 'ok' | 'error'; details?: { error?: string } };

const PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const MESSAGE: Record<ReminderKind, { en: string; de: string }> = {
  check_in: {
    en: 'Your daily check-in is still open.',
    de: 'Ihr täglicher Check-in ist noch offen.',
  },
  habit: {
    en: 'A scheduled habit is not recorded yet.',
    de: 'Eine geplante Gewohnheit ist noch nicht erfasst.',
  },
  weigh_in: {
    en: 'Your scheduled weigh-in is still open.',
    de: 'Ihre geplante Gewichtserfassung ist noch offen.',
  },
  hydration: {
    en: 'Time to log a drink if you have had one.',
    de: 'Zeit, ein Getränk zu erfassen, falls Sie etwas getrunken haben.',
  },
  meal_capture: {
    en: 'No meal is captured in the selected time window.',
    de: 'Für das gewählte Zeitfenster ist noch keine Mahlzeit erfasst.',
  },
  meal_review: {
    en: 'A food photo is waiting for review.',
    de: 'Ein Essensfoto wartet auf Prüfung.',
  },
  movement_break: {
    en: 'A short movement break is available when it fits your day.',
    de: 'Eine kurze Bewegungspause steht bereit, wenn es gerade passt.',
  },
  mobility: {
    en: 'Your mobility session is ready when you are.',
    de: 'Ihre geplante Mobilitätseinheit steht bereit.',
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

/** One account lock reserves logical occurrences, not receiving-device copies. */
async function reserveForUser(userId: string, now: Date): Promise<void> {
  const plan = await engagementPlanForUser(userId, now);
  if (!plan.settings.remote_enabled) return;
  const client: PoolClient = await getClient(userId, userId);
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `engagement:${userId}:${plan.day}`,
    ]);
    const existing = await client.query<{
      id: string;
      kind: string;
      subject_id: string;
      scheduled_at: Date;
      status: string;
      settings_revision: number;
      slot_key: string;
      attempt_count: number;
    }>(
      'SELECT id,kind,subject_id,scheduled_at,status,settings_revision,slot_key,attempt_count FROM engagement_occurrences WHERE user_id=$1 AND local_day=$2 FOR UPDATE',
      [userId, plan.day]
    );
    for (const row of existing.rows)
      if (
        row.status === 'pending' &&
        (row.settings_revision !== plan.settings.revision ||
          !occurrenceEligible(plan, row))
      )
        await client.query(
          "UPDATE engagement_occurrences SET status='cancelled' WHERE id=$1",
          [row.id]
        );
    const spent = existing.rows.filter((row) => row.attempt_count > 0);
    const snoozes = existing.rows.filter(
      (row) =>
        row.status === 'pending' &&
        row.slot_key.includes(':snooze:') &&
        occurrenceEligible(plan, row)
    );
    const occupied = [...spent, ...snoozes].map((row) =>
      row.scheduled_at.getTime()
    );
    const available = plan.candidates.filter(
      (slot) =>
        !existing.rows.some(
          (row) =>
            sameEngagementSlot(slot, row) &&
            !['pending', 'cancelled'].includes(row.status)
        )
    );
    const remaining =
      plan.settings.daily_limit === null
        ? null
        : Math.max(
            0,
            plan.settings.daily_limit - spent.length - snoozes.length
          );
    const common = {
      now: now.getTime(),
      timezone: plan.timezone,
      quietStart: plan.settings.quiet_start,
      quietEnd: plan.settings.quiet_end,
    };
    const explicit = selectOptionalReminderSlots({
      ...common,
      candidates: available.filter((slot) => slot.kind !== 'hydration'),
      dailyLimit: remaining,
      occupied,
    });
    const water = selectOptionalReminderSlots({
      ...common,
      candidates: available.filter((slot) => slot.kind === 'hydration'),
      dailyLimit:
        remaining === null ? null : Math.max(0, remaining - explicit.length),
      occupied: [...occupied, ...explicit.map((slot) => slot.preferredAt)],
    });
    const selected = [...explicit, ...water];
    for (const row of existing.rows)
      if (
        row.status === 'pending' &&
        !snoozes.some((item) => item.id === row.id) &&
        !selected.some((slot) => sameEngagementSlot(slot, row))
      )
        await client.query(
          "UPDATE engagement_occurrences SET status='cancelled' WHERE id=$1",
          [row.id]
        );
    for (const slot of selected)
      await client.query(
        `INSERT INTO engagement_occurrences(user_id,kind,subject_id,local_day,scheduled_at,settings_revision,slot_key,delivery_owner)
      VALUES($1,$2,$3,$4,$5,$6,$7,'remote') ON CONFLICT(user_id,slot_key)
      DO UPDATE SET status='pending',settings_revision=EXCLUDED.settings_revision WHERE engagement_occurrences.status='cancelled' AND engagement_occurrences.attempt_count=0`,
        [
          userId,
          slot.kind,
          slot.subjectId,
          slot.localDay,
          new Date(slot.preferredAt),
          plan.settings.revision,
          slot.id,
        ]
      );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function planEngagementOccurrences(
  now = new Date()
): Promise<void> {
  let last: string | null = null;
  for (;;) {
    const client: PoolClient = await getSystemClient();
    let ids: string[];
    try {
      const result = await client.query<{ user_id: string }>(
        `SELECT user_id FROM engagement_settings s WHERE remote_enabled AND ($1::uuid IS NULL OR user_id>$1::uuid)
      AND EXISTS(SELECT 1 FROM engagement_devices d WHERE d.user_id=s.user_id AND enabled AND delivery_owner='remote') ORDER BY user_id LIMIT 250`,
        [last]
      );
      ids = result.rows.map((row) => row.user_id);
    } finally {
      client.release();
    }
    if (!ids.length) break;
    for (const userId of ids)
      try {
        await reserveForUser(userId, now);
      } catch (error) {
        log('warn', '[Engagement] Planning data unavailable', error);
      }
    last = ids[ids.length - 1];
  }
}

interface ClaimedOccurrence {
  id: string;
  userId: string;
  kind: ReminderKind;
  language: 'en' | 'de';
  subjectId: string;
  scheduledAt: Date;
  settingsRevision: number;
  slotKey: string;
  devices: Array<{
    installationId: string;
    protocolVersion: number;
    language: 'en' | 'de';
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
      `SELECT o.id, o.user_id, o.kind, o.subject_id, o.scheduled_at, o.settings_revision, o.slot_key, p.language
       FROM engagement_occurrences o
       JOIN engagement_settings s ON s.user_id = o.user_id AND s.remote_enabled AND s.revision=o.settings_revision
       LEFT JOIN user_preferences p ON p.user_id = o.user_id
       WHERE o.status = 'pending' AND o.delivery_owner = 'remote'
         AND EXISTS (SELECT 1 FROM engagement_devices d WHERE d.user_id=o.user_id AND d.enabled AND d.delivery_owner='remote' AND d.reminder_kinds ? o.kind)
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
          subject_id: string;
          scheduled_at: Date;
          settings_revision: number;
          slot_key: string;
        }
      | undefined;
    if (!row) {
      await client.query('COMMIT');
      return null;
    }
    const devices = await client.query(
      `SELECT installation_id, token_ciphertext, token_iv, token_tag,protocol_version,language
       FROM engagement_devices WHERE user_id = $1 AND enabled = TRUE AND delivery_owner='remote' AND reminder_kinds ? $2`,
      [row.user_id, row.kind]
    );
    if (!devices.rows.length) {
      await client.query(
        "UPDATE engagement_occurrences SET status='cancelled' WHERE id=$1",
        [row.id]
      );
      await client.query('COMMIT');
      return null;
    }
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
      subjectId: row.subject_id,
      scheduledAt: row.scheduled_at,
      settingsRevision: row.settings_revision,
      slotKey: row.slot_key,
      language: row.language?.startsWith('de') ? 'de' : 'en',
      devices: devices.rows.map(
        (device: {
          installation_id: string;
          protocol_version: number;
          language: string | null;
          token_ciphertext: string;
          token_iv: string;
          token_tag: string;
        }) => ({
          installationId: device.installation_id,
          protocolVersion: device.protocol_version,
          language: (device.language ?? row.language)?.startsWith('de')
            ? 'de'
            : 'en',
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
    // Re-read completion and schedule state immediately before contacting Expo.
    let eligible: boolean;
    try {
      const plan = await engagementPlanForUser(occurrence.userId);
      eligible =
        plan.settings.remote_enabled &&
        plan.settings.revision === occurrence.settingsRevision &&
        !engagementQuietAt(
          Date.now(),
          plan.timezone,
          plan.settings.quiet_start,
          plan.settings.quiet_end
        ) &&
        occurrenceEligible(plan, {
          kind: occurrence.kind,
          subject_id: occurrence.subjectId,
          scheduled_at: occurrence.scheduledAt,
          slot_key: occurrence.slotKey,
        });
    } catch {
      eligible = false;
    }
    if (!eligible) {
      const client: PoolClient = await getSystemClient();
      try {
        await client.query(
          "UPDATE engagement_occurrences SET status='cancelled',lease_until=NULL WHERE id=$1",
          [occurrence.id]
        );
      } finally {
        client.release();
      }
      continue;
    }
    for (const device of occurrence.devices) {
      const guard: PoolClient = await getSystemClient();
      let enabled: boolean;
      try {
        const check = await guard.query(
          `SELECT 1 FROM engagement_devices d JOIN engagement_settings s ON s.user_id=d.user_id
        WHERE d.user_id=$1 AND d.installation_id=$2 AND d.enabled AND d.delivery_owner='remote' AND d.reminder_kinds ? $3 AND s.remote_enabled AND s.revision=$4`,
          [
            occurrence.userId,
            device.installationId,
            occurrence.kind,
            occurrence.settingsRevision,
          ]
        );
        enabled = check.rows.length > 0;
      } finally {
        guard.release();
      }
      if (!enabled) continue;
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
          body: MESSAGE[occurrence.kind][device.language],
          categoryId: 'engagement-remote',
          data: {
            remoteEngagementVersion: device.protocolVersion,
            subjectId: occurrence.subjectId,
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
