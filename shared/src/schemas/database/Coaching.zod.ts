import { z } from "zod";
import {
  coachingSettingsSchema,
  coachingDomainSchema,
  coachingRunStatusSchema,
  coachingProposalInputSchema,
  coachingActionSchema,
  coachingProposalStatusSchema,
  coachingActionStatusSchema,
  coachingEvidenceRowSchema,
} from "../api/Coaching.api.zod.ts";

import {
  coachingSettingsV2Schema,
  coachingRunKindV2Schema,
  coachingContextPermissionSchema,
  coachingRecapInputSchema,
} from "../api/CoachingV2.api.zod.ts";

const user_id = z.uuid();
const id = z.uuid();
const date = z.date();
export const coachingSettingsDatabaseSchema = z.object({
  user_id,
  revision: z.number().int(),
  data: z.union([
    coachingSettingsSchema.omit({ revision: true }),
    coachingSettingsV2Schema.omit({ revision: true }),
  ]),
  reconsider_topics: z.array(z.string()),
  completed_slots: z.record(z.string(), z.string()).optional(),
  updated_at: date,
});
export const coachingAgentDatabaseSchema = z.object({
  id,
  user_id,
  name: z.string(),
  domains: z.array(coachingDomainSchema),
  enabled: z.boolean(),
  key_id: z.string().nullable(),
  oauth_client_id: z.string().nullable(),
  expires_at: date.nullable(),
  last_seen_at: date.nullable(),
  created_at: date,
  protocol_version: z.union([z.literal(1), z.literal(2)]).optional(),
  context_permissions: z.array(coachingContextPermissionSchema).optional(),
  processed_event_cursor: z.union([z.string(), z.number()]).optional(),
});
export const coachingRunDatabaseSchema = z.object({
  id,
  user_id,
  agent_id: id.nullable(),
  kind: coachingRunKindV2Schema,
  slot_key: z.string(),
  from_day: z.union([z.string(), date]),
  to_day: z.union([z.string(), date]),
  status: coachingRunStatusSchema,
  lease_token_hash: z.string().nullable(),
  lease_until: date.nullable(),
  started_at: date.nullable(),
  finished_at: date.nullable(),
  attempt_count: z.number().int(),
  feedback_cursor: z.union([z.string(), z.number()]).optional(),
  feedback_through: z.union([z.string(), z.number()]).optional(),
  failure_code: z.string().nullable(),
  created_at: date,
});
export const coachingSnapshotDatabaseSchema = z.object({
  id,
  user_id,
  run_id: id,
  from_day: z.union([z.string(), date]),
  to_day: z.union([z.string(), date]),
  rows: z.array(coachingEvidenceRowSchema),
  warnings: z.array(z.string()),
  created_at: date,
});
export const coachingProposalDatabaseSchema = z.object({
  id,
  user_id,
  run_id: id,
  agent_id: id,
  snapshot_id: id,
  revision: z.number().int(),
  topic: z.string(),
  domain: coachingDomainSchema,
  status: coachingProposalStatusSchema,
  data: coachingProposalInputSchema,
  evidence: z.array(coachingEvidenceRowSchema),
  expires_day: z.union([z.string(), date]),
  created_at: date,
  published_at: date.nullable(),
  reviewed_at: date.nullable(),
  review_reason: z.string().nullable(),
  activation_id: id.nullable(),
  accepted_action: coachingActionSchema.nullable(),
});
export const coachingActionDatabaseSchema = z.object({
  id,
  user_id,
  proposal_id: id,
  revision: z.number().int(),
  status: coachingActionStatusSchema,
  data: coachingActionSchema,
  success: coachingProposalInputSchema.shape.success,
  activation_refs: z.array(z.object({ domain: z.string(), id: z.string() })),
  outcome: z.json().nullable(),
  activated_at: date,
  updated_at: date,
});
export const coachingEventDatabaseSchema = z.object({
  sequence: z.union([z.string(), z.number()]),
  user_id,
  proposal_id: id.nullable(),
  action_id: id.nullable(),
  kind: z.string(),
  data: z.json(),
  created_at: date,
});
export const coachingOperationDatabaseSchema = z.object({
  user_id,
  operation_id: id,
  agent_id: id.nullable(),
  request_hash: z.string(),
  result: z.json(),
  created_at: date,
});
export type CoachingSettingsRow = z.infer<
  typeof coachingSettingsDatabaseSchema
>;
export type CoachingAgentRow = z.infer<typeof coachingAgentDatabaseSchema>;
export type CoachingRunRow = z.infer<typeof coachingRunDatabaseSchema>;
export type CoachingSnapshotRow = z.infer<
  typeof coachingSnapshotDatabaseSchema
>;
export type CoachingProposalRow = z.infer<
  typeof coachingProposalDatabaseSchema
>;
export type CoachingActionRow = z.infer<typeof coachingActionDatabaseSchema>;
export type CoachingEventRow = z.infer<typeof coachingEventDatabaseSchema>;
export const coachingPreviewDatabaseSchema = z.object({
  user_id: z.uuid(),
  token: z.string(),
  proposal_id: z.uuid(),
  revision: z.number().int(),
  action: coachingActionSchema,
  state_hash: z.string(),
  expires_at: z.date(),
});

// Database parity names follow the physical table names.
export const coachingAgentsSchema = coachingAgentDatabaseSchema;
export const coachingRunsSchema = coachingRunDatabaseSchema;
export const coachingSnapshotsSchema = coachingSnapshotDatabaseSchema;
export const coachingProposalsSchema = coachingProposalDatabaseSchema;
export const coachingActionsSchema = coachingActionDatabaseSchema;
export const coachingEventsSchema = coachingEventDatabaseSchema;
export const coachingOperationsSchema = coachingOperationDatabaseSchema;
export const coachingPreviewsSchema = coachingPreviewDatabaseSchema;

export const coachingRecapsSchema = z.object({
  id,
  user_id,
  source_run_id: id,
  kind: coachingRunKindV2Schema,
  from_day: z.union([z.string(), date]),
  to_day: z.union([z.string(), date]),
  data: coachingRecapInputSchema,
  evidence: z.array(coachingEvidenceRowSchema),
  proposal_ids: z.array(id),
  created_at: date,
  read_at: date.nullable(),
});
export type CoachingRecapRow = z.infer<typeof coachingRecapsSchema>;
