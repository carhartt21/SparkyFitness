import { randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import {
  addDays,
  instantToDay,
  defaultCoachingSettings,
  dueCoachingSlot,
  coachingActionDomain,
  coachingMetricDomain,
  coachingDomainSchema,
  coachingSettingsSchema,
  coachingAgentSchema,
  coachingRunSchema,
  coachingProposalSchema,
  coachingCommitmentSchema,
  coachingContextSchema,
  coachingSnapshotPageSchema,
  coachingClaimResultSchema,
  coachingSubmitResultSchema,
  coachingReportResultSchema,
  coachingProposalInputSchema,
  coachingEventSchema,
  type CoachingSettings,
  type CoachingSettingsPatch,
  type CoachingAgentRow,
  type CoachingRunRow,
  type CoachingProposalRow,
  type CoachingActionRow,
  type CoachingSnapshotRow,
  type CoachingEventRow,
  type CoachingSubmit,
  type CoachingRunReport,
  type CoachingAgent,
} from '@workspace/shared';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import {
  coachingTransaction,
  coachingOperation,
  coachingFingerprint,
  coachingEvent,
  CoachingConflictError,
  CoachingForbiddenError,
  CoachingNotFoundError,
  CoachingValidationError,
} from '../models/coachingRepository.js';
import { collectCoachingEvidence } from './coachingEvidenceService.js';

export const coachingFeatureEnabled = (): boolean =>
  process.env.XOT_COACHING_ENABLED === 'true';
export function requireCoachingEnabled(): void {
  if (!coachingFeatureEnabled())
    throw new CoachingForbiddenError('Coaching is not enabled on this server.');
}
const iso = (date: Date | null): string | null => date?.toISOString() ?? null;
const dayString = (value: Date | string): string =>
  typeof value === 'string'
    ? value.slice(0, 10)
    : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
export function mapCoachingAgent(row: CoachingAgentRow): CoachingAgent {
  return coachingAgentSchema.parse({
    id: row.id,
    name: row.name,
    domains: row.domains,
    enabled: row.enabled,
    credentialKind: row.oauth_client_id ? 'oauth' : 'api_key',
    hasCredential: Boolean(row.key_id || row.oauth_client_id),
    lastSeenAt: iso(row.last_seen_at),
    expiresAt: iso(row.expires_at),
  });
}
export function mapCoachingRun(row: CoachingRunRow) {
  return coachingRunSchema.parse({
    id: row.id,
    agentId: row.agent_id,
    kind: row.kind,
    status: row.status,
    from: dayString(row.from_day),
    to: dayString(row.to_day),
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
    leaseUntil: iso(row.lease_until),
    failureCode: row.failure_code,
  });
}
export function mapCoachingProposal(row: CoachingProposalRow) {
  return coachingProposalSchema.parse({
    ...row.data,
    id: row.id,
    runId: row.run_id,
    agentId: row.agent_id,
    snapshotId: row.snapshot_id,
    revision: row.revision,
    status: row.status,
    createdAt: iso(row.created_at),
    publishedAt: iso(row.published_at),
    reviewedAt: iso(row.reviewed_at),
    reviewReason: row.review_reason,
    activationId: row.activation_id,
    acceptedAction: row.accepted_action,
  });
}
export function mapCoachingAction(row: CoachingActionRow) {
  return coachingCommitmentSchema.parse({
    id: row.id,
    proposalId: row.proposal_id,
    status: row.status,
    revision: row.revision,
    action: row.data,
    success: row.success,
    activatedAt: iso(row.activated_at),
    updatedAt: iso(row.updated_at),
    activationRefs: row.activation_refs,
    outcome: row.outcome,
  });
}

export async function readCoachingSettings(
  client: PoolClient,
  userId: string
): Promise<{ settings: CoachingSettings; reconsiderTopics: string[] }> {
  const result = await client.query<{
    revision: number;
    data: unknown;
    reconsider_topics: string[];
  }>(
    'SELECT revision,data,reconsider_topics FROM coaching_settings WHERE user_id=$1',
    [userId]
  );
  const row = result.rows[0];
  return {
    settings: row
      ? coachingSettingsSchema.parse({
          ...z.record(z.string(), z.unknown()).parse(row.data),
          revision: row.revision,
        })
      : {
          ...defaultCoachingSettings,
          domains: [...defaultCoachingSettings.domains],
        },
    reconsiderTopics: row?.reconsider_topics ?? [],
  };
}
export async function getCoachingSettings(userId: string) {
  return coachingTransaction(
    userId,
    async (client) => ({
      featureEnabled: coachingFeatureEnabled(),
      timezone: await loadUserTimezone(userId),
      ...(await readCoachingSettings(client, userId)),
      agents: (
        await client.query<CoachingAgentRow>(
          'SELECT * FROM coaching_agents WHERE user_id=$1 ORDER BY created_at,id',
          [userId]
        )
      ).rows.map(mapCoachingAgent),
    }),
    true
  );
}
export async function patchCoachingSettings(
  userId: string,
  patch: CoachingSettingsPatch
) {
  requireCoachingEnabled();
  return coachingTransaction(userId, async (client) => {
    const { settings } = await readCoachingSettings(client, userId);
    if (settings.revision !== patch.expectedRevision)
      throw new CoachingConflictError('Coaching settings changed elsewhere.');
    const { expectedRevision: _revision, ...changes } = patch;
    const next = coachingSettingsSchema.parse({
      ...settings,
      ...changes,
      revision: settings.revision + 1,
    });
    const { revision, ...data } = next;
    await client.query(
      'INSERT INTO coaching_settings(user_id,revision,data) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET revision=EXCLUDED.revision,data=EXCLUDED.data,updated_at=now()',
      [userId, revision, JSON.stringify(data)]
    );
    if (!next.enabled) {
      await client.query(
        "UPDATE coaching_runs SET status='failed',failure_code='cancelled',finished_at=now(),lease_until=NULL WHERE user_id=$1 AND status IN ('queued','running')",
        [userId]
      );
      await client.query(
        "DELETE FROM coaching_proposals WHERE user_id=$1 AND status='staged'",
        [userId]
      );
    }
    await coachingEvent(client, userId, 'settings_changed', {
      revision,
      enabled: next.enabled,
    });
    return next;
  });
}
export async function readCoachingAgent(
  client: PoolClient,
  userId: string,
  agentId: string
): Promise<CoachingAgentRow> {
  const result = await client.query<CoachingAgentRow>(
    'SELECT * FROM coaching_agents WHERE user_id=$1 AND id=$2',
    [userId, agentId]
  );
  const agent = result.rows[0];
  if (
    !agent ||
    !agent.enabled ||
    (agent.expires_at && agent.expires_at <= new Date())
  )
    throw new CoachingForbiddenError(
      'Agent connection was revoked or expired.'
    );
  return agent;
}
export async function resolveCoachingAgent(
  userId: string,
  credential: { keyId?: string; oauthClientId?: string }
): Promise<CoachingAgentRow> {
  requireCoachingEnabled();
  return coachingTransaction(
    userId,
    async (client) => {
      const result = await client.query<CoachingAgentRow>(
        'SELECT * FROM coaching_agents WHERE user_id=$1 AND (($2::text IS NOT NULL AND key_id=$2) OR ($3::text IS NOT NULL AND oauth_client_id=$3))',
        [userId, credential.keyId ?? null, credential.oauthClientId ?? null]
      );
      if (!result.rows[0])
        throw new CoachingForbiddenError(
          'This credential is not bound to an agent connection.'
        );
      return readCoachingAgent(client, userId, result.rows[0].id);
    },
    true
  );
}
export async function createCoachingAgent(
  userId: string,
  input: z.infer<typeof import('@workspace/shared').coachingAgentCreateSchema>
) {
  requireCoachingEnabled();
  return coachingTransaction(userId, async (client) => {
    if (input.oauthClientId) {
      const existing = await client.query<CoachingAgentRow>(
        'SELECT * FROM coaching_agents WHERE user_id=$1 AND oauth_client_id=$2 AND enabled FOR UPDATE',
        [userId, input.oauthClientId]
      );
      if (existing.rows[0]) {
        const id = existing.rows[0].id;
        const updated = await client.query<CoachingAgentRow>(
          "UPDATE coaching_agents SET name=$3,domains=$4,expires_at=now()+interval '90 days' WHERE user_id=$1 AND id=$2 RETURNING *",
          [userId, id, input.name, [...new Set(input.domains)]]
        );
        await client.query(
          "UPDATE coaching_runs SET status='failed',failure_code='cancelled',finished_at=now(),lease_until=NULL WHERE user_id=$1 AND agent_id=$2 AND status='running'",
          [userId, id]
        );
        await client.query(
          "DELETE FROM coaching_proposals WHERE user_id=$1 AND agent_id=$2 AND status='staged'",
          [userId, id]
        );
        await coachingEvent(client, userId, 'agent_access_changed', {
          agentId: id,
        });
        return mapCoachingAgent(updated.rows[0]);
      }
    }
    const result = await client.query<CoachingAgentRow>(
      "INSERT INTO coaching_agents(user_id,name,domains,oauth_client_id,expires_at) VALUES($1,$2,$3,$4,CASE WHEN $4::text IS NULL THEN NULL ELSE now()+interval '90 days' END) RETURNING *",
      [
        userId,
        input.name,
        [...new Set(input.domains)],
        input.oauthClientId ?? null,
      ]
    );
    await coachingEvent(client, userId, 'agent_created', {
      agentId: result.rows[0].id,
    });
    return mapCoachingAgent(result.rows[0]);
  });
}
export async function revokeCoachingAgent(
  userId: string,
  agentId: string
): Promise<void> {
  await coachingTransaction(userId, async (client) => {
    const updated = await client.query(
      'UPDATE coaching_agents SET enabled=false,key_id=NULL WHERE user_id=$1 AND id=$2 RETURNING id',
      [userId, agentId]
    );
    if (!updated.rows[0])
      throw new CoachingNotFoundError('Agent connection not found.');
    await client.query(
      "UPDATE coaching_runs SET status='failed',failure_code='cancelled',finished_at=now(),lease_until=NULL WHERE user_id=$1 AND agent_id=$2 AND status='running'",
      [userId, agentId]
    );
    await client.query(
      "DELETE FROM coaching_proposals WHERE user_id=$1 AND agent_id=$2 AND status='staged'",
      [userId, agentId]
    );
    await coachingEvent(client, userId, 'agent_revoked', { agentId });
  });
}

async function dueSlot(
  client: PoolClient,
  userId: string,
  timezone: string,
  settings: CoachingSettings,
  now: Date
) {
  if (!settings.enabled) return null;
  const running = await client.query(
    "SELECT 1 FROM coaching_runs WHERE user_id=$1 AND status='running' AND lease_until>$2 LIMIT 1",
    [userId, now]
  );
  if (running.rows[0]) return null;
  const manual = await client.query<CoachingRunRow>(
    "SELECT * FROM coaching_runs WHERE user_id=$1 AND status='queued' ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  if (manual.rows[0])
    return {
      kind: 'manual' as const,
      slotKey: manual.rows[0].slot_key,
      from: dayString(manual.rows[0].from_day),
      to: instantToDay(now, timezone),
    };
  const completed = await client.query<{
    last: Date | null;
    weekly: Date | null;
  }>(
    "SELECT MAX(started_at) AS last,MAX(started_at) FILTER(WHERE kind='weekly') AS weekly FROM coaching_runs WHERE user_id=$1 AND status='succeeded'",
    [userId]
  );
  const due = dueCoachingSlot({
    now,
    timezone,
    settings,
    lastCompletedAt: completed.rows[0]?.last ?? null,
    lastWeeklyCompletedAt: completed.rows[0]?.weekly ?? null,
  });
  if (!due) return null;
  const retry = await client.query<CoachingRunRow>(
    'SELECT * FROM coaching_runs WHERE user_id=$1 AND slot_key=$2',
    [userId, due.slotKey]
  );
  const previous = retry.rows[0];
  if (
    previous &&
    (previous.status === 'succeeded' ||
      previous.attempt_count >= 3 ||
      (previous.finished_at &&
        now.getTime() - previous.finished_at.getTime() < 15 * 60_000))
  )
    return null;
  return { kind: due.kind, slotKey: due.slotKey, from: due.from, to: due.to };
}
export async function getCoachingContext(
  userId: string,
  agentId: string | null,
  options: {
    eventCursor?: number;
    proposalOffset?: number;
    commitmentOffset?: number;
  } = {}
) {
  requireCoachingEnabled();
  const timezone = await loadUserTimezone(userId);
  return coachingTransaction(
    userId,
    async (client) => {
      const agent = agentId
        ? await readCoachingAgent(client, userId, agentId)
        : null;
      const { settings, reconsiderTopics } = await readCoachingSettings(
        client,
        userId
      );
      const domains = agent
        ? settings.domains.filter((domain) => agent.domains.includes(domain))
        : coachingDomainSchema.options;
      const proposals = await client.query<CoachingProposalRow>(
        "SELECT * FROM coaching_proposals WHERE user_id=$1 AND status<>'staged' AND domain=ANY($2::text[]) ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END,(data->>'impact')::integer DESC,created_at DESC,id LIMIT 101 OFFSET $3",
        [userId, domains, options.proposalOffset ?? 0]
      );
      const actions = await client.query<CoachingActionRow>(
        'SELECT a.* FROM coaching_actions a JOIN coaching_proposals p ON p.id=a.proposal_id AND p.user_id=a.user_id WHERE a.user_id=$1 AND p.domain=ANY($2::text[]) ORDER BY a.activated_at DESC,a.id LIMIT 101 OFFSET $3',
        [userId, domains, options.commitmentOffset ?? 0]
      );
      const events = await client.query<CoachingEventRow>(
        'SELECT e.* FROM coaching_events e LEFT JOIN coaching_proposals p ON p.id=e.proposal_id AND p.user_id=e.user_id WHERE e.user_id=$1 AND e.sequence>$2 AND (e.proposal_id IS NULL OR p.domain=ANY($3::text[])) ORDER BY e.sequence LIMIT 100',
        [userId, options.eventCursor ?? 0, domains]
      );
      const runs = await client.query<CoachingRunRow>(
        'SELECT * FROM coaching_runs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',
        [userId]
      );
      return coachingContextSchema.parse({
        enabled: settings.enabled,
        timezone,
        today: instantToDay(new Date(), timezone),
        settings,
        agent: agent ? mapCoachingAgent(agent) : null,
        due:
          agent && domains.length
            ? await dueSlot(client, userId, timezone, settings, new Date())
            : null,
        runs: runs.rows.map(mapCoachingRun),
        proposals: proposals.rows.slice(0, 100).map(mapCoachingProposal),
        commitments: actions.rows.slice(0, 100).map(mapCoachingAction),
        events: events.rows.map((row) =>
          coachingEventSchema.parse({
            sequence: Number(row.sequence),
            proposalId: row.proposal_id,
            actionId: row.action_id,
            kind: row.kind,
            createdAt: iso(row.created_at),
            data: row.data,
          })
        ),
        nextEventCursor: Number(
          events.rows.at(-1)?.sequence ?? options.eventCursor ?? 0
        ),
        reconsiderTopics,
        nextProposalOffset:
          proposals.rows.length > 100
            ? (options.proposalOffset ?? 0) + 100
            : null,
        nextCommitmentOffset:
          actions.rows.length > 100
            ? (options.commitmentOffset ?? 0) + 100
            : null,
      });
    },
    true
  );
}

export async function requestCoachingRun(
  userId: string,
  operationId: string,
  reconsiderTopics: string[] = []
) {
  requireCoachingEnabled();
  const timezone = await loadUserTimezone(userId);
  return coachingTransaction(userId, async (client) =>
    coachingOperation(
      client,
      userId,
      operationId,
      { kind: 'manual', reconsiderTopics },
      coachingRunSchema,
      async () => {
        const { settings } = await readCoachingSettings(client, userId);
        if (!settings.enabled)
          throw new CoachingConflictError(
            'Enable coaching before requesting a review.'
          );
        const to = instantToDay(new Date(), timezone);
        await client.query(
          "UPDATE coaching_runs SET status='expired',finished_at=now() WHERE user_id=$1 AND status='queued'",
          [userId]
        );
        const run = await client.query<CoachingRunRow>(
          "INSERT INTO coaching_runs(user_id,kind,slot_key,from_day,to_day,status) VALUES($1,'manual',$2,$3,$4,'queued') RETURNING *",
          [userId, `manual:${operationId}`, addDays(to, -27), to]
        );
        await client.query(
          'UPDATE coaching_settings SET reconsider_topics=$2 WHERE user_id=$1',
          [userId, [...new Set(reconsiderTopics)]]
        );
        await coachingEvent(client, userId, 'run_requested', {
          runId: run.rows[0].id,
        });
        return mapCoachingRun(run.rows[0]);
      }
    )
  );
}

export async function claimCoachingRun(
  userId: string,
  agentId: string,
  operationId: string
) {
  requireCoachingEnabled();
  const timezone = await loadUserTimezone(userId);
  return coachingTransaction(userId, async (client) => {
    const agent = await readCoachingAgent(client, userId, agentId);
    return coachingOperation(
      client,
      userId,
      operationId,
      { kind: 'claim' },
      coachingClaimResultSchema,
      async () => {
        const { settings } = await readCoachingSettings(client, userId);
        const domains = agent.domains.filter((domain) =>
          settings.domains.includes(domain)
        );
        if (!domains.length) return null;
        await client.query(
          "UPDATE coaching_runs SET status='expired',failure_code='timeout',finished_at=now(),lease_until=NULL WHERE user_id=$1 AND status='running' AND (lease_until<=now() OR started_at<now()-interval '10 minutes')",
          [userId]
        );
        const due = await dueSlot(
          client,
          userId,
          timezone,
          settings,
          new Date()
        );
        await client.query(
          'UPDATE coaching_agents SET last_seen_at=now() WHERE user_id=$1 AND id=$2',
          [userId, agentId]
        );
        if (!due) return null;
        const leaseToken = randomBytes(32).toString('hex');
        const run = await client.query<CoachingRunRow>(
          `INSERT INTO coaching_runs(user_id,agent_id,kind,slot_key,from_day,to_day,status,lease_token_hash,lease_until,started_at,attempt_count) VALUES($1,$2,$3,$4,$5,$6,'running',$7,now()+interval '15 minutes',now(),1)
        ON CONFLICT(user_id,slot_key) DO UPDATE SET agent_id=EXCLUDED.agent_id,from_day=EXCLUDED.from_day,to_day=EXCLUDED.to_day,status='running',lease_token_hash=EXCLUDED.lease_token_hash,lease_until=EXCLUDED.lease_until,started_at=now(),finished_at=NULL,failure_code=NULL,attempt_count=coaching_runs.attempt_count+1 RETURNING *`,
          [
            userId,
            agentId,
            due.kind,
            due.slotKey,
            due.from,
            due.to,
            coachingFingerprint(leaseToken),
          ]
        );
        await client.query(
          "DELETE FROM coaching_proposals WHERE user_id=$1 AND run_id=$2 AND status='staged'",
          [userId, run.rows[0].id]
        );
        await client.query(
          'DELETE FROM coaching_snapshots WHERE user_id=$1 AND run_id=$2',
          [userId, run.rows[0].id]
        );
        const evidence = await collectCoachingEvidence(
          client,
          userId,
          domains,
          due.from,
          due.to
        );
        const snapshot = await client.query<{ id: string }>(
          'INSERT INTO coaching_snapshots(user_id,run_id,from_day,to_day,rows,warnings) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
          [
            userId,
            run.rows[0].id,
            due.from,
            due.to,
            JSON.stringify(evidence.rows),
            evidence.warnings,
          ]
        );
        return {
          run: mapCoachingRun(run.rows[0]),
          leaseToken,
          snapshotId: snapshot.rows[0].id,
        };
      },
      agentId
    );
  });
}
async function validateLease(
  client: PoolClient,
  userId: string,
  agentId: string,
  runId: string,
  leaseToken: string
): Promise<CoachingRunRow> {
  await readCoachingAgent(client, userId, agentId);
  const { settings } = await readCoachingSettings(client, userId);
  if (!settings.enabled)
    throw new CoachingForbiddenError('Coaching was paused.');
  const result = await client.query<CoachingRunRow>(
    'SELECT * FROM coaching_runs WHERE user_id=$1 AND agent_id=$2 AND id=$3 FOR UPDATE',
    [userId, agentId, runId]
  );
  const run = result.rows[0];
  if (
    !run ||
    run.status !== 'running' ||
    !run.lease_until ||
    run.lease_until <= new Date() ||
    !run.started_at ||
    Date.now() - run.started_at.getTime() > 10 * 60_000 ||
    run.lease_token_hash !== coachingFingerprint(leaseToken)
  )
    throw new CoachingConflictError(
      'The coaching run lease is no longer valid.'
    );
  return run;
}
export async function getCoachingSnapshot(
  userId: string,
  agentId: string,
  snapshotId: string,
  offset = 0,
  limit = 50
) {
  requireCoachingEnabled();
  return coachingTransaction(
    userId,
    async (client) => {
      const agent = await readCoachingAgent(client, userId, agentId);
      const result = await client.query<CoachingSnapshotRow>(
        'SELECT s.* FROM coaching_snapshots s JOIN coaching_runs r ON r.id=s.run_id AND r.user_id=s.user_id WHERE s.user_id=$1 AND s.id=$2 AND r.agent_id=$3',
        [userId, snapshotId, agentId]
      );
      const snapshot = result.rows[0];
      if (
        !snapshot ||
        Date.now() - snapshot.created_at.getTime() > 7 * 86400_000
      )
        throw new CoachingNotFoundError(
          'The evidence snapshot expired or is not available to this agent.'
        );
      const { settings } = await readCoachingSettings(client, userId);
      const rows = snapshot.rows.filter(
        (row) =>
          agent.domains.includes(row.domain) &&
          settings.domains.includes(row.domain)
      );
      return coachingSnapshotPageSchema.parse({
        snapshotId,
        from: dayString(snapshot.from_day),
        to: dayString(snapshot.to_day),
        createdAt: iso(snapshot.created_at),
        total: rows.length,
        offset,
        nextOffset: offset + limit < rows.length ? offset + limit : null,
        rows: rows.slice(offset, offset + limit),
        warnings: snapshot.warnings,
      });
    },
    true
  );
}
export async function submitCoachingProposals(
  userId: string,
  agentId: string,
  input: CoachingSubmit
) {
  requireCoachingEnabled();
  return coachingTransaction(userId, async (client) => {
    await readCoachingAgent(client, userId, agentId);
    return coachingOperation(
      client,
      userId,
      input.operationId,
      { kind: 'submit', ...input },
      coachingSubmitResultSchema,
      async () => {
        const run = await validateLease(
          client,
          userId,
          agentId,
          input.runId,
          input.leaseToken
        );
        const agent = await readCoachingAgent(client, userId, agentId);
        const { settings, reconsiderTopics } = await readCoachingSettings(
          client,
          userId
        );
        const snapshot = (
          await client.query<CoachingSnapshotRow>(
            'SELECT * FROM coaching_snapshots WHERE user_id=$1 AND run_id=$2',
            [userId, input.runId]
          )
        ).rows[0];
        if (!snapshot)
          throw new CoachingNotFoundError('Evidence snapshot not found.');
        const staged = await client.query<{ count: number }>(
          'SELECT count(*)::integer AS count FROM coaching_proposals WHERE user_id=$1 AND run_id=$2',
          [userId, input.runId]
        );
        if (staged.rows[0].count + input.proposals.length > 200)
          throw new CoachingValidationError(
            'A run may submit at most 200 proposals.'
          );
        const proposalIds: string[] = [];
        let suppressedCount = 0;
        for (const raw of input.proposals) {
          const proposal = coachingProposalInputSchema.parse(raw);
          const domain = coachingActionDomain(proposal.action.kind);
          if (
            !agent.domains.includes(proposal.domain) ||
            !settings.domains.includes(proposal.domain) ||
            (domain &&
              domain !== proposal.domain &&
              proposal.action.kind !== 'goals') ||
            (proposal.action.kind === 'goals' &&
              proposal.action.changes.some(
                (change) =>
                  coachingMetricDomain(change.field) !== proposal.domain
              )) ||
            coachingMetricDomain(proposal.success.metric) !== proposal.domain ||
            (proposal.action.kind === 'objective' &&
              coachingMetricDomain(proposal.action.success.metric) !==
                proposal.domain)
          )
            throw new CoachingForbiddenError(
              'Proposal domain is outside the selected agent access.'
            );
          const ids = new Set(
            proposal.evidence.flatMap((reference) => reference.rowIds)
          );
          const cited = snapshot.rows.filter(
            (row) =>
              ids.has(row.id) &&
              agent.domains.includes(row.domain) &&
              settings.domains.includes(row.domain)
          );
          if (
            cited.length !== ids.size ||
            proposal.evidence.some(
              (reference) =>
                reference.from < dayString(run.from_day) ||
                reference.to > dayString(run.to_day) ||
                reference.from > reference.to
            )
          )
            throw new CoachingValidationError(
              'Evidence references must belong to this frozen snapshot and time window.'
            );
          for (const reference of proposal.evidence) {
            const days =
              Math.floor(
                (Date.parse(reference.to) - Date.parse(reference.from)) /
                  86400_000
              ) + 1;
            const observed = new Set(
              cited
                .filter(
                  (row) =>
                    reference.rowIds.includes(row.id) &&
                    row.confirmation === 'confirmed' &&
                    row.day &&
                    row.day >= reference.from &&
                    row.day <= reference.to
                )
                .map((row) => row.day)
            );
            reference.coverage = Math.min(
              reference.coverage,
              observed.size / days
            );
            reference.freshness = 'unknown';
            reference.limitation = [
              reference.limitation,
              'Coverage is bounded by cited recorded days. Provider synchronization freshness is not established.',
            ]
              .filter(Boolean)
              .join(' ')
              .slice(0, 1000);
          }
          if (
            proposal.expiresDay < dayString(run.to_day) ||
            proposal.expiresDay > addDays(dayString(run.to_day), 14)
          )
            throw new CoachingValidationError(
              'Proposal expiry must be within the next 14 days.'
            );
          const topic = proposal.topic.trim().toLowerCase();
          const equivalent = await client.query(
            "SELECT 1 FROM coaching_proposals WHERE user_id=$1 AND topic=$2 AND (status IN ('pending','staged') OR (status='accepted' AND EXISTS(SELECT 1 FROM coaching_actions a WHERE a.proposal_id=coaching_proposals.id AND a.user_id=coaching_proposals.user_id AND a.status='active')) OR (status='declined' AND reviewed_at>now()-interval '30 days' AND NOT ($3::boolean))) LIMIT 1",
            [
              userId,
              topic,
              reconsiderTopics.some((value) => value.toLowerCase() === topic),
            ]
          );
          if (equivalent.rows[0]) {
            suppressedCount += 1;
            continue;
          }
          const proposalId = randomUUID();
          await client.query(
            'INSERT INTO coaching_proposals(id,user_id,run_id,agent_id,snapshot_id,topic,domain,data,evidence,expires_day) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
            [
              proposalId,
              userId,
              input.runId,
              agentId,
              snapshot.id,
              topic,
              proposal.domain,
              JSON.stringify({ ...proposal, topic }),
              JSON.stringify(cited),
              proposal.expiresDay,
            ]
          );
          proposalIds.push(proposalId);
        }
        return { proposalIds, suppressedCount };
      },
      agentId
    );
  });
}
export async function reportCoachingRun(
  userId: string,
  agentId: string,
  input: CoachingRunReport
) {
  requireCoachingEnabled();
  return coachingTransaction(userId, async (client) => {
    await readCoachingAgent(client, userId, agentId);
    return coachingOperation(
      client,
      userId,
      input.operationId,
      { kind: 'report', ...input },
      coachingReportResultSchema,
      async () => {
        await validateLease(
          client,
          userId,
          agentId,
          input.runId,
          input.leaseToken
        );
        let publishedCount = 0;
        if (input.status === 'succeeded') {
          const published = await client.query<{ id: string }>(
            "UPDATE coaching_proposals SET status='pending',published_at=now() WHERE user_id=$1 AND run_id=$2 AND status='staged' RETURNING id",
            [userId, input.runId]
          );
          publishedCount = published.rows.length;
          for (const proposal of published.rows)
            await coachingEvent(
              client,
              userId,
              'proposed',
              { runId: input.runId },
              proposal.id
            );
          await client.query(
            "UPDATE coaching_settings SET reconsider_topics='{}' WHERE user_id=$1",
            [userId]
          );
        } else if (input.status === 'failed')
          await client.query(
            "DELETE FROM coaching_proposals WHERE user_id=$1 AND run_id=$2 AND status='staged'",
            [userId, input.runId]
          );
        const run = await client.query<CoachingRunRow>(
          input.status === 'heartbeat'
            ? "UPDATE coaching_runs SET lease_until=now()+interval '15 minutes' WHERE user_id=$1 AND id=$2 RETURNING *"
            : 'UPDATE coaching_runs SET status=$3,failure_code=$4,finished_at=now(),lease_until=NULL WHERE user_id=$1 AND id=$2 RETURNING *',
          input.status === 'heartbeat'
            ? [userId, input.runId]
            : [
                userId,
                input.runId,
                input.status,
                input.status === 'failed'
                  ? (input.failureCode ?? 'internal')
                  : null,
              ]
        );
        await client.query(
          'UPDATE coaching_agents SET last_seen_at=now() WHERE user_id=$1 AND id=$2',
          [userId, agentId]
        );
        return { run: mapCoachingRun(run.rows[0]), publishedCount };
      },
      agentId
    );
  });
}
