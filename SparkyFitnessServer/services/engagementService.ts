import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type {
  EngagementAction,
  EngagementDevice,
  EngagementSettings,
  EngagementSettingsPatch,
} from '@workspace/shared';
import { instantToDay } from '@workspace/shared';
import { getClient, getSystemClient } from '../db/poolManager.js';
import { encrypt, ENCRYPTION_KEY } from '../security/encryption.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import {
  mayReserveEngagementCandidate,
  nextAllowedEngagementTime,
  type ReminderKind,
} from './engagementPolicy.js';

export class EngagementConflictError extends Error {}
export class EngagementNotFoundError extends Error {}

const DEFAULT_SETTINGS: EngagementSettings = {
  revision: 0,
  remote_enabled: false,
  quiet_start: '22:00',
  quiet_end: '08:00',
  hydration_enabled: false,
  meal_capture_enabled: false,
  meal_review_enabled: false,
  movement_break_enabled: false,
  mobility_enabled: false,
};

const SETTINGS_COLUMNS = [
  'remote_enabled',
  'quiet_start',
  'quiet_end',
  'hydration_enabled',
  'meal_capture_enabled',
  'meal_review_enabled',
  'movement_break_enabled',
  'mobility_enabled',
] as const;

function mapSettings(
  row: Record<string, unknown> | undefined
): EngagementSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    revision: Number(row.revision),
    remote_enabled: row.remote_enabled === true,
    quiet_start: String(row.quiet_start).slice(0, 5),
    quiet_end: String(row.quiet_end).slice(0, 5),
    hydration_enabled: row.hydration_enabled === true,
    meal_capture_enabled: row.meal_capture_enabled === true,
    meal_review_enabled: row.meal_review_enabled === true,
    movement_break_enabled: row.movement_break_enabled === true,
    mobility_enabled: row.mobility_enabled === true,
  };
}

async function withUserClient<T>(
  userId: string,
  task: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client: PoolClient = await getClient(userId, userId);
  try {
    return await task(client);
  } finally {
    client.release();
  }
}

async function appendChange(
  client: PoolClient,
  userId: string,
  domain: string,
  subjectId: string
): Promise<void> {
  await client.query(
    `INSERT INTO engagement_change_events (user_id, domain, subject_id)
     VALUES ($1, $2, $3)`,
    [userId, domain, subjectId]
  );
}

export async function getEngagementSettings(
  userId: string
): Promise<EngagementSettings> {
  return withUserClient(userId, async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM engagement_settings WHERE user_id = $1',
      [userId]
    );
    return mapSettings(rows[0] as Record<string, unknown> | undefined);
  });
}

/** Compare-and-swap updates prevent an old phone state replacing a newer web/MCP edit. */
export async function patchEngagementSettings(
  userId: string,
  patch: EngagementSettingsPatch
): Promise<EngagementSettings> {
  return withUserClient(userId, async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(
        `INSERT INTO engagement_settings (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      const before = await client.query(
        'SELECT * FROM engagement_settings WHERE user_id = $1 FOR UPDATE',
        [userId]
      );
      const current = mapSettings(before.rows[0] as Record<string, unknown>);
      if (current.revision !== patch.expected_revision) {
        throw new EngagementConflictError(
          'Notification settings changed elsewhere.'
        );
      }
      if (!current.remote_enabled && patch.remote_enabled === true) {
        // Only the phone can begin remote ownership: it registers a fresh
        // push token after permission and cancels its local optional alerts.
        // A web/MCP change while the phone is closed must not double-deliver.
        const prepared = await client.query(
          `SELECT 1 FROM engagement_devices
           WHERE user_id = $1 AND enabled = TRUE
             AND last_seen_at > NOW() - INTERVAL '2 minutes' LIMIT 1`,
          [userId]
        );
        if (!prepared.rows[0]) {
          throw new EngagementConflictError(
            'Enable remote reminders from the phone app first.'
          );
        }
      }
      const updated: EngagementSettings = { ...current };
      for (const column of SETTINGS_COLUMNS) {
        const value = patch[column];
        if (value !== undefined) {
          // Assignment is safe: each key is from a fixed, reviewed allowlist.
          Object.assign(updated, { [column]: value });
        }
      }
      updated.revision += 1;
      const values = SETTINGS_COLUMNS.map((column) => updated[column]);
      const setSql = SETTINGS_COLUMNS.map(
        (column, index) => `${column} = $${index + 2}`
      ).join(', ');
      await client.query(
        `UPDATE engagement_settings SET ${setSql}, revision = revision + 1,
         updated_at = NOW() WHERE user_id = $1`,
        [userId, ...values]
      );
      if (!updated.remote_enabled) {
        await client.query(
          `UPDATE engagement_occurrences SET status = 'cancelled'
           WHERE user_id = $1 AND status = 'pending' AND delivery_owner = 'remote'`,
          [userId]
        );
      }
      await appendChange(client, userId, 'notification_settings', userId);
      await client.query('COMMIT');
      return updated;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function upsertEngagementDevice(
  userId: string,
  device: EngagementDevice
): Promise<void> {
  const sealed = await encrypt(device.expo_push_token, ENCRYPTION_KEY);
  if (!sealed.encryptedText || !sealed.iv || !sealed.tag) {
    throw new Error('Could not protect notification token.');
  }
  const tokenHash = createHash('sha256')
    .update(device.expo_push_token)
    .digest('hex');
  // This operation intentionally crosses account RLS boundaries: a push token
  // must have one current recipient even when the previous account is offline.
  const client: PoolClient = await getSystemClient();
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`engagement-device:${tokenHash}`]
    );
    await client.query(
      `UPDATE engagement_devices SET enabled = FALSE
       WHERE token_hash = $1 AND (user_id <> $2 OR installation_id <> $3)
         AND enabled = TRUE`,
      [tokenHash, userId, device.installation_id]
    );
    await client.query(
      `INSERT INTO engagement_devices
        (user_id, installation_id, platform, token_ciphertext, token_iv, token_tag, token_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, installation_id) DO UPDATE SET
         platform = EXCLUDED.platform,
         token_ciphertext = EXCLUDED.token_ciphertext,
         token_iv = EXCLUDED.token_iv,
         token_tag = EXCLUDED.token_tag,
         token_hash = EXCLUDED.token_hash,
         enabled = TRUE, last_seen_at = NOW()`,
      [
        userId,
        device.installation_id,
        device.platform,
        sealed.encryptedText,
        sealed.iv,
        sealed.tag,
        tokenHash,
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

export async function disableEngagementDevice(
  userId: string,
  installationId: string
): Promise<void> {
  await withUserClient(userId, async (client) => {
    await client.query(
      `UPDATE engagement_devices SET enabled = FALSE
       WHERE user_id = $1 AND installation_id = $2`,
      [userId, installationId]
    );
  });
}

export async function getEngagementChanges(
  userId: string,
  after: number
): Promise<
  Array<{
    sequence: number;
    domain: string;
    subject_id: string;
    created_at: Date;
  }>
> {
  return withUserClient(userId, async (client) => {
    const { rows } = await client.query(
      `SELECT sequence, domain, subject_id, created_at
       FROM engagement_change_events
       WHERE user_id = $1 AND sequence > $2 ORDER BY sequence LIMIT 100`,
      [userId, after]
    );
    return rows.map((row: Record<string, unknown>) => ({
      sequence: Number(row.sequence),
      domain: String(row.domain),
      subject_id: String(row.subject_id),
      created_at: row.created_at as Date,
    }));
  });
}

/** A retried action returns its original result; changing the same ID is a conflict. */
export async function applyEngagementAction(
  userId: string,
  action: EngagementAction
): Promise<{
  occurrence_id: string;
  status: string;
  scheduled_at: string | null;
}> {
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify([
        action.occurrence_id,
        action.action,
        action.snooze_minutes ?? null,
      ])
    )
    .digest('hex');
  const timezone = await loadUserTimezone(userId);
  return withUserClient(userId, async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`engagement-action:${userId}:${action.operation_id}`]
      );
      const previous = await client.query(
        `SELECT request_fingerprint, result FROM engagement_action_receipts
         WHERE user_id = $1 AND operation_id = $2`,
        [userId, action.operation_id]
      );
      if (previous.rows[0]) {
        if (previous.rows[0].request_fingerprint !== fingerprint)
          throw new EngagementConflictError(
            'Operation ID belongs to another action.'
          );
        await client.query('COMMIT');
        return previous.rows[0].result as {
          occurrence_id: string;
          status: string;
          scheduled_at: string | null;
        };
      }
      const current = await client.query(
        `SELECT id, kind, local_day, scheduled_at, status
         FROM engagement_occurrences WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [action.occurrence_id, userId]
      );
      const occurrence = current.rows[0] as
        | {
            id: string;
            kind: string;
            local_day: string;
            scheduled_at: Date;
            status: string;
          }
        | undefined;
      if (!occurrence) throw new EngagementNotFoundError('Reminder not found.');
      if (
        occurrence.status === 'skipped' ||
        occurrence.status === 'cancelled'
      ) {
        throw new EngagementConflictError('Reminder already closed.');
      }
      if (action.action === 'snooze' && !action.snooze_minutes) {
        throw new EngagementConflictError('Snooze duration is required.');
      }
      await client.query(
        "UPDATE engagement_occurrences SET status = 'skipped' WHERE id = $1",
        [occurrence.id]
      );
      let result: {
        occurrence_id: string;
        status: string;
        scheduled_at: string | null;
      } = {
        occurrence_id: occurrence.id,
        status: 'skipped',
        scheduled_at: null,
      };
      if (action.action === 'snooze') {
        const settingRow = await client.query(
          'SELECT * FROM engagement_settings WHERE user_id = $1 FOR UPDATE',
          [userId]
        );
        const settings = mapSettings(settingRow.rows[0]);
        if (settings.remote_enabled) {
          const at = nextAllowedEngagementTime(
            new Date(Date.now() + (action.snooze_minutes ?? 0) * 60_000),
            timezone,
            settings
          );
          const localDay = instantToDay(at, timezone);
          const existing = await client.query(
            `SELECT scheduled_at, status FROM engagement_occurrences
             WHERE user_id = $1 AND local_day = $2`,
            [userId, localDay]
          );
          const candidate = {
            kind: occurrence.kind as ReminderKind,
            localDay,
            scheduledAt: at,
          };
          if (
            mayReserveEngagementCandidate(
              candidate,
              existing.rows.map(
                (row: { scheduled_at: Date; status: string }) => ({
                  scheduledAt: row.scheduled_at,
                  status: row.status,
                })
              )
            )
          ) {
            const inserted = await client.query(
              `INSERT INTO engagement_occurrences
                 (user_id, kind, local_day, scheduled_at, delivery_owner)
               VALUES ($1, $2, $3, $4, 'remote')
               ON CONFLICT (user_id, kind, local_day, scheduled_at) DO NOTHING
               RETURNING id`,
              [userId, occurrence.kind, localDay, at]
            );
            if (inserted.rows[0])
              result = {
                occurrence_id: String(inserted.rows[0].id),
                status: 'pending',
                scheduled_at: at.toISOString(),
              };
          }
        }
      }
      await client.query(
        `INSERT INTO engagement_action_receipts
          (user_id, operation_id, occurrence_id, request_fingerprint, result)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          userId,
          action.operation_id,
          occurrence.id,
          fingerprint,
          JSON.stringify(result),
        ]
      );
      await appendChange(client, userId, 'notification_action', occurrence.id);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
