/**
 * Nutrient-name normalization used to match online-provider nutrient fields
 * against a user's custom nutrient names and aliases.
 *
 * Matching is case-insensitive and ignores punctuation/diacritics/whitespace
 * differences, so the user can enter aliases like "Magnesium, Mg" and still
 * match a provider field reported as "magnesium" or "Magnesium (mg)".
 *
 * Canonical source shared by the server (provider import) and the web client.
 */
export function normalizeNutrientName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Normalize a provider's unit string (e.g. USDA "UG", OFF "µg") into the form a
// user would type for a custom nutrient. Unknown units pass through trimmed.
const NUTRIENT_UNIT_ALIASES: Record<string, string> = {
  g: "g",
  mg: "mg",
  ug: "µg",
  µg: "µg",
  μg: "µg",
  mcg: "µg",
  kcal: "kcal",
  kj: "kJ",
  iu: "IU",
};

export function normalizeNutrientUnit(unit: string): string {
  const trimmed = unit.trim();
  return NUTRIENT_UNIT_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

// Decimal exponents relative to grams, for converting a provider's amount into the unit a
// user chose for their custom nutrient (e.g. USDA "g" -> user "mg").
const MASS_EXPONENT: Record<string, number> = {
  kg: 3,
  g: 0,
  mg: -3,
  µg: -6,
  ng: -9,
};

// kJ per unit, for energy custom nutrients.
const ENERGY_TO_KJ: Record<string, number> = {
  kj: 1,
  kcal: 4.184,
};

/**
 * Convert a nutrient amount from one unit to another when they're in the same
 * convertible family (mass or energy). Returns null when conversion isn't safe
 * — unknown units, cross-family, or substance-specific units like IU. Callers
 * must leave the value unmapped on failure rather than relabel its raw amount.
 */
export function convertNutrientAmount(
  value: number,
  fromUnit: string | undefined,
  toUnit: string | undefined,
): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  if (!fromUnit || !toUnit) return null;
  const from = normalizeNutrientUnit(fromUnit).toLowerCase();
  const to = normalizeNutrientUnit(toUnit).toLowerCase();
  if (!from || !to) return null;
  const fromMass = MASS_EXPONENT[from];
  const toMass = MASS_EXPONENT[to];
  const fromKj = ENERGY_TO_KJ[from];
  const toKj = ENERGY_TO_KJ[to];
  const factor =
    fromMass !== undefined && toMass !== undefined
      ? 10 ** (fromMass - toMass)
      : fromKj !== undefined && toKj !== undefined
        ? fromKj / toKj
        : null;
  if (factor === null) return null;
  const converted = value * factor;
  return Number.isFinite(converted) && (value === 0 || converted > 0)
    ? converted
    : null;
}
