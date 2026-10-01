import { z } from "zod";
import { normalizeNutrientUnit } from "../../utils/nutrientMatching.ts";

/** Collection scope; source-specific form eligibility is decided by adapters. */
export const HEALTH_MICRONUTRIENT_IDS = [
  "vitamin_a",
  "vitamin_c",
  "thiamin",
  "riboflavin",
  "niacin",
  "pantothenic_acid",
  "vitamin_b6",
  "biotin",
  "vitamin_b12",
  "folate",
  "vitamin_d",
  "vitamin_e",
  "vitamin_k",
  "calcium",
  "iron",
  "potassium",
  "sodium",
  "chloride",
  "chromium",
  "copper",
  "iodine",
  "magnesium",
  "manganese",
  "molybdenum",
  "phosphorus",
  "selenium",
  "zinc",
] as const;

export const healthMicronutrientIdSchema = z.enum(HEALTH_MICRONUTRIENT_IDS);
export type HealthMicronutrientId = z.infer<typeof healthMicronutrientIdSchema>;

export const healthNutrientQuantitySchema = z.strictObject({
  catalogId: healthMicronutrientIdSchema,
  amount: z.number().finite().nonnegative(),
  unit: z
    .enum(["kg", "g", "mg", "µg", "μg", "ug", "mcg", "ng"])
    .transform(normalizeNutrientUnit),
});
export type HealthNutrientQuantity = z.infer<
  typeof healthNutrientQuantitySchema
>;

const quantities = z
  .array(healthNutrientQuantitySchema)
  .max(HEALTH_MICRONUTRIENT_IDS.length);

/**
 * Completeness is scoped to catalog IDs, never to the entire custom nutrient map.
 * Native loose queries cannot establish absence and must use partial mode.
 * Authoritative mode requires trusted source evidence at the ingestion boundary.
 */
export const healthNutritionObservationSchema = z
  .discriminatedUnion("mode", [
    z.strictObject({ mode: z.literal("partial"), quantities }),
    z.strictObject({
      mode: z.literal("authoritative"),
      coveredCatalogIds: z
        .array(healthMicronutrientIdSchema)
        .max(HEALTH_MICRONUTRIENT_IDS.length),
      quantities,
    }),
  ])
  .superRefine((observation, ctx) => {
    const seen = new Set<HealthMicronutrientId>();
    observation.quantities.forEach((quantity, index) => {
      if (seen.has(quantity.catalogId)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate nutrient quantity",
          path: ["quantities", index, "catalogId"],
        });
      }
      seen.add(quantity.catalogId);
      if (
        observation.mode === "authoritative" &&
        !observation.coveredCatalogIds.includes(quantity.catalogId)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Quantity outside authoritative coverage",
          path: ["quantities", index, "catalogId"],
        });
      }
    });
    if (
      observation.mode === "authoritative" &&
      new Set(observation.coveredCatalogIds).size !==
        observation.coveredCatalogIds.length
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate coverage identifier",
        path: ["coveredCatalogIds"],
      });
    }
  });
export type HealthNutritionObservation = z.infer<
  typeof healthNutritionObservationSchema
>;
