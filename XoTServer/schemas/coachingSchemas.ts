import { z } from 'zod';
import {
  coachingDomainSchema,
  coachingPlanningItemSchema,
  coachingProposalStatusSchema,
} from '@workspace/shared';
export const coachingIdParamsSchema = z.strictObject({ id: z.uuid() });
export const coachingPageQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  domain: coachingDomainSchema.optional(),
  status: coachingProposalStatusSchema.exclude(['staged']).optional(),
  view: z.enum(['pending', 'active', 'history']).optional(),
});
export const coachingPlanningQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  kind: coachingPlanningItemSchema.shape.kind.optional(),
  search: z.string().trim().max(120).optional(),
});
export const coachingManualRunRequestSchema = z.strictObject({
  operationId: z.uuid(),
  reconsiderTopics: z
    .array(z.string().trim().min(1).max(120))
    .max(100)
    .default([]),
});
export const coachingCredentialRequestSchema = z.strictObject({
  expiresIn: z.number().int().min(86400).max(31536000).default(7776000),
});
