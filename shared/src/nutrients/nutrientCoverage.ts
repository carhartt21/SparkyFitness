import { z } from "zod";

export const nutrientCoverageSchema = z.record(
  z.string(),
  z.record(
    z.string(),
    z.object({
      knownEntryCount: z.number().int().nonnegative(),
      eligibleEntryCount: z.number().int().nonnegative(),
      recordedTotal: z.number().finite().nonnegative().nullable(),
      unit: z.string(),
    }),
  ),
);
export type NutrientCoverage = z.infer<typeof nutrientCoverageSchema>;

/** A recorded partial total is useful; days with no known values are excluded. */
export function averageRecordedNutrient(
  coverage: NutrientCoverage,
  catalogId: string,
): number | null {
  const totals = Object.values(coverage).flatMap((day) =>
    day[catalogId]?.recordedTotal == null
      ? []
      : [day[catalogId]!.recordedTotal!],
  );
  return totals.length
    ? totals.reduce((mean, amount) => mean + amount / totals.length, 0)
    : null;
}
