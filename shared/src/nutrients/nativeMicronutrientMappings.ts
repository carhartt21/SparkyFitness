import type { HealthMicronutrientId } from "../schemas/api/HealthNutrition.api.zod.ts";

/** Read capability inventory. Units are supplied by the native sample, not guessed. */
export const NATIVE_MICRONUTRIENT_MAPPINGS = [
  {
    catalogId: "vitamin_a",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryVitaminA",
    healthConnectField: "vitaminA",
  },
  {
    catalogId: "vitamin_c",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryVitaminC",
    healthConnectField: "vitaminC",
  },
  {
    catalogId: "thiamin",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryThiamin",
    healthConnectField: "thiamin",
  },
  {
    catalogId: "riboflavin",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryRiboflavin",
    healthConnectField: "riboflavin",
  },
  {
    catalogId: "niacin",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryNiacin",
    healthConnectField: "niacin",
  },
  {
    catalogId: "pantothenic_acid",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryPantothenicAcid",
    healthConnectField: "pantothenicAcid",
  },
  {
    catalogId: "vitamin_b6",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryVitaminB6",
    healthConnectField: "vitaminB6",
  },
  {
    catalogId: "biotin",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryBiotin",
    healthConnectField: "biotin",
  },
  {
    catalogId: "vitamin_b12",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryVitaminB12",
    healthConnectField: "vitaminB12",
  },
  {
    catalogId: "folate",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryFolate",
    healthConnectField: "folate",
  },
  {
    catalogId: "vitamin_d",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryVitaminD",
    healthConnectField: "vitaminD",
  },
  {
    catalogId: "vitamin_e",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryVitaminE",
    healthConnectField: "vitaminE",
  },
  {
    catalogId: "vitamin_k",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryVitaminK",
    healthConnectField: "vitaminK",
  },
  {
    catalogId: "calcium",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryCalcium",
    healthConnectField: "calcium",
  },
  {
    catalogId: "iron",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryIron",
    healthConnectField: "iron",
  },
  {
    catalogId: "potassium",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryPotassium",
    healthConnectField: "potassium",
  },
  {
    catalogId: "sodium",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietarySodium",
    healthConnectField: "sodium",
  },
  {
    catalogId: "chloride",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryChloride",
    healthConnectField: "chloride",
  },
  {
    catalogId: "chromium",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryChromium",
    healthConnectField: "chromium",
  },
  {
    catalogId: "copper",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryCopper",
    healthConnectField: "copper",
  },
  {
    catalogId: "iodine",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryIodine",
    healthConnectField: "iodine",
  },
  {
    catalogId: "magnesium",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryMagnesium",
    healthConnectField: "magnesium",
  },
  {
    catalogId: "manganese",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryManganese",
    healthConnectField: "manganese",
  },
  {
    catalogId: "molybdenum",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryMolybdenum",
    healthConnectField: "molybdenum",
  },
  {
    catalogId: "phosphorus",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryPhosphorus",
    healthConnectField: "phosphorus",
  },
  {
    catalogId: "selenium",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietarySelenium",
    healthConnectField: "selenium",
  },
  {
    catalogId: "zinc",
    healthKitIdentifier: "HKQuantityTypeIdentifierDietaryZinc",
    healthConnectField: "zinc",
  },
] as const satisfies readonly {
  catalogId: HealthMicronutrientId;
  healthKitIdentifier: string;
  healthConnectField: string;
}[];
