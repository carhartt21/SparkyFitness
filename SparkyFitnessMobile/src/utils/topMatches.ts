import { rankFoodSearchCandidates } from '@workspace/shared';
import type { ExternalFoodItem } from '../types/externalFoods';
import type { ProviderSearchResult } from '../hooks/useAllProvidersSearch';

export interface TopMatch {
  online: ExternalFoodItem;
  providerName: string;
  providerId: string;
  broaderAlternative: boolean;
}

/** Rank all retrieved source candidates together; keep distinct nutrient records. */
export function rankTopMatches(
  providerResults: ProviderSearchResult[],
  query: string,
  limit = 12
): TopMatch[] {
  const candidates = providerResults.flatMap((result) =>
    result.items.map((online) => ({
      name: online.name,
      brand: online.brand,
      barcode: online.barcode,
      source: result.provider.provider_type,
      id: online.provider_external_id ?? online.id,
      online,
      providerName: result.provider.provider_name,
      providerId: result.provider.id,
    }))
  );
  return rankFoodSearchCandidates(candidates, query)
    .slice(0, limit)
    .map(({ item, broaderAlternative }) => ({
      online: item.online,
      providerName: item.providerName,
      providerId: item.providerId,
      broaderAlternative,
    }));
}
