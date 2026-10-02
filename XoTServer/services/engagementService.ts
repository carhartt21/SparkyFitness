import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type {
  EngagementAction,
  EngagementDevice,
  EngagementSettings,
  EngagementSettingsPatch,
  EngagementSettingsV2,
  EngagementSettingsPatchV2,
  EngagementDeviceV2,
  EngagementDeviceV3,
  EngagementStatusV3,
} from '@workspace/shared';
import { engagementSettingsV2Schema, instantToDay } from '@workspace/shared';
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
  task: (client: PoolClient) => Promise<T>,
  transactionClient?: PoolClient
): Promise<T> {
  const client: PoolClient =
    transactionClient ?? (await getClient(userId, userId));
  try {
    return await task(client);
  } finally {
    if (!transactionClient) client.release();
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
  patch: EngagementSettingsPatch | EngagementSettingsPatchV2,
  transactionClient?: PoolClient
): Promise<EngagementSettings> {
  return withUserClient(
    userId,
    async (client) => {
      if (!transactionClient) await client.query('BEGIN');
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
        const extended = mapSettingsV2(before.rows[0]);
        const config = Object.fromEntries(
          SCHEDULE_COLUMNS.map((column) => [
            column,
            column in patch
              ? (patch[column as keyof typeof patch] ?? extended[column])
              : extended[column],
          ])
        );
        const dailyLimit =
          'daily_limit' in patch && patch.daily_limit !== undefined
            ? patch.daily_limit
            : extended.daily_limit;
        const merged = engagementSettingsV2Schema.parse({
          ...extended,
          ...updated,
          ...config,
          daily_limit: dailyLimit,
        });
        if (
          merged.hydration_start >= merged.hydration_end ||
          merged.meal_capture_start >= merged.meal_capture_end ||
          merged.meal_capture_time < merged.meal_capture_start ||
          merged.meal_capture_time >= merged.meal_capture_end
        ) {
          throw new EngagementConflictError(
            'Reminder time must be inside its window; windows cannot cross midnight.'
          );
        }
        const values = SETTINGS_COLUMNS.map((column) => updated[column]);
        const setSql = SETTINGS_COLUMNS.map(
          (column, index) => `${column} = $${index + 2}`
        ).join(', ');
        await client.query(
          `UPDATE engagement_settings SET ${setSql}, revision = revision + 1,
         updated_at = NOW() WHERE user_id = $1`,
          [userId, ...values]
        );
        await client.query(
          'UPDATE engagement_settings SET daily_limit=$2, schedule_config=$3, schedule_initialized=schedule_initialized OR $4 WHERE user_id=$1',
          [
            userId,
            dailyLimit,
            config,
            SCHEDULE_COLUMNS.some((column) => column in patch),
          ]
        );
        // A settings edit invalidates future reservations, never accepted or uncertain sends.
        await client.query(
          "UPDATE engagement_occurrences SET status='cancelled' WHERE user_id=$1 AND status='pending'",
          [userId]
        );
        await appendChange(client, userId, 'notification_settings', userId);
        if (!transactionClient) await client.query('COMMIT');
        return updated;
      } catch (error) {
        if (!transactionClient) await client.query('ROLLBACK');
        throw error;
      }
    },
    transactionClient
  );
}

export async function upsertEngagementDevice(
  userId: string,
  device: EngagementDevice | EngagementDeviceV2 | EngagementDeviceV3
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
    await client.query(
      `UPDATE engagement_devices SET
      protocol_version=CASE WHEN $7 THEN $3 WHEN protocol_version<3 THEN protocol_version ELSE 1 END,
      reminder_kinds=CASE WHEN $7 THEN $4::jsonb WHEN protocol_version<3 THEN reminder_kinds ELSE $4::jsonb END,
      delivery_owner=CASE WHEN $7 THEN $5 ELSE delivery_owner END,
      language=CASE WHEN $7 THEN $6 ELSE language END
      WHERE user_id=$1 AND installation_id=$2`,
      [
        userId,
        device.installation_id,
        'protocol_version' in device ? device.protocol_version : 1,
        JSON.stringify(
          'reminder_kinds' in device
            ? device.reminder_kinds
            : [
                'hydration',
                'meal_capture',
                'meal_review',
                'movement_break',
                'mobility',
              ]
        ),
        'delivery_owner' in device ? device.delivery_owner : 'remote',
        'language' in device ? device.language : null,
        'protocol_version' in device,
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
        `SELECT id, kind, subject_id, slot_key, local_day, scheduled_at, status
         FROM engagement_occurrences WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [action.occurrence_id, userId]
      );
      const occurrence = current.rows[0] as
        | {
            id: string;
            kind: string;
            subject_id: string;
            slot_key: string;
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
      if (action.action === 'snooze' && occurrence.kind === 'coaching_digest') {
        throw new EngagementConflictError(
          'A daily review digest cannot be snoozed. Open the recommendation inbox to review it.'
        );
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
        const settings = mapSettingsV2(settingRow.rows[0]);
        if (settings.remote_enabled) {
          const at = nextAllowedEngagementTime(
            new Date(Date.now() + (action.snooze_minutes ?? 0) * 60_000),
            timezone,
            settings
          );
          const localDay = instantToDay(at, timezone);
          const existing = await client.query(
            `SELECT scheduled_at, CASE WHEN attempt_count>0 THEN 'sent' ELSE status END AS status FROM engagement_occurrences
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
              ),
              settings.daily_limit
            )
          ) {
            const inserted = await client.query(
              `INSERT INTO engagement_occurrences
                 (user_id, kind, local_day, scheduled_at, subject_id,slot_key,settings_revision,delivery_owner)
               VALUES ($1, $2, $3, $4, $5,$6,$7,'remote')
               ON CONFLICT (user_id,slot_key) DO NOTHING
               RETURNING id`,
              [
                userId,
                occurrence.kind,
                localDay,
                at,
                occurrence.subject_id,
                `${occurrence.slot_key}:snooze:${action.operation_id}`,
                settings.revision,
              ]
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

const SCHEDULE_COLUMNS = [
  'hydration_interval_hours',
  'hydration_start',
  'hydration_end',
  'meal_capture_start',
  'meal_capture_end',
  'meal_capture_time',
  'meal_review_time',
  'movement_break_time',
] as const;
const DEFAULT_SCHEDULE = {
  hydration_interval_hours: 2,
  hydration_start: '08:00',
  hydration_end: '22:00',
  meal_capture_start: '12:00',
  meal_capture_end: '14:00',
  meal_capture_time: '13:00',
  meal_review_time: '20:00',
  movement_break_time: '15:00',
};
function mapSettingsV2(
  row: Record<string, unknown> | undefined
): EngagementSettingsV2 {
  return engagementSettingsV2Schema.parse({
    ...mapSettings(row),
    schema_version: 2,
    schedule_initialized: row?.schedule_initialized === true,
    daily_limit: row
      ? row.daily_limit === null
        ? null
        : Number(row.daily_limit ?? 3)
      : 3,
    ...DEFAULT_SCHEDULE,
    ...((row?.schedule_config as Record<string, unknown>) ?? {}),
  });
}
export async function getEngagementSettingsV2(
  userId: string
): Promise<EngagementSettingsV2> {
  return withUserClient(userId, async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM engagement_settings WHERE user_id=$1',
      [userId]
    );
    return mapSettingsV2(rows[0]);
  });
}
export async function getEngagementStatus(
  userId: string
): Promise<EngagementStatusV3> {
  const settings = await getEngagementSettingsV2(userId);
  const timezone = await loadUserTimezone(userId);
  const day = instantToDay(new Date(), timezone);
  return withUserClient(userId, async (client) => {
    const devices = await client.query(
      'SELECT installation_id,enabled,delivery_owner,protocol_version,last_seen_at,reminder_kinds FROM engagement_devices WHERE user_id=$1',
      [userId]
    );
    const occurrences = await client.query(
      `SELECT o.id,o.kind,o.subject_id,o.scheduled_at,o.status,o.delivery_owner,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('installation_id',d.installation_id,'status',d.status,'error_code',d.error_code)) FROM engagement_deliveries d WHERE d.occurrence_id=o.id AND d.user_id=$1),'[]'::jsonb) AS deliveries
      FROM engagement_occurrences o WHERE o.user_id=$1 AND o.scheduled_at >= now()-interval '7 days' ORDER BY o.scheduled_at DESC LIMIT 200`,
      [userId]
    );
    const count = await client.query(
      "SELECT count(*) AS n FROM engagement_occurrences WHERE user_id=$1 AND local_day=$2 AND (status='pending' OR attempt_count>0)",
      [userId, day]
    );
    let diagnostics: EngagementStatusV3['diagnostics'];
    try {
      const { engagementPlanForUser } =
        await import('./engagementPlanningService.js');
      const plan = await engagementPlanForUser(userId);
      const { selectOptionalReminderSlots, engagementQuietAt } =
        await import('@workspace/shared');
      const spentRows = await client.query<{ scheduled_at: Date }>(
        'SELECT scheduled_at FROM engagement_occurrences WHERE user_id=$1 AND local_day=$2 AND attempt_count>0',
        [userId, day]
      );
      const common = {
        now: Date.now(),
        timezone: plan.timezone,
        quietStart: settings.quiet_start,
        quietEnd: settings.quiet_end,
      };
      const remaining =
        settings.daily_limit === null
          ? null
          : Math.max(0, settings.daily_limit - spentRows.rows.length);
      const occupied = spentRows.rows.map((row) => row.scheduled_at.getTime());
      const explicit = selectOptionalReminderSlots({
        ...common,
        candidates: plan.candidates.filter((slot) => slot.kind !== 'hydration'),
        dailyLimit: remaining,
        occupied,
      });
      const water = selectOptionalReminderSlots({
        ...common,
        candidates: plan.candidates.filter((slot) => slot.kind === 'hydration'),
        dailyLimit:
          remaining === null ? null : Math.max(0, remaining - explicit.length),
        occupied: [...occupied, ...explicit.map((slot) => slot.preferredAt)],
      });
      const slots = [...explicit, ...water];
      const grouped = new Map<
        EngagementStatusV3['diagnostics'][number]['kind'],
        EngagementStatusV3['diagnostics'][number]
      >();
      for (const item of plan.diagnostics) {
        const existing = grouped.get(item.kind);
        if (
          !existing ||
          (item.reason === 'scheduled' &&
            (existing.reason !== 'scheduled' ||
              (item.next_at ?? '') < (existing.next_at ?? '')))
        )
          grouped.set(item.kind, item);
      }
      diagnostics = [...grouped.values()].map((item) => {
        if (item.reason !== 'scheduled') return item;
        const next = slots
          .filter((slot) => slot.kind === item.kind)
          .sort((a, b) => a.preferredAt - b.preferredAt)[0];
        const capable = devices.rows.some(
          (device: {
            enabled: boolean;
            delivery_owner: string;
            reminder_kinds: string[];
          }) =>
            device.enabled &&
            device.delivery_owner === 'remote' &&
            device.reminder_kinds.includes(item.kind)
        );
        const reason = !settings.remote_enabled
          ? 'local_delivery'
          : !capable
            ? 'no_device'
            : next
              ? 'scheduled'
              : remaining === 0 ||
                  (remaining !== null && slots.length >= remaining)
                ? 'daily_limit'
                : item.next_at &&
                    engagementQuietAt(
                      Date.parse(item.next_at),
                      plan.timezone,
                      settings.quiet_start,
                      settings.quiet_end
                    )
                  ? 'quiet_hours'
                  : 'spacing';
        return {
          kind: item.kind,
          reason,
          next_at:
            reason === 'scheduled' && next
              ? new Date(next.preferredAt).toISOString()
              : null,
        };
      });
    } catch {
      diagnostics = [
        { kind: 'check_in', reason: 'data_unavailable', next_at: null },
      ];
    }
    return {
      daily_used: Number(count.rows[0].n),
      revision: settings.revision,
      remote_enabled: settings.remote_enabled,
      daily_limit: settings.daily_limit,
      devices: devices.rows.map(
        (row: {
          installation_id: string;
          enabled: boolean;
          delivery_owner: 'local' | 'remote';
          protocol_version: number;
          last_seen_at: Date;
        }) => ({
          installation_id: row.installation_id,
          enabled: row.enabled,
          delivery_owner: row.delivery_owner,
          protocol_version: row.protocol_version,
          last_seen_at: row.last_seen_at.toISOString(),
        })
      ),
      occurrences: occurrences.rows.map(
        (row: {
          id: string;
          kind: EngagementStatusV3['occurrences'][number]['kind'];
          subject_id: string;
          scheduled_at: Date;
          status: string;
          delivery_owner: 'local' | 'remote';
          deliveries: EngagementStatusV3['occurrences'][number]['deliveries'];
        }) => ({ ...row, scheduled_at: row.scheduled_at.toISOString() })
      ),
      diagnostics,
    };
  });
}

/** Idempotent timer-start hint. This creates no exercise, calories or health record. */
export async function recordMovementTimerStart(
  userId: string,
  id: string,
  startedAt: string
): Promise<void> {
  await withUserClient(userId, async (client) => {
    await client.query(
      `INSERT INTO engagement_subject_states(user_id,kind,subject_id,started_at)
    VALUES($1,'movement_break',$2,$3) ON CONFLICT DO NOTHING`,
      [userId, id, startedAt]
    );
  });
}
