import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  foodSearchComparison,
  type SearchNutrientServing,
} from '../../utils/foodSearchComparison';

export default function FoodNutritionComparison({
  serving,
}: {
  serving: SearchNutrientServing;
}) {
  const { t, i18n } = useTranslation();
  const comparison = foodSearchComparison(serving);
  const format = (value: number | null, digits = 1) =>
    value === null
      ? '—'
      : new Intl.NumberFormat(i18n.language, {
          maximumFractionDigits: digits,
        }).format(value);
  const basis =
    comparison.basis === '100g'
      ? t('foodSearch.comparison.per100g', { defaultValue: 'per 100 g' })
      : comparison.basis === '100ml'
        ? t('foodSearch.comparison.per100ml', { defaultValue: 'per 100 ml' })
        : t('foodSearch.comparison.perServing', {
            defaultValue: 'per serving',
          });
  return (
    <View className="mt-1">
      <Text className="text-text-primary text-sm font-semibold">
        {t('foodSearch.comparison.energy', {
          defaultValue: '{{value}} kcal {{basis}}',
          value: format(comparison.calories, 0),
          basis,
        })}
      </Text>
      <Text className="text-text-secondary text-xs">
        {t('foodSearch.comparison.macros', {
          defaultValue: 'P {{protein}} g   C {{carbs}} g   F {{fat}} g',
          protein: format(comparison.protein),
          carbs: format(comparison.carbs),
          fat: format(comparison.fat),
        })}
      </Text>
    </View>
  );
}
