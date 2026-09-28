import { foodFallbackGroup, openFoodFactsArtworkSlug } from '@workspace/shared';

/** Bundled artwork only. It is never added to a food's persisted images. */
export function foodFallbackImageSrc(
  name: string | null | undefined,
  isMeal = false,
  foodGroupTags?: readonly string[] | null
): string {
  if (!isMeal) {
    const slug = openFoodFactsArtworkSlug(foodGroupTags);
    if (slug) return `/images/off-food-groups/${slug}.webp`;
  }
  return `/images/food-fallbacks/${foodFallbackGroup(name, isMeal, foodGroupTags)}.webp`;
}
