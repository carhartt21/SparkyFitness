import { tool } from 'ai';
import { z } from 'zod';
import { mobilityOperationSchema } from '@workspace/shared';
import {
  getMobilitySnapshot,
  applyMobilityOperation,
  MobilityConflictError,
  MobilityNotFoundError,
  MobilityValidationError,
} from '../../services/mobilityService.js';
import { toolError } from './errors.js';
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
        'Explicitly create/edit/delete a mobility routine, recurring schedule or dated plan, or record a planned session as completed/skipped. Use expectedRevision from xot_get_mobility, 0 for new items, and a UUID operationId retained across retries. New routines and steps need UUID ids; routines also need ISO createdAt/updatedAt timestamps. Use exerciseId:null for an unlinked custom step; never invent an exercise database ID. Preserve required nullable fields (schedule endDay, plan scheduleId/activeSessionId). Use result mutations for manual completion; missing step outcomes stay unknown. Active phone sessions cannot be overridden. This never logs exercise calories or Apple Health workouts. Explain errors in the user’s language; after conflicts reread before proposing a reconciled change.',
      inputSchema: mobilityOperationSchema,
      execute: async (operation) => {
        try {
          return JSON.stringify(
            await applyMobilityOperation(userId, operation, 'mcp')
          );
        } catch (error) {
          // Domain errors contain fixed, owner-safe messages. Unexpected
          // errors still reach the adapter's sanitized failure/logging path.
          if (error instanceof MobilityConflictError)
            return toolError(
              'CONFLICT',
              error.message,
              'Read xot_get_mobility again. Reconcile the current revision before a new operation; do not blindly retry or overwrite an active phone session.'
            );
          if (error instanceof MobilityNotFoundError)
            return toolError(
              'NOT_FOUND',
              error.message,
              'Read xot_get_mobility and use an existing owner-visible ID.'
            );
          if (error instanceof MobilityValidationError)
            return toolError(
              'VALIDATION',
              error.message,
              'Correct the input before retrying. For a custom step without a saved exercise use exerciseId:null.'
            );
          throw error;
        }
      },
    }),
  };
}
