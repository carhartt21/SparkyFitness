import type { TFunction } from 'i18next';

/** Localized label for system meal types; custom meal types keep their name. */
export function mealTypeLabel(t: TFunction, name: string): string {
  switch (name.toLowerCase()) {
    case 'breakfast':
      return t('common.breakfast', 'Breakfast');
    case 'lunch':
      return t('common.lunch', 'Lunch');
    case 'dinner':
      return t('common.dinner', 'Dinner');
    case 'snacks':
      return t('common.snacks', 'Snacks');
    default:
      return name;
  }
}
