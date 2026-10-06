import { z } from "zod";

/** Receipt for completed-workout CSV imports. Range covers successful saves only. */
export const hevyCsvImportResultSchema = z.object({
  submitted: z.number().int().nonnegative(),
  imported: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.array(z.object({ id: z.string(), message: z.string() })),
  savedRoutinesIncluded: z.literal(false),
  importedDateRange: z
    .object({ from: z.iso.date(), to: z.iso.date() })
    .optional(),
});
export type HevyCsvImportResult = z.infer<typeof hevyCsvImportResultSchema>;
