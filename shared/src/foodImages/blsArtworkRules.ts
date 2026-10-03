import type { FoodFallbackGroup } from "./fallbackGroup.ts";

/** Representative illustrations, not provider photos or nutritional metadata. */
export const SPECIFIC_FOOD_ARTWORK = [
  "tomato-raw",
  "tomato-sauce",
  "apple-raw",
  "rice-dry",
  "rice-cooked",
  "rice-brown-dry",
  "rice-brown-cooked",
  "tomato-cooked",
  "tomato-dried",
  "mushrooms",
] as const;

export type SpecificFoodArtwork = (typeof SPECIFIC_FOOD_ARTWORK)[number];
export type FoodArtworkKey =
  | `group:${FoodFallbackGroup}`
  | `off:${string}`
  | `food:${SpecificFoodArtwork}`;

export interface BlsArtworkFood {
  code: string;
  name_de: string;
  name_en: string;
}

export interface BlsArtworkClassification {
  key: FoodArtworkKey;
  basis: "specific" | "subgroup" | "group" | "neutral";
}

/** Verified against the pinned 4.0 archive. Subgroups are essential: E includes
 * eggs AND pasta, H includes nuts AND pulses, and K includes roots AND fungi.
 * Never infer preparation from the numerical suffix using the older BLS rules. */
const MAIN_GROUPS: Readonly<Record<string, FoodFallbackGroup>> = {
  B: "bread",
  C: "grains",
  D: "pastries",
  E: "pasta",
  F: "fruit",
  G: "vegetables",
  H: "legumes",
  K: "potatoes",
  M: "dairy",
  N: "drinks",
  P: "alcohol",
  Q: "oils",
  R: "condiments",
  S: "sweets",
  T: "seafood",
  U: "meat",
  V: "meat",
  W: "processed_meat",
  X: "meals",
  Y: "meals",
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function classifyBlsFoodArtwork(
  food: BlsArtworkFood,
): BlsArtworkClassification {
  const name = normalize(food.name_de);
  const family = food.code.charAt(0);
  const subgroup = food.code.slice(0, 2);
  const group = (
    value: FoodFallbackGroup,
    basis: BlsArtworkClassification["basis"] = "subgroup",
  ): BlsArtworkClassification => ({ key: `group:${value}`, basis });
  const off = (slug: string): BlsArtworkClassification => ({
    key: `off:${slug}`,
    basis: "subgroup",
  });
  const specific = (slug: SpecificFoodArtwork): BlsArtworkClassification => ({
    key: `food:${slug}`,
    basis: "specific",
  });

  // These are deliberately narrow. A preparation mention in a mixed dish
  // cannot turn it into a photograph of an ordinary ingredient.
  if (family === "G" && /^tomate roh$/.test(name))
    return specific("tomato-raw");
  if (family === "G" && /^tomate(?: |,)/.test(name) && /getrocknet/.test(name))
    return specific("tomato-dried");
  if (
    family === "G" &&
    /^tomate(?: |,)/.test(name) &&
    /gekocht|gedunstet|geschmort|gebraten|gegrillt|gebacken/.test(name)
  )
    return specific("tomato-cooked");
  if (family === "F" && /^apfel roh$/.test(name)) return specific("apple-raw");
  if (family === "C" && /^reis (?:parboiled, )?poliert, roh$/.test(name))
    return specific("rice-dry");
  if (family === "C" && /^reis unpoliert, roh$/.test(name))
    return specific("rice-brown-dry");
  if (family === "C" && /^reis unpoliert, gekocht$/.test(name))
    return specific("rice-brown-cooked");
  if (
    (family === "C" &&
      /^reis (?:parboiled, )?poliert, (?:gekocht|gedampft|geschmort ohne fett)$/.test(
        name,
      )) ||
    (family === "X" && name === "reis gekocht")
  )
    return specific("rice-cooked");
  if (
    (family === "R" || family === "X") &&
    /^tomaten(?:sauce|sosse| passiert|pur[e]?e)/.test(name) &&
    !/fleisch|wurst|sahne|kase|grundsauce|aubergine|zucchini|paprika/.test(name)
  )
    return specific("tomato-sauce");

  if (family === "E") return group(subgroup === "E1" ? "eggs" : "pasta");
  if (family === "K" && subgroup === "K7")
    return { key: "food:mushrooms", basis: "group" };
  // Additives, starches and isolated powders have no suitable food photograph.
  if (family === "R" && ["R4", "R5"].includes(subgroup))
    return group("generic", "neutral");
  if (["G", "N", "M"].includes(family) && /pulver/.test(name))
    return group("generic", "neutral");
  if (
    (family === "K" || family === "C") &&
    /(?:starke|mehl|kleie|instantpulver)/.test(name)
  )
    return group("generic", "neutral");
  if (family === "K" && subgroup === "K8")
    return /suppe/.test(name) ? off("dehydrated-soups") : group("condiments");
  if (family === "H") {
    if (["H1", "H2"].includes(subgroup)) return group("nuts");
    if (["H3", "H4"].includes(subgroup)) return group("nuts");
    if (["H5", "H6"].includes(subgroup)) return group("vegetables");
    if (/^(?:erdnussbutter|erdnusscreme|nussmus)/.test(name))
      return off("nut-butter");
    if (subgroup === "H9") return group("meals");
    if (subgroup === "H0")
      return /^glasnudel/.test(name)
        ? group("pasta")
        : group("generic", "neutral");
  }
  if (family === "M" && ["M0", "M3", "M4", "M5", "M6", "M7"].includes(subgroup))
    return group("cheese");
  if (family === "N" && ["N4", "N5", "N6", "N7"].includes(subgroup))
    return group("hot_drinks");
  if (family === "N" && subgroup === "N1")
    return off("waters-and-flavored-waters");
  if (family === "Q" && subgroup === "Q9")
    return /^tahin/.test(name) ? off("nut-butter") : group("condiments");
  if (family === "S") {
    if (/^honig|^blutenhonig|^honigtauhonig/.test(name)) return group("honey");
    if (subgroup === "S2") return group("ice_cream");
  }
  if (family === "F") {
    if (/saft|nektar/.test(name)) return off("fruit-juices");
    if (/getrocknet|^rosine|^bananenchips/.test(name))
      return off("dried-fruits");
    if (/^cashewnussmus/.test(name)) return off("nut-butter");
  }
  if (family === "G" && /saft/.test(name)) return off("unsweetened-beverages");
  if (family === "C" && /^(?:musli|muesli|cornflakes)/.test(name))
    return group("cereals");
  if (family === "D") {
    if (/^(?:salzbrezel|salzstange|kartoffelchip|cracker)/.test(name))
      return group("salty_snacks");
    if (["D1", "D2", "D3", "D4", "D6", "D7"].includes(subgroup))
      return off("biscuits-and-cakes");
  }
  if (family === "X" || family === "Y") {
    const identity = name.split(/[,()]/)[0] ?? "";
    if (/suppe|bruhe|eintopf/.test(identity)) return group("soups");
    if (/sauce|sosse/.test(identity)) return group("condiments");
    // "Curryreis" also ends in "eis"; verify the canonical English food
    // identity rather than confusing rice with a frozen dessert.
    if (
      /eis$|cremeeis|sorbet/.test(identity) &&
      /\b(?:ice|sorbet)\b/.test(food.name_en.toLowerCase())
    )
      return group("ice_cream");
    if (/^(?:sandwich|belegtes brot|belegtes brotchen)/.test(identity))
      return group("sandwiches");
  }
  const fallback = MAIN_GROUPS[family];
  return fallback ? group(fallback, "group") : group("generic", "neutral");
}
