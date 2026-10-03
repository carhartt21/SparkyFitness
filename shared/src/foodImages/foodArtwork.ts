import manifest from "./blsArtworkManifest.json" with { type: "json" };
import {
  foodFallbackGroup,
  openFoodFactsArtworkSlug,
} from "./fallbackGroup.ts";
import type { FoodArtworkKey } from "./blsArtworkRules.ts";

export interface FoodArtworkIdentity {
  provider_type?: string | null;
  provider_external_id?: string | null;
}

const blsArtwork = new Map<string, FoodArtworkKey>();
for (const [key, codes] of Object.entries(manifest.by_artwork)) {
  for (const code of codes as string[])
    blsArtwork.set(code, key as FoodArtworkKey);
}

/** A locale-independent display layer. It never changes provider photos,
 * saved food data, catalogue nutrition, or diary snapshots. */
export function foodArtworkKey(
  name: string | null | undefined,
  isMeal = false,
  foodGroupTags?: readonly string[] | null,
  identity?: FoodArtworkIdentity | null,
): FoodArtworkKey {
  if (isMeal) return "group:meals";
  if (identity?.provider_type === "bls4" && identity.provider_external_id) {
    const artwork = blsArtwork.get(identity.provider_external_id);
    if (artwork) return artwork;
  }
  const off = openFoodFactsArtworkSlug(foodGroupTags);
  if (off) return `off:${off}`;
  return `group:${foodFallbackGroup(name, false, foodGroupTags)}`;
}
