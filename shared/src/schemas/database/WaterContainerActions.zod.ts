import { z } from "zod";

export const waterContainerActionsSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  client_operation_id: z.uuid(),
  request_fingerprint: z.string().length(64),
  entry_date: z.date(),
  container_id: z.number().int(),
  logged_at: z.date(),
  water_ml: z.number(),
  water_log_id: z.uuid().nullable(),
  food_entry_id: z.uuid().nullable(),
  created_at: z.date(),
});

export type WaterContainerActions = z.infer<typeof waterContainerActionsSchema>;
