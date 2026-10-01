import { z } from "zod";
export const activityPlanResolutionsSchema = z.object({
  user_id: z.uuid(),
  occurrence_id: z.string(),
  local_day: z.iso.date(),
  revision: z.number().int().positive(),
  action: z.enum(["skip", "link", "undo"]),
  record_id: z.uuid().nullable(),
  entry_id: z.uuid().nullable(),
  updated_at: z.iso.datetime({ offset: true }),
});
export type ActivityPlanResolution = z.infer<
  typeof activityPlanResolutionsSchema
>;
