/** Visual-only groups for foods whose own image is missing. Never persist these
 * guesses as food metadata or treat the artwork as a photo of the product. */
export type FoodFallbackGroup =
  | "vegetables"
  | "fruit"
  | "bread"
  | "grains"
  | "dairy"
  | "eggs"
  | "meat"
  | "seafood"
  | "legumes"
  | "nuts"
  | "drinks"
  | "sweets"
  | "condiments"
  | "meals"
  | "generic";

function words(name: string): string[] {
  return name
    .toLocaleLowerCase("de")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function has(tokens: string[], stems: readonly string[]): boolean {
  return tokens.some((token) =>
    stems.some((stem) => token === stem || token.startsWith(stem)),
  );
}

function hasSuffix(tokens: string[], suffixes: readonly string[]): boolean {
  return tokens.some((token) =>
    suffixes.some((suffix) => token.endsWith(suffix)),
  );
}

/** Conservative name classification because foods/provider results have no
 * shared category field. Specific dish and drink forms take precedence. */
export function foodFallbackGroup(
  name: string | null | undefined,
  isMeal = false,
): FoodFallbackGroup {
  if (isMeal) return "meals";
  const tokens = words(name ?? "");
  if (tokens.length === 0) return "generic";
  if (
    has(tokens, [
      "wasser",
      "water",
      "saft",
      "juice",
      "smoothie",
      "kaffee",
      "coffee",
      "tee",
      "tea",
      "cola",
      "soda",
      "limonade",
      "lemonade",
      "bier",
      "beer",
      "wein",
      "wine",
      "drink",
      "getrank",
    ]) ||
    hasSuffix(tokens, ["wasser", "saft", "juice", "kaffee", "tee"])
  )
    return "drinks";
  if (
    has(tokens, [
      "sauce",
      "sosse",
      "frito",
      "ketchup",
      "dressing",
      "mayonnaise",
      "senf",
      "mustard",
      "pesto",
    ]) ||
    hasSuffix(tokens, ["sauce", "sosse"])
  )
    return "condiments";
  if (
    has(tokens, [
      "suppe",
      "soup",
      "pizza",
      "burger",
      "sandwich",
      "curry",
      "eintopf",
      "stew",
      "auflauf",
      "casserole",
      "lasagn",
      "chili",
      "salad",
      "gericht",
      "meal",
      "bowl",
      "gratin",
      "milchreis",
      "risotto",
      "porridge",
    ]) ||
    hasSuffix(tokens, ["curry", "suppe", "salat"]) ||
    tokens.includes("salat")
  )
    return "meals";
  if (
    has(tokens, [
      "schokolad",
      "chocolat",
      "bonbon",
      "candy",
      "keks",
      "cookie",
      "kuchen",
      "cake",
      "muffin",
      "dessert",
      "eiscreme",
      "icecream",
      "pudding",
    ]) ||
    hasSuffix(tokens, ["kuchen", "cake"])
  )
    return "sweets";
  if (
    has(tokens, [
      "fisch",
      "fish",
      "lachs",
      "salmon",
      "thunfisch",
      "tuna",
      "garnel",
      "shrimp",
      "prawn",
      "meeresfrucht",
      "seafood",
    ])
  )
    return "seafood";
  if (
    has(tokens, [
      "hahnchen",
      "huhn",
      "chicken",
      "rind",
      "beef",
      "schwein",
      "pork",
      "pute",
      "turkey",
      "schinken",
      "ham",
      "wurst",
      "sausage",
      "fleisch",
      "meat",
    ])
  )
    return "meat";
  if (
    has(tokens, ["eier", "omelett", "omelet", "ruhrei", "spiegelei"]) ||
    tokens.includes("ei") ||
    tokens.includes("egg") ||
    tokens.includes("eggs")
  )
    return "eggs";
  if (
    has(tokens, [
      "milch",
      "milk",
      "joghurt",
      "yogurt",
      "yoghurt",
      "kase",
      "cheese",
      "quark",
      "skyr",
      "kefir",
      "sahne",
      "cream",
    ])
  )
    return "dairy";
  if (
    has(tokens, [
      "bohne",
      "bean",
      "linse",
      "lentil",
      "kichererbse",
      "chickpea",
      "tofu",
      "tempeh",
    ])
  )
    return "legumes";
  if (
    has(tokens, [
      "nuss",
      "nut",
      "mandel",
      "almond",
      "walnuss",
      "walnut",
      "erdnuss",
      "peanut",
      "samen",
      "seed",
    ])
  )
    return "nuts";
  if (
    has(tokens, [
      "brot",
      "bread",
      "brotchen",
      "toast",
      "bagel",
      "croissant",
      "bun",
      "backware",
    ]) ||
    hasSuffix(tokens, ["brot", "brotchen"])
  )
    return "bread";
  if (
    has(tokens, [
      "reis",
      "rice",
      "hafer",
      "oat",
      "nudel",
      "pasta",
      "quinoa",
      "couscous",
      "bulgur",
      "muesli",
      "musli",
      "cereal",
    ])
  )
    return "grains";
  if (
    has(tokens, [
      "tomat",
      "karott",
      "mohre",
      "carrot",
      "gurke",
      "cucumber",
      "paprika",
      "pepper",
      "spinat",
      "spinach",
      "brokkoli",
      "broccoli",
      "kohl",
      "cabbage",
      "zucchini",
      "salatblatt",
      "lettuce",
      "vegetable",
      "gemuse",
    ])
  )
    return "vegetables";
  if (
    has(tokens, [
      "apfel",
      "apple",
      "banane",
      "banana",
      "beere",
      "berry",
      "erdbeer",
      "strawberr",
      "birne",
      "pear",
      "orange",
      "traube",
      "grape",
      "kiwi",
      "pfirsich",
      "peach",
      "mango",
      "obst",
      "fruit",
    ])
  )
    return "fruit";
  return "generic";
}
