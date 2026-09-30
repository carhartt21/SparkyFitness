import { tool } from 'ai';
import { z } from 'zod';
import { mobilityOperationSchema } from '@workspace/shared';
import {
  getMobilitySnapshot,
  applyMobilityOperation,
} from '../../services/mobilityService.js';
export function buildMobilityTools(userId: string) {
  return {
    xot_get_mobility: tool({
      description:
        'Read owner-only mobility routines, recurring schedules, dated plans and session history. Dates are account-local. Maximum range 93 days.',
      inputSchema: z.object({
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
      }),
      execute: async ({ from, to }) =>
        JSON.stringify(await getMobilitySnapshot(userId, from, to)),
    }),
    xot_update_mobility: tool({
      description:
        'Explicitly create/edit/delete a mobility routine, recurring schedule or dated plan, or record a planned session as completed/skipped. Use expectedRevision from xot_get_mobility, 0 for new items, and a UUID operationId retained across retries. Use result mutations for manual completion; missing step outcomes stay unknown. Active phone sessions cannot be overridden. This never logs exercise calories or Apple Health workouts.',
      inputSchema: mobilityOperationSchema,
      execute: async (operation) =>
        JSON.stringify(await applyMobilityOperation(userId, operation, 'mcp')),
    }),
  };
}
