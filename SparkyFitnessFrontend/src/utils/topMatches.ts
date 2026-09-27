import { rankFoodSearchCandidates } from '@workspace/shared';
import type {
  ExternalResultWrapper,
  ProviderFoodSearchResult,
} from '@/hooks/Foods/useAllProvidersFoodSearch';

export interface TopMatch {
  result: ExternalResultWrapper;
  providerName: string;
  providerId: string;
  broaderAlternative: boolean;
}

export function rankTopMatches(
  providerResults: ProviderFoodSearchResult[],
  query: string,
  limit = 12
): TopMatch[] {
  const candidates = providerResults.flatMap((provider) =>
    provider.items.map((result) => ({
      name: result.food.name,
      brand: result.food.brand,
      barcode: result.food.barcode,
      source: provider.provider.provider_type,
      id:
        result.food.provider_external_id ?? result.food.id ?? result.food.name,
      result,
      providerName: provider.provider.provider_name,
      providerId: provider.provider.id,
    }))
  );
  return rankFoodSearchCandidates(candidates, query)
    .slice(0, limit)
    .map(({ item, broaderAlternative }) => ({
      result: item.result,
      providerName: item.providerName,
      providerId: item.providerId,
      broaderAlternative,
    }));
}
