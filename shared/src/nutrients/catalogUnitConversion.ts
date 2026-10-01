import {
  convertNutrientAmount,
  normalizeNutrientUnit,
} from "../utils/nutrientMatching.ts";

/** Vitamin D only: NIH ODS defines 1 µg = 40 IU.
 * https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/
 * Other IU conversions require chemical-form evidence and remain unsupported.
 */
export function convertCatalogNutrientAmount(
  catalogId: string,
  amount: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  const from = normalizeNutrientUnit(fromUnit);
  const to = normalizeNutrientUnit(toUnit);
  if (from !== "IU" && to !== "IU")
    return convertNutrientAmount(amount, from, to);
  if (catalogId !== "vitamin_d" || !Number.isFinite(amount) || amount < 0)
    return null;
  if (from === "IU" && to === "IU") return amount;
  if (from === "IU") return convertNutrientAmount(amount / 40, "µg", to);
  const micrograms = convertNutrientAmount(amount, from, "µg");
  if (micrograms === null || !Number.isFinite(micrograms * 40)) return null;
  return micrograms * 40;
}
