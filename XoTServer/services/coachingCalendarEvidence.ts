import type { PoolClient } from 'pg';
import { mapSettingsV2 } from './engagementService.js';
import { z } from 'zod';
import {
  coachingEvidenceRowSchema,
  type CoachingDomain,
  type CoachingEvidenceRow,
  type CoachingContextPermission,
} from '@workspace/shared';
import {
  coachingEvidenceProjections,
  collectCoachingEvidence,
} from './coachingEvidenceService.js';

/** These server-assigned kinds are independently consented, never ordinary domain rows. */
export function evidencePermission(
  row: CoachingEvidenceRow
): CoachingContextPermission | null {
  if (row.kind === 'supplement_adherence') return 'supplement_adherence';
  if (row.kind === 'notification_history') return 'notification_history';
  return null;
}
const object = z.record(z.string(), z.json());
const aggregateMetrics: Record<string, string> = {
  food: `
    jsonb_build_object('recordedCaloriesKcal',SUM(CASE WHEN meal_plan_template_id IS NULL AND serving_size>0 THEN calories*quantity/serving_size END),'knownCalorieEntries',count(*) FILTER(WHERE meal_plan_template_id IS NULL AND serving_size>0 AND calories IS NOT NULL),'unconfirmedEntries',count(*) FILTER(WHERE meal_plan_template_id IS NOT NULL))`,
  daily_activity: `
    jsonb_build_object('meanRecordedSteps',AVG(total_steps),'knownStepDays',count(DISTINCT entry_date) FILTER(WHERE total_steps IS NOT NULL),'meanRecordedActiveKcal',AVG(active_calories),'knownEnergyDays',count(DISTINCT entry_date) FILTER(WHERE active_calories IS NOT NULL))`,
  sleep: `
    jsonb_build_object('meanRecordedSleepSeconds',AVG(time_asleep_in_seconds),'knownSleepEntries',count(time_asleep_in_seconds))`,
  measurement: `
    jsonb_build_object('meanWeightKg',AVG(weight),'minimumWeightKg',MIN(weight),'maximumWeightKg',MAX(weight),'knownWeightEntries',count(weight))`,
};

/** SQL aggregates before retrieval: twelve monthly rows per projection, never a year's raw diary. */
async function aggregateCalendarEvidence(
  client: PoolClient,
  userId: string,
  domains: readonly CoachingDomain[],
  from: string,
  to: string
) {
  const rows: CoachingEvidenceRow[] = [];
  for (const projection of coachingEvidenceProjections) {
    if (!domains.includes(projection.domain)) continue;
    const result = await client.query<{ value: unknown }>(
      `SELECT jsonb_build_object(
      'month',to_char(entry_date,'YYYY-MM'),'recordedEntries',count(*),
      'observedDays',array_agg(DISTINCT entry_date ORDER BY entry_date),
      'metrics',${aggregateMetrics[projection.kind] ?? "'{}'::jsonb"}) AS value
      FROM (${projection.query}) p GROUP BY to_char(entry_date,'YYYY-MM') ORDER BY to_char(entry_date,'YYYY-MM') LIMIT 12`,
      [userId, from, to]
    );
    for (const raw of result.rows) {
      const value = object.parse(raw.value);
      rows.push(
        coachingEvidenceRowSchema.parse({
          id: `calendar:${projection.kind}:${value.month}`,
          domain: projection.domain,
          kind: 'calendar_summary',
          day: null,
          source: projection.kind,
          observedAt: null,
          confirmation: 'confirmed',
          value: {
            ...value,
            from,
            to,
            limitation:
              'Recorded entries and days only. Missing days are unknown; counts are not adherence. Means describe recorded values, not whole-month averages. Food calories exclude unconfirmed planned entries and do not include supplement nutrients. Daily activity includes workouts; never add workout energy.',
          },
        })
      );
    }
  }
  return {
    rows,
    warnings: [
      'Calendar evidence is aggregated on the server. No raw annual diary is shared. Missing records and targets remain unknown. Supplement nutrient totals are not included in food aggregates.',
    ],
  };
}

export async function collectReviewEvidence(
  client: PoolClient,
  userId: string,
  domains: readonly CoachingDomain[],
  permissions: readonly CoachingContextPermission[],
  from: string,
  to: string,
  aggregate: boolean
) {
  const evidence = aggregate
    ? await aggregateCalendarEvidence(client, userId, domains, from, to)
    : await collectCoachingEvidence(client, userId, domains, from, to);
  if (
    permissions.includes('supplement_adherence') &&
    domains.includes('nutrition')
  ) {
    // Require an extant explicit supplement definition. Deleted/ambiguous identities stay private.
    const result = await client.query<{ value: unknown }>(
      `SELECT jsonb_build_object('month',to_char(e.entry_date,'YYYY-MM'),
      'supplementId',m.id,'name',m.name,'status',e.status,'recordedEntries',count(*),
      'observedDays',array_agg(DISTINCT e.entry_date ORDER BY e.entry_date)) AS value
      FROM medication_entries e JOIN medications m ON m.id=e.medication_id AND m.user_id=e.user_id
      WHERE e.user_id=$1 AND e.entry_date BETWEEN $2 AND $3 AND m.is_supplement=true
      GROUP BY to_char(e.entry_date,'YYYY-MM'),m.id,m.name,e.status ORDER BY to_char(e.entry_date,'YYYY-MM'),m.id,e.status LIMIT 501`,
      [userId, from, to]
    );
    if (result.rows.length > 500)
      evidence.warnings.push('Supplement evidence reached its 500-row bound.');
    for (const [index, raw] of result.rows.slice(0, 500).entries())
      evidence.rows.push(
        coachingEvidenceRowSchema.parse({
          id: `supplement:${index}`,
          domain: 'nutrition',
          kind: 'supplement_adherence',
          day: null,
          source: 'app',
          observedAt: null,
          confirmation: 'confirmed',
          value: {
            ...object.parse(raw.value),
            limitation:
              'Explicit supplement records only. Unrecorded schedules are unknown. Medications and dose changes are excluded.',
          },
        })
      );
  }
  if (
    permissions.includes('notification_history') &&
    domains.includes('habits')
  ) {
    const settings = await client.query<Record<string, unknown>>(
      'SELECT * FROM engagement_settings WHERE user_id=$1',
      [userId]
    );
    evidence.rows.push(
      coachingEvidenceRowSchema.parse({
        id: 'notification:settings',
        domain: 'habits',
        kind: 'notification_history',
        day: null,
        source: 'settings',
        observedAt: new Date().toISOString(),
        confirmation: 'confirmed',
        value: {
          settings: mapSettingsV2(settings.rows[0]),
          limitation:
            'Current server configuration, not historical settings or proof of phone delivery. Local phone-only settings are unavailable.',
        },
      })
    );
    const result = await client.query<{ value: unknown }>(
      `SELECT jsonb_build_object('month',to_char(o.local_day,'YYYY-MM'),'kind',o.kind,
      'status',o.status,'occurrences',count(*),'observedDays',array_agg(DISTINCT o.local_day ORDER BY o.local_day),
      'providerDelivered',SUM((SELECT count(*) FROM engagement_deliveries d WHERE d.user_id=o.user_id AND d.occurrence_id=o.id AND d.status='delivered')),'acceptedActionRequests',SUM((SELECT count(*) FROM engagement_action_receipts r WHERE r.user_id=o.user_id AND r.occurrence_id=o.id)),'rescheduledByAction',SUM((SELECT count(*) FROM engagement_action_receipts r WHERE r.user_id=o.user_id AND r.occurrence_id=o.id AND r.result->>'status'='pending'))) AS value
      FROM engagement_occurrences o WHERE o.user_id=$1 AND o.local_day BETWEEN $2 AND $3
      GROUP BY to_char(o.local_day,'YYYY-MM'),o.kind,o.status ORDER BY to_char(o.local_day,'YYYY-MM'),o.kind,o.status LIMIT 501`,
      [userId, from, to]
    );
    if (result.rows.length > 500)
      evidence.warnings.push(
        'Notification evidence reached its 500-row bound.'
      );
    for (const [index, raw] of result.rows.slice(0, 500).entries())
      evidence.rows.push(
        coachingEvidenceRowSchema.parse({
          id: `notification:${index}`,
          domain: 'habits',
          kind: 'notification_history',
          day: null,
          source: 'server',
          observedAt: null,
          confirmation: 'confirmed',
          value: {
            ...object.parse(raw.value),
            limitation:
              'Server-managed reminders only; local phone reminders are not covered. Provider delivery does not establish device receipt or that a reminder was seen. No push tokens or subject identities are shared.',
          },
        })
      );
  }
  return evidence;
}

/** Server-created aggregate rows carry the exact recorded days, never model-provided coverage. */
export function recordedEvidenceDays(
  rows: readonly CoachingEvidenceRow[],
  from: string,
  to: string
): Set<string> {
  return new Set(
    rows
      .filter((row) => row.confirmation === 'confirmed')
      .flatMap((row) => {
        if (row.day) return [row.day];
        if (
          ![
            'calendar_summary',
            'supplement_adherence',
            'notification_history',
          ].includes(row.kind)
        )
          return [];
        const parsed = z
          .object({ observedDays: z.array(z.iso.date()) })
          .safeParse(row.value);
        return parsed.success ? parsed.data.observedDays : [];
      })
      .filter((day) => day >= from && day <= to)
  );
}
