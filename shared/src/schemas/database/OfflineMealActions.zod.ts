import { z } from "zod";
export const offlineMealActionsSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  client_operation_id: z.uuid(),
  request_fingerprint: z.string().length(64),
  entry_date: z.date(),
  meal_entry_id: z.uuid().nullable(),
  created_at: z.date(),
});
export type OfflineMealActions = z.infer<typeof offlineMealActionsSchema>;
