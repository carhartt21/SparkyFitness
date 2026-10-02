import { z } from "zod";

// Two clients (web, mobile) hand-roll these request/response shapes today
// (XoTFrontend/src/api/Diary/waterIntakteService.ts). Phase 4
// (#1557, #1629) adds a third field both must read (food_ml), which is the
// trigger to make this a real shared contract instead of a fourth copy.

export const upsertWaterIntakeBodySchema = z.object({
  user_id: z.string(),
  entry_date: z.string(),
  change_drinks: z.number(),
  container_id: z.number().nullable(),
});
export type UpsertWaterIntakeBody = z.infer<typeof upsertWaterIntakeBodySchema>;

// The day-totals endpoint returns a single aggregated object. `manual_ml`,
// `ledger_ml` and `food_ml` are the breakdown added in Phase 4; they are
// optional because an older server (or a day fetched before this feature
// shipped) omits them. Numeric fields accept string because pg's numeric
// type round-trips as a string over JSON.
export const waterIntakeDayTotalsSchema = z.object({
  water_ml: z.union([z.number(), z.string()]),
  manual_ml: z.union([z.number(), z.string()]).optional(),
  ledger_ml: z.union([z.number(), z.string()]).optional(),
  food_ml: z.union([z.number(), z.string()]).optional(),
  source: z.string().optional(),
});
export type WaterIntakeDayTotals = z.infer<typeof waterIntakeDayTotalsSchema>;

export const containerWaterActionBodySchema = z.strictObject({
  client_operation_id: z.uuid(),
  entry_date: z.iso.date(),
  container_id: z.number().int().positive(),
  logged_at: z.iso.datetime({ offset: true }),
});
export type ContainerWaterActionBody = z.infer<
  typeof containerWaterActionBodySchema
>;

export const containerWaterActionResponseSchema = z.object({
  waterLogId: z.uuid().nullable(),
  foodEntryId: z.uuid().nullable(),
  waterMl: z.number(),
  alreadyApplied: z.boolean(),
  totals: waterIntakeDayTotalsSchema,
});
export type ContainerWaterActionResponse = z.infer<
  typeof containerWaterActionResponseSchema
>;

// #2115: a "-" on a linked container removes its food entry too. Optional --
// only present when at least one removed row was linked, and absent on a
// server predating the container-food link.
export const upsertWaterIntakeResponseSchema = waterIntakeDayTotalsSchema
  .extend({
    removedFoodEntryIds: z.array(z.string()).optional(),
  })
  .or(z.array(z.unknown())); // legacy per-source array shape, still tolerated
export type UpsertWaterIntakeResponse = z.infer<
  typeof upsertWaterIntakeResponseSchema
>;

export const waterIntakeLogEntrySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  entry_date: z.string(),
  water_ml: z.number(),
  container_id: z.number().nullable(),
  container_name: z.string().nullable(),
  source: z.string(),
  source_id: z.string().nullable().optional(),
  created_at: z.string(),
  logged_at: z.string(),
  // #2115: set when this drink was logged by a linked container.
  food_entry_id: z.string().nullable().optional(),
  hydration_factor: z.number().nullable().optional(),
});
export type WaterIntakeLogEntry = z.infer<typeof waterIntakeLogEntrySchema>;

/** Included drinking water plus separately reported solid-food water. */
export const hydrationSourceTotalsSchema = z.object({
  water_ml: z.number(),
  manual_ml: z.number(),
  ledger_ml: z.number(),
  /** Legacy field: included water derived from food/supplement snapshots, not solids. */
  food_ml: z.number(),
  exportable_food_ml: z.number().optional(),
  drink_ml: z.number(),
  supplement_ml: z.number(),
  solid_food_ml: z.number(),
  unknown_count: z.number().int().nonnegative(),
});
export type HydrationSourceTotals = z.infer<typeof hydrationSourceTotalsSchema>;
export const hydrationSourceEntrySchema = z.object({
  id: z.string(),
  entry_date: z.iso.date(),
  kind: z.enum(["water", "drink", "supplement", "food", "imported"]),
  name: z.string().nullable(),
  water_ml: z.number().nullable(),
  logged_at: z.string().nullable(),
  source: z.string().nullable(),
  water_entry_id: z.string().nullable(),
  food_entry_id: z.string().nullable(),
  medication_id: z.string().nullable(),
  amount_basis: z.enum(["recorded", "volume", "unknown", "daily_total"]),
  counts_toward_goal: z.boolean(),
});
export type HydrationSourceEntry = z.infer<typeof hydrationSourceEntrySchema>;
export const hydrationDayDetailsSchema = z.object({
  date: z.iso.date(),
  timezone: z.string(),
  totals: hydrationSourceTotalsSchema,
  entries: z.array(hydrationSourceEntrySchema),
});
export type HydrationDayDetails = z.infer<typeof hydrationDayDetailsSchema>;
