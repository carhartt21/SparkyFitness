import type { PoolClient } from 'pg';
import {
  addDays,
  instantToDay,
  coachingMetricDomain,
  evaluateCoachingOutcome,
  type CoachingActionRow,
  type CoachingCommitment,
} from '@workspace/shared';
import { getSystemClient } from '../db/poolManager.js';
import {
  coachingTransaction,
  coachingEvent,
  coachingFingerprint,
} from '../models/coachingRepository.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import { collectCoachingEvidence } from './coachingEvidenceService.js';
import { materializePromptMealPlans } from './mealPlanOccurrenceService.js';
import { coachingFeatureEnabled } from './coachingRunService.js';
import { log } from '../config/logging.js';

export async function maintainCoachingOwner(
  userId: string,
  now = new Date(),
  processAccepted = coachingFeatureEnabled()
): Promise<void> {
  const timezone = await loadUserTimezone(userId),
    today = instantToDay(now, timezone);
  await coachingTransaction(userId, async (client) => {
    await client.query(
      "UPDATE coaching_runs SET status='failed',failure_code='timeout',finished_at=$2,lease_token_hash=NULL,lease_until=NULL WHERE user_id=$1 AND status='running' AND (lease_until<$2 OR started_at<$2::timestamptz-interval '10 minutes')",
      [userId, now]
    );
    await client.query(
      "DELETE FROM coaching_proposals p USING coaching_runs r WHERE p.user_id=$1 AND p.status='staged' AND r.id=p.run_id AND r.user_id=p.user_id AND r.status<>'running'",
      [userId]
    );
    const expired = await client.query<{ id: string }>(
      "UPDATE coaching_proposals SET status='expired',revision=revision+1,reviewed_at=$3 WHERE user_id=$1 AND status='pending' AND (expires_day<$2 OR (data->'action'->>'dueDay')::date<$2 OR (data->'action'->'definition'->>'end_date')::date<$2) RETURNING id",
      [userId, today, now]
    );
    for (const proposal of expired.rows)
      await coachingEvent(client, userId, 'expired', {}, proposal.id);
    await client.query(
      'DELETE FROM coaching_previews WHERE user_id=$1 AND expires_at<$2',
      [userId, now]
    );
    await client.query(
      "DELETE FROM coaching_snapshots WHERE user_id=$1 AND created_at<$2::timestamptz-interval '7 days'",
      [userId, now]
    );
    await client.query(
      "DELETE FROM coaching_runs WHERE user_id=$1 AND status<>'running' AND created_at<$2::timestamptz-interval '90 days'",
      [userId, now]
    );
    await client.query(
      "DELETE FROM coaching_operations WHERE user_id=$1 AND agent_id IS NOT NULL AND created_at<$2::timestamptz-interval '90 days'",
      [userId, now]
    );
    if (!processAccepted) return;
    await materializePromptMealPlans(client, userId, today, addDays(today, 30));
    const actions = await client.query<CoachingActionRow>(
      "SELECT * FROM coaching_actions WHERE user_id=$1 AND status='active' ORDER BY id FOR UPDATE",
      [userId]
    );
    for (const action of actions.rows) {
      if (action.data.kind === 'task') {
        if (action.data.dueDay < today) {
          await client.query(
            "UPDATE coaching_actions SET status='expired',revision=revision+1,updated_at=$3 WHERE user_id=$1 AND id=$2",
            [userId, action.id, now]
          );
          await coachingEvent(
            client,
            userId,
            'expired',
            {},
            action.proposal_id,
            action.id
          );
        }
        continue;
      }
      const activated = instantToDay(action.activated_at, timezone),
        to =
          action.success.reviewDay < today ? action.success.reviewDay : today;
      const from = activated < addDays(to, -27) ? addDays(to, -27) : activated;
      if (to < from) continue;
      const evidence = await collectCoachingEvidence(
        client,
        userId,
        [coachingMetricDomain(action.success.metric)],
        from,
        to
      );
      const outcome = evaluateCoachingOutcome({
        rows: evidence.rows,
        success: action.success,
        from,
        to,
        today,
        now,
      });
      const completed =
        action.data.kind === 'objective' && outcome.interpretation === 'met';
      const expiredAction =
        action.data.kind === 'objective' &&
        action.success.reviewDay < today &&
        !completed;
      const prior = action.outcome as CoachingCommitment['outcome'];
      if (
        !prior ||
        instantToDay(new Date(prior.evaluatedAt), timezone) !== today ||
        coachingFingerprint({ ...prior, evaluatedAt: null }) !==
          coachingFingerprint({ ...outcome, evaluatedAt: null })
      ) {
        await client.query(
          'UPDATE coaching_actions SET outcome=$3,status=$4,revision=revision+1,updated_at=$5 WHERE user_id=$1 AND id=$2',
          [
            userId,
            action.id,
            JSON.stringify(outcome),
            completed ? 'completed' : expiredAction ? 'expired' : 'active',
            now,
          ]
        );
        await coachingEvent(
          client,
          userId,
          completed ? 'completed' : expiredAction ? 'expired' : 'outcome',
          outcome,
          action.proposal_id,
          action.id
        );
      }
    }
  });
}
let running = false;
export async function maintainCoaching(now = new Date()): Promise<void> {
  if (running) return;
  running = true;
  try {
    let after: string | null = null;
    for (;;) {
      const client: PoolClient = await getSystemClient();
      let ids: string[];
      try {
        ids = (
          await client.query<{ user_id: string }>(
            'SELECT user_id FROM coaching_settings WHERE ($1::uuid IS NULL OR user_id>$1::uuid) ORDER BY user_id LIMIT 100',
            [after]
          )
        ).rows.map((row) => row.user_id);
      } finally {
        client.release();
      }
      if (!ids.length) break;
      for (const id of ids)
        try {
          await maintainCoachingOwner(id, now);
        } catch {
          log('warn', '[Coaching] Maintenance unavailable for an owner');
        }
      after = ids.at(-1) ?? null;
    }
  } finally {
    running = false;
  }
}
