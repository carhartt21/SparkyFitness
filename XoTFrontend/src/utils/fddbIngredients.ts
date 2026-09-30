export interface FddbIngredient {
  label: string;
  name: string;
  quantity?: number;
  unit?: string;
}

export const FDDB_PORTION_RE =
  /^\s*(\d+(?:[,.]\d+)?)\s*(g|kg|ml|l|Stk|Stück)\b\s*(.+)$/i;

const UNLINKED_RE =
  /^Unlinked ingredients: ([\s\S]*?)(?=\n(?:Preparation|Original ingredients):|$)/m;

/** Names and percentages contain commas; only a new measured portion separates items. */
export const getFddbIngredients = (notes: string): FddbIngredient[] => {
  if (!/^FDDB import fddb:[0-9a-f]{64}(?:\n|$)/.test(notes)) return [];
  const text = UNLINKED_RE.exec(notes)?.[1]?.trim();
  if (!text) return [];
  return text
    .split(/,\s+(?=\d+(?:[,.]\d+)?\s*[a-zäöüß]+\b\s+\S)/i)
    .map((label) => {
      const match = FDDB_PORTION_RE.exec(label.trim());
      const amount = match ? Number(match[1]?.replace(',', '.')) : 0;
      if (!match || !Number.isFinite(amount) || amount <= 0) {
        return { label: label.trim(), name: label.trim() };
      }
      const originalUnit = match[2]?.toLowerCase();
      const unit =
        originalUnit === 'kg'
          ? 'g'
          : originalUnit === 'l'
            ? 'ml'
            : originalUnit === 'stk' || originalUnit === 'stück'
              ? 'piece'
              : originalUnit;
      return {
        label: label.trim(),
        name: match[3]?.trim() || label.trim(),
        quantity:
          amount * (originalUnit === 'kg' || originalUnit === 'l' ? 1000 : 1),
        unit,
      };
    });
};

/** Keep the source marker for repeat-import detection and preserve the original recipe text. */
export const resolveFddbIngredient = (notes: string, index: number): string => {
  const ingredients = getFddbIngredients(notes);
  if (!ingredients[index]) return notes;
  const remaining = ingredients.filter((_, i) => i !== index);
  const original = /^Original ingredients:/m.test(notes)
    ? ''
    : `Original ingredients: ${ingredients.map((item) => item.label).join(', ')}\n`;
  const unresolved = remaining.length
    ? `Unlinked ingredients: ${remaining.map((item) => item.label).join(', ')}\n`
    : '';
  return notes.replace(UNLINKED_RE, () => `${original}${unresolved}`.trimEnd());
};

export const fddbIngredientSearchTerm = (name: string): string =>
  name.replace(/,\s+/g, ' ').trim();
