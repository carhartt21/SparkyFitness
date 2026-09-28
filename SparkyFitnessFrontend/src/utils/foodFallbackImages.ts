import { foodFallbackGroup } from '@workspace/shared';

/** Bundled artwork only. It is never added to a food's persisted images. */
export function foodFallbackImageSrc(
  name: string | null | undefined,
  isMeal = false,
  foodGroupTags?: readonly string[] | null
): string {
  return `/images/food-fallbacks/${foodFallbackGroup(name, isMeal, foodGroupTags)}.webp`;
}
