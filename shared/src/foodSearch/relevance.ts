/** Small, deterministic text policy shared by the native and web food pickers. */
export type FoodSearchForm =
  "raw" | "cooked" | "dry" | "sauce" | "juice" | "powder";

const ALIASES: Record<string, string> = {
  aepfel: "apfel",
  apfel: "apfel",
  aepfeln: "apfel",
  apfeln: "apfel",
  eier: "ei",
  tomaten: "tomate",
  tomatoes: "tomate",
  tomato: "tomate",
  reis: "reis",
  rice: "reis",
  gekochter: "gekocht",
  gekochte: "gekocht",
  gekochtes: "gekocht",
  cooked: "gekocht",
  boiled: "gekocht",
  raw: "roh",
  uncooked: "ungekocht",
  dried: "trocken",
  dry: "trocken",
  sauce: "sauce",
  soße: "sauce",
  sosse: "sauce",
  juice: "saft",
  powder: "pulver",
};

const FORM_WORDS: Record<FoodSearchForm, readonly string[]> = {
  raw: ["roh", "frisch"],
  cooked: ["gekocht", "gegart", "gedunstet"],
  dry: [
    "trocken",
    "ungekocht",
    "getrocknet",
    "seco",
    "sec",
    "deshidratado",
    "dehydrated",
  ],
  sauce: [
    "sauce",
    "sosse",
    "tomatensauce",
    "frito",
    "molho",
    "salsa",
    "sugo",
    "extrato",
    "extract",
    "paste",
    "mark",
    "konzentrat",
  ],
  juice: ["saft", "juice"],
  powder: ["pulver", "powder", "polvo"],
};

export function normalizeFoodSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function foodSearchTokens(value: string): string[] {
  return normalizeFoodSearchText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ALIASES[token] ?? token);
}

/** Search-a-licious gives word order weight; identity-first phrasing helps
 * reverse-order preparation queries retrieve the same candidates. */
export function foodSearchRetrievalQuery(value: string): string {
  const tokens = foodSearchTokens(value);
  const [first, second] = tokens;
  if (
    tokens.length === 2 &&
    first &&
    second &&
    Object.values(FORM_WORDS).some((words) => words.includes(first)) &&
    !Object.values(FORM_WORDS).some((words) => words.includes(second))
  ) {
    return [second, first].join(" ");
  }
  return tokens.join(" ");
}

function formOf(tokens: readonly string[]): FoodSearchForm | undefined {
  return (Object.keys(FORM_WORDS) as FoodSearchForm[]).find((form) =>
    tokens.some((word) => FORM_WORDS[form].includes(word)),
  );
}

function matchesWord(query: string, candidate: string): boolean {
  return (
    query === candidate || (query.length >= 4 && candidate.startsWith(query))
  );
}

export interface FoodSearchCandidate {
  name: string;
  brand?: string | null;
  barcode?: string | null;
  /** Stable source identity; same names with different records remain distinct. */
  source: string;
  id: string;
  favorite?: boolean;
}

export interface FoodSearchRank<T> {
  item: T;
  score: number;
  exact: boolean;
  broaderAlternative: boolean;
}

export function rankFoodSearchCandidates<T extends FoodSearchCandidate>(
  candidates: readonly T[],
  query: string,
): FoodSearchRank<T>[] {
  const queryTokens = [...new Set(foodSearchTokens(query))];
  if (queryTokens.length === 0) return [];
  const requestedForm = formOf(queryTokens);
  const formWords = new Set(Object.values(FORM_WORDS).flat());
  const identityTokens = queryTokens.filter((word) => !formWords.has(word));
  const barcodeQuery = /^\d{8,14}$/.test(query.trim()) ? query.trim() : null;
  const ranked = candidates
    .flatMap((item, index) => {
      if (barcodeQuery && item.barcode === barcodeQuery) {
        return [
          { item, score: 1000, exact: true, broaderAlternative: false, index },
        ];
      }
      const nameTokens = foodSearchTokens(item.name);
      const brandTokens = foodSearchTokens(item.brand ?? "");
      const nameCoverage = identityTokens.filter((word) =>
        nameTokens.some((candidate) => matchesWord(word, candidate)),
      ).length;
      const brandCoverage = identityTokens.filter((word) =>
        brandTokens.some((candidate) => matchesWord(word, candidate)),
      ).length;
      // A preparation word, image, favorite, or popularity cannot establish food identity.
      if (identityTokens.length > 0 && nameCoverage + brandCoverage === 0)
        return [];
      const candidateForm = formOf(nameTokens);
      const incompatible =
        !!requestedForm && !!candidateForm && requestedForm !== candidateForm;
      const missingForm = !!requestedForm && !candidateForm;
      const fullCoverage = identityTokens.every((word) =>
        [...nameTokens, ...brandTokens].some((candidate) =>
          matchesWord(word, candidate),
        ),
      );
      const exactName = nameTokens.join(" ") === queryTokens.join(" ");
      const identityNameExact =
        nameTokens.join(" ") === identityTokens.join(" ");
      const bareIngredient =
        !requestedForm &&
        identityTokens.length === 1 &&
        !item.brand &&
        (!candidateForm || candidateForm === "raw");
      const score =
        (incompatible ? 0 : 100) +
        (fullCoverage ? 40 : 0) +
        (exactName ? 35 : 0) +
        (identityNameExact ? 20 : 0) +
        nameCoverage * 12 +
        brandCoverage * 5 +
        (requestedForm && candidateForm === requestedForm ? 22 : 0) +
        (bareIngredient ? 12 : 0) +
        (item.favorite && !incompatible ? 3 : 0) -
        (!requestedForm &&
        candidateForm &&
        ["sauce", "juice", "powder"].includes(candidateForm)
          ? 25
          : 0) -
        (missingForm ? 10 : 0) -
        (nameCoverage === 0 ? 80 : 0) -
        nameTokens.length * 2;
      return [
        {
          item,
          score,
          exact: exactName,
          broaderAlternative: incompatible || missingForm,
          index,
        },
      ];
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const seen = new Set<string>();
  return ranked.flatMap(({ index: _index, ...rank }) => {
    const { item } = rank;
    const key = item.barcode
      ? `barcode:${item.barcode}`
      : `${item.source}:${item.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [rank];
  });
}
