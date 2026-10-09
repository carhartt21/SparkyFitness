import { z } from "zod";

/** Additive fields on existing favorite food/meal responses. Older servers omit them. */
export const FavoriteUsageFieldsSchema = z.object({
  usage_count_28d: z.number().int().nonnegative().optional(),
  last_used_at: z.string().nullable().optional(),
});
export type FavoriteUsageFields = z.infer<typeof FavoriteUsageFieldsSchema>;

interface RankedFavorite extends FavoriteUsageFields {
  id?: string;
  favorited_at?: string | null;
}
const instant = (value?: string | null) => {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Rolling-window counts are computed by the account-scoped server, never from portions. */
export function compareFavoritePopularity(
  a: RankedFavorite,
  b: RankedFavorite,
): number {
  if (a.usage_count_28d === undefined && b.usage_count_28d === undefined)
    return instant(b.favorited_at) - instant(a.favorited_at);
  return (
    (b.usage_count_28d ?? 0) - (a.usage_count_28d ?? 0) ||
    instant(b.last_used_at) - instant(a.last_used_at) ||
    instant(b.favorited_at) - instant(a.favorited_at) ||
    (a.id ?? "").localeCompare(b.id ?? "")
  );
}
