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
        try {
          requireCoachingEnabled();
          await authorize();
          const result = await work(schema.parse(args));
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error:
                    error instanceof z.ZodError
                      ? 'Invalid tool arguments.'
                      : error instanceof Error
                        ? error.message
                        : 'Coaching operation failed.',
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
    'Explicitly claim the latest eligible daily/weekly/monthly/yearly/manual review and create its immutable evidence snapshot. Returns null if nothing is due or another agent holds a lease. Stable operationId makes retries safe.',
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
    'Renew a run lease, report failure, or atomically publish a typed recap and all staged proposals on successful completion. A failed run publishes nothing. Every report requires a stable operationId.',
    version === 2
      ? coachingRunReportV2Schema
      : coachingRunReportSchema.extend({
          recap: coachingRecapInputSchema.optional(),
        }),
    false,
    (args) => reportCoachingRun(userId, agentId, args, version)
  );
}
