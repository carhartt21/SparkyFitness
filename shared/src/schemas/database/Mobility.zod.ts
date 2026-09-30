import { z } from "zod";
import {
  mobilityRoutineSchema,
  mobilityScheduleSchema,
  mobilityPlanSchema,
  mobilitySessionSchema,
} from "../api/Mobility.api.zod.ts";
const row = z.object({
  user_id: z.uuid(),
  id: z.uuid(),
  revision: z.number().int().positive(),
  deleted: z.boolean(),
  updated_at: z.date(),
});
export const mobilityRoutineDatabaseSchema = row.extend({
  data: mobilityRoutineSchema,
});
export const mobilityScheduleDatabaseSchema = row.extend({
  data: mobilityScheduleSchema,
  routine_id: z.uuid(),
});
export const mobilityPlanDatabaseSchema = row.extend({
  data: mobilityPlanSchema,
  schedule_id: z.uuid().nullable(),
  local_day: z.iso.date(),
});
export const mobilitySessionDatabaseSchema = row.extend({
  data: mobilitySessionSchema,
  plan_id: z.uuid().nullable(),
  provenance: z.enum(["phone", "web", "mcp", "import"]),
});
export const mobilityOperationDatabaseSchema = z.object({
  user_id: z.uuid(),
  operation_id: z.uuid(),
  request_fingerprint: z.string().length(64),
  result: z.unknown(),
  created_at: z.date(),
});
