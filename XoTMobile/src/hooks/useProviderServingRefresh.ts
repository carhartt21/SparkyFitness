import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FoodInfoItem } from '../types/foodInfo';
import type { FoodVariantDetail } from '../types/foods';
import type { NutritionActionIdentity } from '../services/nutritionActionOutbox';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import { createFoodVariant, fetchFoodVariants } from '../services/api/foodsApi';
import { fetchExternalFoodDetails } from '../services/api/externalFoodSearchApi';
import { useAppLocale } from '../localization';
import { foodVariantsQueryKey } from './queryKeys';
import { invalidateFoodCache } from './invalidateFoodCache';
import { missingProviderServings } from '../utils/providerServingRefresh';

/** Bounded, owner-scoped metadata import when opening an old provider food. */
export function useProviderServingRefresh(
  food: FoodInfoItem | undefined,
  enabled: boolean
) {
  const client = useQueryClient();
  const language = useAppLocale();
  const [identity, setIdentity] = useState<NutritionActionIdentity | null>(
    null
  );
  useEffect(() => {
    let generation = 0;
    let mounted = true;
    const refresh = async () => {
      const request = ++generation;
      try {
        const next = await getActiveNutritionIdentity();
        if (mounted && request === generation) setIdentity(next);
      } catch {
        if (mounted && request === generation) setIdentity(null);
      }
    };
    void refresh();
    const stop = subscribeNutritionIdentity(() => {
      setIdentity(null);
      void refresh();
    });
    return () => {
      mounted = false;
      generation++;
      stop();
    };
  }, []);
  const eligible =
    enabled &&
    food?.source === 'local' &&
    food.provider_type === 'openfoodfacts' &&
    !!food.provider_external_id &&
    !!identity &&
    food.userId === identity.userId;
  const query = useQuery({
    queryKey: [
      'providerServingRefresh',
      1,
      identity?.serverConfigId,
      identity?.userId,
      food?.id,
      food?.provider_external_id,
      language,
    ],
    enabled: eligible,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      if (!food || !identity || food.userId !== identity.userId)
        throw new Error('Food owner changed');
      const publish = async (
        variants: FoodVariantDetail[],
        changed: boolean
      ) => {
        const active = await getActiveNutritionIdentity();
        if (
          active?.serverConfigId !== identity.serverConfigId ||
          active.userId !== identity.userId
        )
          return;
        // Discard any older in-flight variant read before publishing newly appended rows.
        void client.cancelQueries({ queryKey: foodVariantsQueryKey(food.id) });
        client.setQueryData(foodVariantsQueryKey(food.id), variants);
        if (changed) invalidateFoodCache(client);
      };
      const existing = await fetchFoodVariants(food.id, identity);
      // Existing countable portions already work offline; avoid unnecessary provider traffic.
      if (
        existing.some(
          (variant) =>
            variant.metric_unit &&
            Number(variant.metric_amount) > 0 &&
            !['g', 'ml'].includes(variant.serving_unit.toLowerCase())
        )
      ) {
        await publish(existing, false);
        return existing;
      }
      const details = await fetchExternalFoodDetails(
        'openfoodfacts',
        food.provider_external_id!,
        undefined,
        undefined,
        language
      );
      // Re-read before appending so another screen's newly saved choices are preserved.
      const current = await fetchFoodVariants(food.id, identity);
      const missing = missingProviderServings(
        food.id,
        current,
        details.variants ?? []
      );
      if (!missing.length) {
        await publish(current, false);
        return current;
      }
      const appended: FoodVariantDetail[] = [];
      try {
        for (const portion of missing)
          appended.push(await createFoodVariant(portion, identity));
      } finally {
        // A later portion failure must not hide a successfully stored earlier portion.
        if (appended.length) await publish([...current, ...appended], true);
      }
      return [...current, ...appended];
    },
  });
  return {
    isLoading: eligible && query.isLoading,
    isError: eligible && query.isError,
    retry: query.refetch,
  };
}
