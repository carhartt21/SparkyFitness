import { z } from 'zod';
import {
  coachingRunClaimSchema,
  coachingSubmitSchema,
  coachingRunReportSchema,
  coachingRunReportV2Schema,
  coachingRecapInputSchema,
} from '@workspace/shared';
import {
  getCoachingContext,
  claimCoachingRun,
  getCoachingSnapshot,
  submitCoachingProposals,
  reportCoachingRun,
  requireCoachingEnabled,
} from '../../services/coachingRunService.js';
import { getCoachingPlanningContext } from '../../services/coachingPlanningService.js';
import { coachingPlanningQuerySchema } from '../../schemas/coachingSchemas.js';
import { log } from '../../config/logging.js';

interface CoachingToolResult extends Record<string, unknown> {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}
export interface CoachingToolRegistrar {
  registerTool(
    name: string,
    config: {
      description: string;
      inputSchema: z.ZodObject<z.ZodRawShape>;
      annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        idempotentHint: boolean;
        openWorldHint: boolean;
      };
    },
    handler: (args: unknown) => Promise<CoachingToolResult>
  ): unknown;
}
/** Agent credentials expose this bounded surface, with no live mutation tools. */
export function registerCoachingTools(
  server: CoachingToolRegistrar,
  userId: string,
  agentId: string,
  authorize: () => Promise<void>,
  canPropose = true,
  version: 1 | 2 = 1
): void {
  const register = <T>(
    name: string,
    description: string,
    schema: z.ZodObject<z.ZodRawShape> & z.ZodType<T>,
    readOnly: boolean,
    work: (args: T) => Promise<unknown>
  ) => {
    server.registerTool(
      name,
      {
        description,
        inputSchema: schema,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (args) => {
        let stage: 'authorization' | 'arguments' | 'operation' =
          'authorization';
        const diagnose = (outcome: 'received' | 'completed' | 'failed') => {
          if (!readOnly)
            log('info', 'Coaching MCP write invocation.', {
              tool: name,
              stage,
              outcome,
            });
        };
        diagnose('received');
        try {
          requireCoachingEnabled();
          await authorize();
          stage = 'arguments';
          const input = schema.parse(args);
          stage = 'operation';
          const result = await work(input);
          const text = JSON.stringify(result);
          diagnose('completed');
          return { content: [{ type: 'text', text }] };
        } catch (error) {
          diagnose('failed');
          const validationError = error instanceof z.ZodError;
          if (validationError && stage !== 'arguments')
            log('error', 'Coaching MCP validation failed.', {
              tool: name,
              stage,
            });
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: validationError
                    ? stage === 'arguments'
                      ? 'Invalid tool arguments.'
                      : 'Coaching operation failed internal validation.'
                    : error instanceof Error
                      ? error.message
                      : 'Coaching operation failed.',
                  ...(validationError
                    ? {
                        code:
                          stage === 'arguments'
                            ? 'invalid_arguments'
                            : 'internal_validation',
                      }
                    : {}),
                }),
              },
            ],
          };
        }
      }
    );
  };
  register(
    'xot_get_coaching_context',
    'Read the selected-domain review schedule, due work, paginated proposals/commitments, decisions and outcomes. Pure read; no run is created. Follow all returned cursors.',
    z.object({
      eventCursor: z.number().int().min(0).optional(),
      proposalOffset: z.number().int().min(0).max(100000).optional(),
      commitmentOffset: z.number().int().min(0).max(100000).optional(),
    }),
    true,
    (args) => getCoachingContext(userId, agentId, { ...args, version })
  );
  register(
    'xot_get_coaching_snapshot',
    'Read a frozen evidence page (50 rows by default). Follow nextOffset until null. Missing/unsynced data is unknown; legacy prefilled food is unconfirmed. Do not add daily active calories to workout calories.',
    z.object({
      snapshotId: z.uuid(),
      offset: z.number().int().min(0).max(100000).default(0),
      limit: z.number().int().min(1).max(100).default(50),
    }),
    true,
    (args) =>
      getCoachingSnapshot(
        userId,
        agentId,
        args.snapshotId,
        args.offset,
        args.limit
      )
  );
  register(
    'xot_get_planning_context',
    'Read accessible real library IDs, serving options, existing plans, habits and routines within selected wellness domains. Search and paginate. No logging or activation occurs.',
    coachingPlanningQuerySchema,
    true,
    (args) => getCoachingPlanningContext(userId, agentId, args)
  );
  if (!canPropose) return;
  register(
    'xot_claim_coaching_run',
    'Explicitly claim the latest eligible daily/weekly/monthly/yearly/manual review and create its immutable evidence snapshot. Pass only operationId (a UUID). Use a fresh UUID for each new claim; reuse it only when retrying that same claim. Returns null if nothing is due or another agent holds a lease.',
    coachingRunClaimSchema,
    false,
    (args) => claimCoachingRun(userId, agentId, args.operationId, version)
  );
  register(
    'xot_submit_coaching_proposals',
    'Stage validated evidence-backed wellness proposals under the claimed lease. Staged proposals are invisible until the run succeeds. This never approves or changes live goals, plans, reminders or diary data.',
    coachingSubmitSchema,
    false,
    (args) => submitCoachingProposals(userId, agentId, args)
  );
  register(
    'xot_report_coaching_run',
    "Write review progress inside the connected owner's private X on Track account. status=heartbeat renews only the run lease; status=failed closes the run and discards its staged proposals; status=succeeded completes the review, saves any supplied owner-only recap and exposes staged proposals for owner review. This does not publish publicly, send messages, log intake, or activate changes to goals, plans, reminders, medications or doses. A successful protocol-2 report requires recap and processedEventCursor equal to the claimed feedbackThrough. Every report requires runId, leaseToken and a stable operationId; reuse the same operationId and payload only for a retry of the same report.",
    version === 2
      ? coachingRunReportV2Schema
      : coachingRunReportSchema.extend({
          recap: coachingRecapInputSchema.optional(),
        }),
    false,
    (args) => reportCoachingRun(userId, agentId, args, version)
  );
}
