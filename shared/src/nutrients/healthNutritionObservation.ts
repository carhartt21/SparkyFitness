import {
  healthNutritionObservationSchema,
  type HealthNutrientQuantity,
  type HealthMicronutrientId,
  type HealthNutritionObservation,
} from "../schemas/api/HealthNutrition.api.zod.ts";

export type HealthNutrientSnapshot = Partial<
  Record<HealthMicronutrientId, HealthNutrientQuantity>
>;

/**
 * Reconcile one source record, not a mutable food variant or the user's day.
 * Identity/form validation and unit resolution must succeed before persistence.
 * This is not an authorization check for authoritative source assertions.
 */
export function reconcileHealthNutritionObservation(
  previous: Readonly<HealthNutrientSnapshot>,
  observation: HealthNutritionObservation | undefined,
): HealthNutrientSnapshot {
  const next = { ...previous };
  if (observation === undefined) return next; // legacy clients preserve history
  const parsed = healthNutritionObservationSchema.parse(observation);
  if (parsed.mode === "authoritative") {
    for (const id of parsed.coveredCatalogIds) delete next[id];
  }
  for (const quantity of parsed.quantities) next[quantity.catalogId] = quantity;
  return next;
}
