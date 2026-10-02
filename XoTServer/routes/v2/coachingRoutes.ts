import express from 'express';
import { z } from 'zod';
import {
  coachingSettingsPatchSchema,
  coachingAgentCreateSchema,
  coachingPreviewRequestSchema,
  coachingReviewSchema,
  coachingCommitmentPatchSchema,
  coachingInboxSchema,
  type CoachingProposalRow,
  type CoachingActionRow,
} from '@workspace/shared';
import { requireOwnerAppSession } from '../../middleware/requireOwnerAppSession.js';
import { plannedMealConfirmSchema } from '@workspace/shared';
import {
  getPlannedMeals,
  preparePlannedMeals,
  confirmPlannedMeal,
  skipPlannedMeal,
} from '../../services/mealPlanOccurrenceService.js';
import {
  coachingIdParamsSchema,
  coachingPageQuerySchema,
  coachingPlanningQuerySchema,
  coachingManualRunRequestSchema,
  coachingCredentialRequestSchema,
} from '../../schemas/coachingSchemas.js';
import {
  getCoachingSettings,
  getCoachingContext,
  patchCoachingSettings,
  createCoachingAgent,
  revokeCoachingAgent,
  requestCoachingRun,
  mapCoachingProposal,
  mapCoachingAction,
  requireCoachingEnabled,
} from '../../services/coachingRunService.js';
import {
  previewCoachingProposal,
  reviewCoachingProposal,
  patchCoachingCommitment,
  getCoachingProposalEvidence,
  deleteCoachingProposalHistory,
} from '../../services/coachingReviewService.js';
import { getCoachingPlanningContext } from '../../services/coachingPlanningService.js';
import { createCoachingCredential } from '../../services/coachingCredentialService.js';
import {
  coachingTransaction,
  CoachingConflictError,
  CoachingForbiddenError,
  CoachingNotFoundError,
  CoachingValidationError,
} from '../../models/coachingRepository.js';

/**
 * @openapi
 * /v2/coaching/context:
 *   get:
 *     summary: Read owner run and outcome status
 *     description: Requires the owning app session. API keys and family delegates are rejected. Exact payloads use shared Coaching and MealPlanning Zod contracts.
 *     tags: [Coaching]
 *     responses:
 *       '200': { description: Owner-scoped result }
 *       '400': { description: Invalid typed request }
 *       '403': { description: Identity or selected access rejected }
 *       '404': { description: Owner record not found }
 *       '409': { description: Stale revision, preview, reference or operation }
 * /v2/coaching/agents:
 *   post:
 *     summary: Create an expiring owner-agent or OAuth-client binding
 *     description: Requires the owning app session. API keys and family delegates are rejected. Exact payloads use shared Coaching and MealPlanning Zod contracts.
 *     tags: [Coaching]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       '200': { description: Owner-scoped result }
 *       '400': { description: Invalid typed request }
 *       '403': { description: Identity or selected access rejected }
 *       '404': { description: Owner record not found }
 *       '409': { description: Stale revision, preview, reference or operation }
 * /v2/coaching/agents/{id}/key:
 *   post:
 *     summary: Issue or rotate a proposal-only credential, returned once
 *     description: Requires the owning app session. API keys and family delegates are rejected. Exact payloads use shared Coaching and MealPlanning Zod contracts.
 *     tags: [Coaching]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       '200': { description: Owner-scoped result }
 *       '400': { description: Invalid typed request }
 *       '403': { description: Identity or selected access rejected }
 *       '404': { description: Owner record not found }
 *       '409': { description: Stale revision, preview, reference or operation }
 * /v2/coaching/agents/{id}/revoke:
 *   post:
 *     summary: Immediately revoke an agent binding
 *     description: Requires the owning app session. API keys and family delegates are rejected. Exact payloads use shared Coaching and MealPlanning Zod contracts.
 *     tags: [Coaching]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: Owner-scoped result }
 *       '400': { description: Invalid typed request }
 *       '403': { description: Identity or selected access rejected }
 *       '404': { description: Owner record not found }
 *       '409': { description: Stale revision, preview, reference or operation }
 * /v2/coaching/runs:
 *   post:
 *     summary: Request an explicit manual review
 *     description: Requires the owning app session. API keys and family delegates are rejected. Exact payloads use shared Coaching and MealPlanning Zod contracts.
 *     tags: [Coaching]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       '200': { description: Owner-scoped result }
 *       '400': { description: Invalid typed request }
 *       '403': { description: Identity or selected access rejected }
 *       '404': { description: Owner record not found }
 *       '409': { description: Stale revision, preview, reference or operation }
 * /v2/coaching/planning:
 *   get:
 *     summary: Read accessible planning references
 *     description: Requires the owning app session. API keys and family delegates are rejected. Exact payloads use shared Coaching and MealPlanning Zod contracts.
 *     tags: [Coaching]
 *     responses:
 *       '200': { description: Owner-scoped result }
 *       '400': { description: Invalid typed request }
 *       '403': { description: Identity or selected access rejected }
 *       '404': { description: Owner record not found }
 *       '409': { description: Stale revision, preview, reference or operation }
 * /v2/coaching/proposals/{id}/evidence:
 *   get:
 *     summary: Read retained cited evidence
 *     description: Requires the owning app session. API keys and family delegates are rejected. Exact payloads use shared Coaching and MealPlanning Zod contracts.
 *     tags: [Coaching]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: Owner-scoped result }
 *       '400': { description: Invalid typed request }
 *       '403': { description: Identity or selected access rejected }
 *       '404': { description: Owner record not found }
 *       '409': { description: Stale revision, preview, reference or operation }
 * /v2/coaching/actions/{id}:
 *   patch:
 *     summary: Complete a task, skip or stop tracking with owner feedback
 *     description: Requires the owning app session. API keys and family delegates are rejected. Exact payloads use shared Coaching and MealPlanning Zod contracts.
 *     tags: [Coaching]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       '200': { description: Owner-scoped result }
 *       '400': { description: Invalid typed request }
 *       '403': { description: Identity or selected access rejected }
 *       '404': { description: Owner record not found }
 *       '409': { description: Stale revision, preview, reference or operation }
 * /v2/coaching/proposals/{id}:
 *   delete:
 *     summary: Delete inactive recommendation history
 *     description: Requires the owning app session. API keys and family delegates are rejected. Exact payloads use shared Coaching and MealPlanning Zod contracts.
 *     tags: [Coaching]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: Owner-scoped result }
 *       '400': { description: Invalid typed request }
 *       '403': { description: Identity or selected access rejected }
 *       '404': { description: Owner record not found }
 *       '409': { description: Stale revision, preview, reference or operation }
 * /v2/coaching/planned-meals:
 *   get:
 *     summary: Read dated prompt occurrences without materialization
 *     description: Requires the owning app session. API keys and family delegates are rejected. Exact payloads use shared Coaching and MealPlanning Zod contracts.
 *     tags: [Coaching]
 *     responses:
 *       '200': { description: Owner-scoped result }
 *       '400': { description: Invalid typed request }
 *       '403': { description: Identity or selected access rejected }
 *       '404': { description: Owner record not found }
 *       '409': { description: Stale revision, preview, reference or operation }
 * /v2/coaching/planned-meals/prepare:
 *   post:
 *     summary: Explicitly materialize prompt occurrences
 *     description: Requires the owning app session. API keys and family delegates are rejected. Exact payloads use shared Coaching and MealPlanning Zod contracts.
 *     tags: [Coaching]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       '200': { description: Owner-scoped result }
 *       '400': { description: Invalid typed request }
 *       '403': { description: Identity or selected access rejected }
 *       '404': { description: Owner record not found }
 *       '409': { description: Stale revision, preview, reference or operation }
 * /v2/coaching/planned-meals/{id}/confirm:
 *   post:
 *     summary: Confirm actual consumption with an idempotency receipt
 *     description: Requires the owning app session. API keys and family delegates are rejected. Exact payloads use shared Coaching and MealPlanning Zod contracts.
 *     tags: [Coaching]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       '200': { description: Owner-scoped result }
 *       '400': { description: Invalid typed request }
 *       '403': { description: Identity or selected access rejected }
 *       '404': { description: Owner record not found }
 *       '409': { description: Stale revision, preview, reference or operation }
 * /v2/coaching/planned-meals/{id}/skip:
 *   post:
 *     summary: Skip a planned meal without recording intake
 *     description: Requires the owning app session. API keys and family delegates are rejected. Exact payloads use shared Coaching and MealPlanning Zod contracts.
 *     tags: [Coaching]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       '200': { description: Owner-scoped result }
 *       '400': { description: Invalid typed request }
 *       '403': { description: Identity or selected access rejected }
 *       '404': { description: Owner record not found }
 *       '409': { description: Stale revision, preview, reference or operation }
 */
const router = express.Router();
router.use(requireOwnerAppSession);
const plannedMealRangeSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine(
    (input) =>
      input.to >= input.from &&
      Date.parse(input.to) - Date.parse(input.from) <= 93 * 86400_000,
    'Meal plan range must be at most 93 days.'
  );
const handler =
  (work: (req: express.Request) => Promise<unknown>): express.RequestHandler =>
  async (req, res, next) => {
    try {
      res.json(await work(req));
    } catch (error) {
      if (error instanceof z.ZodError)
        res
          .status(400)
          .json({ error: 'Invalid coaching request.', issues: error.issues });
      else if (error instanceof CoachingConflictError)
        res.status(409).json({ error: error.message });
      else if (error instanceof CoachingValidationError)
        res.status(400).json({ error: error.message });
      else if (error instanceof CoachingNotFoundError)
        res.status(404).json({ error: error.message });
      else if (error instanceof CoachingForbiddenError)
        res.status(403).json({ error: error.message });
      else next(error);
    }
  };
/**
 * @openapi
 * /v2/coaching/settings:
 *   get:
 *     summary: Owner app-session coaching schedule and agent connections
 *     tags: [Coaching]
 *     responses:
 *       '200': { description: Feature availability, timezone, settings and connections }
 *       '403': { description: API keys and family delegates cannot review coaching }
 *   patch:
 *     summary: Change review times, wellness access, digest preferences or pause
 *     tags: [Coaching]
 *     responses:
 *       '200': { description: Updated revision }
 *       '409': { description: Stale settings revision }
 */
router.get(
  '/settings',
  handler((req) => getCoachingSettings(req.authenticatedUserId))
);
router.get(
  '/context',
  handler((req) => getCoachingContext(req.authenticatedUserId, null))
);
router.get(
  '/planned-meals',
  handler((req) => {
    const range = plannedMealRangeSchema.parse(req.query);
    return getPlannedMeals(req.authenticatedUserId, range.from, range.to);
  })
);
router.post(
  '/planned-meals/prepare',
  handler((req) => {
    const range = plannedMealRangeSchema.parse(req.body);
    return preparePlannedMeals(req.authenticatedUserId, range.from, range.to);
  })
);
router.post(
  '/planned-meals/:id/confirm',
  handler((req) =>
    confirmPlannedMeal(
      req.authenticatedUserId,
      coachingIdParamsSchema.parse(req.params).id,
      plannedMealConfirmSchema.parse(req.body)
    )
  )
);
router.post(
  '/planned-meals/:id/skip',
  handler((req) =>
    skipPlannedMeal(
      req.authenticatedUserId,
      coachingIdParamsSchema.parse(req.params).id
    )
  )
);
router.patch(
  '/settings',
  handler((req) =>
    patchCoachingSettings(
      req.authenticatedUserId,
      coachingSettingsPatchSchema.parse(req.body)
    )
  )
);
router.post(
  '/agents',
  handler((req) =>
    createCoachingAgent(
      req.authenticatedUserId,
      coachingAgentCreateSchema.parse(req.body)
    )
  )
);
router.post(
  '/agents/:id/key',
  handler((req) =>
    createCoachingCredential(
      req.authenticatedUserId,
      coachingIdParamsSchema.parse(req.params).id,
      coachingCredentialRequestSchema.parse(req.body).expiresIn
    )
  )
);
router.post(
  '/agents/:id/revoke',
  handler(async (req) => {
    await revokeCoachingAgent(
      req.authenticatedUserId,
      coachingIdParamsSchema.parse(req.params).id
    );
    return { revoked: true };
  })
);
router.post(
  '/runs',
  handler((req) => {
    const body = coachingManualRunRequestSchema.parse(req.body);
    return requestCoachingRun(
      req.authenticatedUserId,
      body.operationId,
      body.reconsiderTopics
    );
  })
);
/**
 * @openapi
 * /v2/coaching/inbox:
 *   get:
 *     summary: Paginated recommendation backlog and accepted commitments
 *     tags: [Coaching]
 *     parameters:
 *       - { in: query, name: offset, schema: { type: integer, minimum: 0 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100 } }
 *       - { in: query, name: domain, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: view, schema: { type: string, enum: [pending, active, history] } }
 *     responses:
 *       '200': { description: Impact-sorted proposals, commitments and next page offset }
 */
router.get(
  '/inbox',
  handler(async (req) => {
    requireCoachingEnabled();
    const input = coachingPageQuerySchema.parse(req.query),
      userId = req.authenticatedUserId;
    return coachingTransaction(
      userId,
      async (client) => {
        const proposals = await client.query<CoachingProposalRow>(
          "SELECT p.* FROM coaching_proposals p WHERE p.user_id=$1 AND p.status<>'staged' AND ($2::text IS NULL OR p.domain=$2) AND ($3::text IS NULL OR p.status=$3) AND ($6::text IS NULL OR ($6='pending' AND p.status='pending') OR ($6='history' AND p.status<>'pending') OR ($6='active' AND EXISTS(SELECT 1 FROM coaching_actions a WHERE a.user_id=p.user_id AND a.proposal_id=p.id AND a.status='active'))) ORDER BY (p.data->>'impact')::integer DESC,p.published_at DESC,p.id LIMIT $4 OFFSET $5",
          [
            userId,
            input.domain ?? null,
            input.status ?? null,
            input.limit + 1,
            input.offset,
            input.view ?? null,
          ]
        );
        const actions = await client.query<CoachingActionRow>(
          'SELECT * FROM coaching_actions WHERE user_id=$1 AND proposal_id=ANY($2::uuid[]) ORDER BY activated_at DESC,id',
          [
            userId,
            proposals.rows.slice(0, input.limit).map((proposal) => proposal.id),
          ]
        );
        return coachingInboxSchema.parse({
          proposals: proposals.rows
            .slice(0, input.limit)
            .map(mapCoachingProposal),
          commitments: actions.rows
            .slice(0, input.limit)
            .map(mapCoachingAction),
          nextOffset:
            Math.max(proposals.rows.length, actions.rows.length) > input.limit
              ? input.offset + input.limit
              : null,
        });
      },
      true
    );
  })
);
router.get(
  '/planning',
  handler((req) =>
    getCoachingPlanningContext(
      req.authenticatedUserId,
      null,
      coachingPlanningQuerySchema.parse(req.query)
    )
  )
);
router.get(
  '/proposals/:id/evidence',
  handler((req) =>
    getCoachingProposalEvidence(
      req.authenticatedUserId,
      coachingIdParamsSchema.parse(req.params).id
    )
  )
);
/**
 * @openapi
 * /v2/coaching/proposals/{id}/preview:
 *   post:
 *     summary: Validate an edited typed action and preview exact effects
 *     tags: [Coaching]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       '200': { description: Five-minute preview token, before/after values and overlap warnings }
 *       '409': { description: Recommendation or target changed }
 * /v2/coaching/proposals/{id}/review:
 *   post:
 *     summary: Individually accept or decline with an idempotent owner-session operation
 *     tags: [Coaching]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       '200': { description: Reviewed recommendation; accepted effects committed atomically }
 *       '409': { description: Preview expired, target changed or conflicting retry }
 */
router.post(
  '/proposals/:id/preview',
  handler((req) =>
    previewCoachingProposal(
      req.authenticatedUserId,
      coachingIdParamsSchema.parse(req.params).id,
      coachingPreviewRequestSchema.parse(req.body)
    )
  )
);
router.post(
  '/proposals/:id/review',
  handler((req) =>
    reviewCoachingProposal(
      req.authenticatedUserId,
      coachingIdParamsSchema.parse(req.params).id,
      coachingReviewSchema.parse(req.body)
    )
  )
);
router.patch(
  '/actions/:id',
  handler((req) =>
    patchCoachingCommitment(
      req.authenticatedUserId,
      coachingIdParamsSchema.parse(req.params).id,
      coachingCommitmentPatchSchema.parse(req.body)
    )
  )
);
router.delete(
  '/proposals/:id',
  handler((req) =>
    deleteCoachingProposalHistory(
      req.authenticatedUserId,
      coachingIdParamsSchema.parse(req.params).id
    )
  )
);
export default router;
