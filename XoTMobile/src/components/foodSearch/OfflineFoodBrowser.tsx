import { useMemo, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Button from '../ui/Button';
import Icon from '../Icon';
import StatusView from '../StatusView';
import QuickAddFoodSheet, {
  type QuickAddFoodSheetRef,
} from './QuickAddFoodSheet';
import { useCachedNutritionFavorites } from '../../hooks/useCachedNutritionFavorites';
import { formatLocalizedNumber } from '../../localization';
import { formatLocalizedUnitQuantity } from '../../utils/foodUnitLocalization';
import type { NutritionFavoriteCache } from '../../services/nutritionFavoriteCache';
import type { NutritionActionIdentity } from '../../services/nutritionActionOutbox';
import type { FoodItem } from '../../types/foods';
import type { OfflineMealSnapshot } from '@workspace/shared';
import { offlineMealAsFood } from '../../services/offlineMealSnapshot';

type OfflineFoodItem = FoodItem & { offlineMeal?: OfflineMealSnapshot };

interface Props {
  search: string;
  favoritesOnly: boolean;
  date: string;
  mealTypeId?: string;
  onLogged?: () => void;
}

function CachedFoodList({
  cache,
  identity,
  search,
  favoritesOnly,
  date,
  mealTypeId,
  onLogged,
}: Props & {
  cache: NutritionFavoriteCache;
  identity: NutritionActionIdentity;
}) {
  const { t } = useTranslation();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const sheet = useRef<QuickAddFoodSheetRef>(null);
  const [selectedMeal, setSelectedMeal] = useState<OfflineMealSnapshot>();
  const foods = useMemo<OfflineFoodItem[]>(() => {
    const candidates = favoritesOnly
      ? cache.foods
      : [...(cache.savedFoods ?? []), ...cache.foods];
    const query = search.trim().toLocaleLowerCase();
    const entries: OfflineFoodItem[] = [
      ...[...new Map(candidates.map((food) => [food.id, food])).values()].map(
        (food) => ({ ...food, is_custom: false })
      ),
      ...(cache.meals ?? [])
        .filter(
          (meal) => !favoritesOnly || cache.favoriteMealIds?.includes(meal.id)
        )
        .map((meal) => ({ ...offlineMealAsFood(meal), offlineMeal: meal })),
    ];
    return entries
      .filter((food) =>
        `${food.name} ${food.brand ?? ''}`.toLocaleLowerCase().includes(query)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cache, favoritesOnly, search]);
  const canLog = cache.mealTypes.some((meal) => meal.is_visible);

  return (
    <View className="flex-1" testID="offline-food-browser">
      <View className="mx-4 mb-3 flex-row items-start gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-3">
        <Icon name="cloud-offline" size={20} color={accent} />
        <Text className="min-w-0 flex-1 text-sm text-text-secondary">
          {t('foodSearch.offline.notice', {
            defaultValue:
              'Offline · Choose a saved food or meal. Entries stay on this device until they can sync.',
          })}
        </Text>
      </View>
      {!canLog ? (
        <Text
          className="mx-4 mb-3 text-sm text-text-secondary"
          accessibilityRole="alert"
        >
          {t('foodSearch.offline.missingMealTypes', {
            defaultValue:
              'Connect once to load your meal categories before logging offline.',
          })}
        </Text>
      ) : null}
      <FlatList
        data={foods}
        ItemSeparatorComponent={() => (
          <View className="h-px bg-border-subtle" />
        )}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName="px-4 pb-safe-or-4"
        keyExtractor={(food) =>
          `${food.offlineMeal ? 'meal' : 'food'}-${food.id}`
        }
        ListEmptyComponent={
          <Text className="py-8 text-center text-base text-text-secondary">
            {search.trim()
              ? t('foodSearch.offline.noMatch', {
                  defaultValue:
                    'No matching food or meal saved on this device.',
                })
              : t('foodSearch.offline.empty', {
                  defaultValue:
                    'No foods or meals saved on this device yet. Open your library and favorites while connected first.',
                })}
          </Text>
        }
        renderItem={({ item }) => (
          <Button
            variant="ghost"
            tone="neutral"
            testID={`offline-${item.offlineMeal ? 'meal' : 'food'}-${item.id}`}
            disabled={!canLog}
            accessibilityLabel={t('foodSearch.offline.choose', {
              defaultValue: 'Choose portion for {{food}}',
              food: item.name,
            })}
            onPress={() => {
              setSelectedMeal(item.offlineMeal);
              sheet.current?.present(item);
            }}
            className="min-h-16 flex-row items-center gap-3 py-3"
          >
            <View className="min-w-0 flex-1">
              <Text className="text-base font-semibold text-text-primary">
                {item.name}
              </Text>
              {item.brand ? (
                <Text className="text-sm text-text-secondary">
                  {item.brand}
                </Text>
              ) : null}
              {item.offlineMeal ? (
                <Text className="text-xs text-text-secondary">
                  {t('foodSearch.offline.mealIngredients', {
                    defaultValue: 'Saved meal · {{count}} ingredients',
                    count: item.offlineMeal.foods.length,
                  })}
                </Text>
              ) : null}
              <Text className="mt-1 text-xs text-text-secondary">
                {t('foodSearch.offline.portion', {
                  defaultValue: '{{amount}} · {{calories}} kcal',
                  amount: formatLocalizedUnitQuantity(
                    item.default_variant.serving_size,
                    item.default_variant.serving_unit,
                    t
                  ),
                  calories: formatLocalizedNumber(
                    item.default_variant.calories,
                    { maximumFractionDigits: 0 }
                  ),
                })}
              </Text>
            </View>
            <Icon name="add" size={22} color={accent} />
          </Button>
        )}
      />
      <QuickAddFoodSheet
        ref={sheet}
        offline={{ identity, mealTypes: cache.mealTypes, meal: selectedMeal }}
        date={date}
        mealTypeId={mealTypeId}
        onMoreOptions={() => undefined}
        onLogged={onLogged}
      />
    </View>
  );
}

export default function OfflineFoodBrowser(props: Props) {
  const { t } = useTranslation();
  const { cache, identity, isLoading, storageError } =
    useCachedNutritionFavorites();
  if (isLoading) return <StatusView loading />;
  if (storageError || !cache || !identity)
    return (
      <Text
        className="mx-6 mt-8 text-center text-base text-text-secondary"
        accessibilityRole="alert"
      >
        {storageError
          ? t('foodSearch.offline.cacheError', {
              defaultValue:
                'Saved foods and meals could not be read. Your stored entries have not been changed.',
            })
          : t('foodSearch.offline.signIn', {
              defaultValue:
                'Sign in while connected once to make foods and meals available offline.',
            })}
      </Text>
    );
  // A server/account switch unmounts the old portion sheet as well as its list.
  return (
    <CachedFoodList
      key={`${identity.serverConfigId}/${identity.userId}`}
      {...props}
      cache={cache}
      identity={identity}
    />
  );
}
