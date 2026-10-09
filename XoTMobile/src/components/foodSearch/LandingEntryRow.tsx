import React from 'react';
import MealLibraryRow from '../MealLibraryRow';
import FoodResultRow from './FoodResultRow';
import type { FoodRowSelection } from './FoodResultRow';
import { landingKey } from '../../utils/landingLists';
import type { LandingEntry } from '../../utils/landingLists';
import { mealToFoodInfo } from '../../types/foodInfo';
import type { FoodInfoItem } from '../../types/foodInfo';
import type { FoodItem } from '../../types/foods';
import type { Meal } from '../../types/meals';

interface LandingEntryRowProps {
  entry: LandingEntry;
  profileId?: string;
  favoriteKeys: Set<string>;
  favoriteGold: string;
  onSelect: (item: FoodInfoItem) => void;
  /**
   * Basket selection for multi-add (#1980). Food rows only — a meal row
   * keeps its normal single-tap navigation even while the surrounding list
   * is selecting, so logging a meal stays one tap.
   */
  selection?: FoodRowSelection;
  onQuickAdd?: (food: FoodItem) => void;
  onQuickAddMeal?: (meal: Meal) => void;
  quickAddMealId?: string | null;
}

// A landing row is either a food or a saved meal (tagged with a "Meal" badge
// so it reads as distinct from a food in the merged list).
const LandingEntryRow: React.FC<LandingEntryRowProps> = ({
  entry,
  profileId,
  favoriteKeys,
  favoriteGold,
  onSelect,
  selection,
  onQuickAdd,
  onQuickAddMeal,
  quickAddMealId,
}) => {
  if (entry.kind === 'meal') {
    return (
      <MealLibraryRow
        meal={entry.meal}
        showBadge
        onQuickAdd={
          onQuickAddMeal ? () => onQuickAddMeal(entry.meal) : undefined
        }
        quickAddBusy={quickAddMealId === entry.meal.id}
        showDivider
        isFavorite={favoriteKeys.has(landingKey('meal', entry.meal.id))}
        onPress={() => onSelect(mealToFoodInfo(entry.meal))}
      />
    );
  }
  return (
    <FoodResultRow
      item={entry.food}
      profileId={profileId}
      isFavorite={favoriteKeys.has(landingKey('food', entry.food.id))}
      favoriteGold={favoriteGold}
      onSelect={onSelect}
      selection={selection}
      onQuickAdd={onQuickAdd}
    />
  );
};

export default LandingEntryRow;
