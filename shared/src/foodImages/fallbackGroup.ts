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
  | "potatoes"
  | "cereals"
  | "oils"
  | "salty_snacks"
  | "soups"
  | "cheese"
  | "ice_cream"
  | "pastries"
  | "sandwiches"
  | "hot_drinks"
  | "plant_drinks"
  | "pasta"
  | "processed_meat"
  | "baby_food"
  | "alcohol"
  | "honey"
  | "generic";

/** Open Food Facts food_groups_tags are derived from its category taxonomy.
 * The tags run broad-to-specific, so the last recognized group supplies the
 * most useful image. Broad or unknown groups defer to name classification. */
const OFF_GROUPS: Record<string, FoodFallbackGroup> = {
  "unknown-food-group-1": "generic",
  "unknown-food-group-2": "generic",
  "unknown-food-group-3": "generic",
  "fruits-and-vegetables": "generic",
  fruits: "fruit",
  "dried-fruits": "fruit",
  vegetables: "vegetables",
  soups: "soups",
  "dehydrated-soups": "soups",
  "fresh-soups": "soups",
  "cereals-and-potatoes": "generic",
  cereals: "grains",
  "whole-grain-pasta": "pasta",
  "whole-grain-rice": "grains",
  "white-rice": "grains",
  "white-pasta": "pasta",
  "other-whole-grain-cereals": "grains",
  "other-refined-cereals": "grains",
  bread: "bread",
  "whole-grain-bread": "bread",
  "white-bread": "bread",
  "whole-grain-soft-bread": "bread",
  "white-soft-bread": "bread",
  potatoes: "potatoes",
  legumes: "legumes",
  "breakfast-cereals": "cereals",
  "milk-and-dairy-products": "dairy",
  "dairy-desserts": "dairy",
  cheese: "cheese",
  "blue-cheese": "cheese",
  "hard-cheese": "cheese",
  "soft-cheese": "cheese",
  "fresh-cheese": "cheese",
  "processed-cheese": "cheese",
  "ice-cream": "ice_cream",
  "milk-and-yogurt": "dairy",
  "plain-milk-and-yogurt": "dairy",
  "sweetened-milk-and-yogurt": "dairy",
  "fish-meat-eggs": "generic",
  offals: "meat",
  "processed-meat": "processed_meat",
  eggs: "eggs",
  "fish-and-seafood": "seafood",
  "lean-fish": "seafood",
  "fatty-fish": "seafood",
  "smoked-fish": "seafood",
  seafood: "seafood",
  meat: "meat",
  poultry: "meat",
  "meat-other-than-poultry": "meat",
  "sugary-snacks": "sweets",
  "chocolate-products": "sweets",
  "dark-chocolate": "sweets",
  "milk-chocolate": "sweets",
  "white-chocolate": "sweets",
  "other-chocolate-based-products": "sweets",
  sweets: "sweets",
  "biscuits-and-cakes": "sweets",
  pastries: "pastries",
  "salty-snacks": "salty_snacks",
  nuts: "nuts",
  "unsalted-nuts": "nuts",
  "salted-nuts": "nuts",
  "nut-butter": "nuts",
  appetizers: "salty_snacks",
  "salty-and-fatty-products": "salty_snacks",
  "fats-and-sauces": "generic",
  fats: "oils",
  "animal-fats": "oils",
  "vegetable-oils": "oils",
  "vegetable-margarines": "oils",
  "dressings-and-sauces": "condiments",
  dressings: "condiments",
  sauces: "condiments",
  "composite-foods": "meals",
  "pizza-pies-and-quiches": "meals",
  "one-dish-meals": "meals",
  sandwiches: "sandwiches",
  beverages: "drinks",
  "artificially-sweetened-beverages": "drinks",
  "unsweetened-beverages": "drinks",
  "sweetened-beverages": "drinks",
  "fruit-juices": "drinks",
  "fruit-nectars": "drinks",
  "waters-and-flavored-waters": "drinks",
  "teas-and-herbal-teas-and-coffees": "hot_drinks",
  "plant-based-milk-substitutes": "plant_drinks",
  "alcoholic-beverages": "alcohol",
  "baby-foods-and-milks": "baby_food",
  "baby-foods": "baby_food",
  "baby-milks": "baby_food",
};

export function openFoodFactsFallbackGroup(
  foodGroupTags: readonly string[] | null | undefined,
): FoodFallbackGroup | null {
  let match: FoodFallbackGroup | null = null;
  for (const tag of foodGroupTags ?? []) {
    if (!tag.startsWith("en:")) continue;
    const group = OFF_GROUPS[tag.slice(3)];
    if (group) match = group;
  }
  return match;
}

/** Selects a distinct artwork for each substantive OFF food group. The three
 * unknown placeholders intentionally defer to the name/neutral fallback. */
export function openFoodFactsArtworkSlug(
  foodGroupTags: readonly string[] | null | undefined,
): string | null {
  let match: string | null = null;
  for (const tag of foodGroupTags ?? []) {
    if (!tag.startsWith("en:")) continue;
    const slug = tag.slice(3);
    if (
      Object.prototype.hasOwnProperty.call(OFF_GROUPS, slug) &&
      !slug.startsWith("unknown-food-group-")
    ) {
      match = slug;
    }
  }
  return match;
}

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

/** Open Food Facts supplies groups; other providers and saved foods use a
 * conservative name fallback. Specific forms take precedence. */
export function foodFallbackGroup(
  name: string | null | undefined,
  isMeal = false,
  foodGroupTags?: readonly string[] | null,
): FoodFallbackGroup {
  if (isMeal) return "meals";
  const offGroup = openFoodFactsFallbackGroup(foodGroupTags);
  if (offGroup && offGroup !== "generic") return offGroup;
  const tokens = words(name ?? "");
  if (tokens.length === 0) return "generic";
  if (has(tokens, ["honig", "honey"])) return "honey";
  if (
    has(tokens, ["suppe", "soup", "eintopf", "stew"]) ||
    hasSuffix(tokens, ["suppe"])
  )
    return "soups";
  if (has(tokens, ["babybrei", "babynahrung", "babyfood", "infantformula"]))
    return "baby_food";
  if (
    has(tokens, [
      "bier",
      "beer",
      "wein",
      "wine",
      "whisky",
      "whiskey",
      "vodka",
      "gin",
    ])
  )
    return "alcohol";
  if (
    has(tokens, [
      "kaffee",
      "coffee",
      "espresso",
      "cappuccino",
      "latte",
      "tee",
      "tea",
    ])
  )
    return "hot_drinks";
  if (
    has(tokens, [
      "hafermilch",
      "oatmilk",
      "sojamilch",
      "soymilk",
      "mandelmilch",
      "almondmilk",
    ])
  )
    return "plant_drinks";
  if (
    has(tokens, [
      "olivenol",
      "sonnenblumenol",
      "speiseol",
      "oliveoil",
      "vegetableoil",
      "margarine",
    ])
  )
    return "oils";
  if (has(tokens, ["kartoffel", "potato", "pommes", "fries"]))
    return "potatoes";
  if (
    has(tokens, [
      "kase",
      "cheese",
      "cheddar",
      "gouda",
      "mozzarella",
      "parmesan",
    ])
  )
    return "cheese";
  if (has(tokens, ["eiscreme", "icecream", "gelato", "sorbet"]))
    return "ice_cream";
  if (has(tokens, ["sandwich", "panini", "wrap"])) return "sandwiches";
  if (
    has(tokens, ["nudel", "pasta", "spaghetti", "penne", "fusilli", "macaroni"])
  )
    return "pasta";
  if (has(tokens, ["muesli", "musli", "cornflakes", "cereal", "granola"]))
    return "cereals";
  if (has(tokens, ["wurst", "sausage", "salami", "schinken", "ham", "bacon"]))
    return "processed_meat";
  if (has(tokens, ["chips", "crisp", "pretzel", "salzstange"]))
    return "salty_snacks";
  if (
    has(tokens, ["croissant", "donut", "doughnut", "blatterteig", "puffpastry"])
  )
    return "pastries";
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
