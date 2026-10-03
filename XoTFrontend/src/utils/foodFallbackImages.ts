import { foodArtworkKey, type FoodArtworkIdentity } from '@workspace/shared';

/** Bundled artwork only. It is never added to a food's persisted images. */
export function foodFallbackImageSrc(
  name: string | null | undefined,
  isMeal = false,
  foodGroupTags?: readonly string[] | null,
  identity?: FoodArtworkIdentity | null
): string {
  const key = foodArtworkKey(name, isMeal, foodGroupTags, identity);
  if (key.startsWith('food:'))
    return `/images/food-artwork/${key.slice(5)}.webp`;
  if (key.startsWith('off:'))
    return `/images/off-food-groups/${key.slice(4)}.webp`;
  return `/images/food-fallbacks/${key.slice(6)}.webp`;
}
