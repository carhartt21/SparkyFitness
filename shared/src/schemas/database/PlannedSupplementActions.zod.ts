import { z } from "zod";

export const plannedSupplementActionsSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  client_operation_id: z.uuid(),
  medication_id: z.uuid().nullable(),
  schedule_id: z.uuid().nullable(),
  occurrence_schedule_id: z.uuid(),
  entry_date: z.date(),
  status: z.enum(["taken", "skipped"]),
  occurred_at: z.date(),
  request_fingerprint: z.string().length(64),
  entry_id: z.uuid().nullable(),
  created_at: z.date(),
});

export type PlannedSupplementActions = z.infer<
  typeof plannedSupplementActionsSchema
>;
