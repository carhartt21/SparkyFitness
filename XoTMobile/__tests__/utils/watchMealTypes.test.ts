import { buildWatchMealTypes } from '../../src/utils/watchFoodShortcuts';
import i18n, { initializeI18n } from '../../src/localization/i18n';

const systemMeals = [
  { id: 'review-breakfast', name: 'Breakfast', user_id: null },
  { id: 'review-lunch', name: 'Lunch', user_id: null },
  { id: 'review-dinner', name: 'Dinner', user_id: null },
  { id: 'review-snack', name: 'Snack', user_id: null },
];

describe('Watch meal labels', () => {
  beforeEach(async () => {
    await initializeI18n('de');
    await i18n.changeLanguage('de');
  });

  it('sends German system names without changing logging IDs', () => {
    const payload = buildWatchMealTypes(systemMeals, i18n.t);
    expect(payload.map((meal) => meal.name)).toEqual([
      'Frühstück',
      'Mittagessen',
      'Abendessen',
      'Snacks',
    ]);
    expect(payload.map((meal) => meal.id)).toEqual(
      systemMeals.map((meal) => meal.id)
    );
    expect(systemMeals[0].name).toBe('Breakfast');
  });

  it('preserves custom names even when they resemble a system meal', () => {
    expect(
      buildWatchMealTypes(
        [
          { id: 'review-custom', name: 'breakfast', user_id: 'review-user' },
          {
            id: 'review-renamed',
            name: 'Lunch',
            display_name: 'Nach dem Training',
            user_id: null,
          },
          { id: 'review-unknown', name: 'Brunch', user_id: 'review-user' },
        ],
        i18n.t
      )
    ).toEqual([
      { id: 'review-custom', name: 'breakfast' },
      { id: 'review-renamed', name: 'Nach dem Training' },
      { id: 'review-unknown', name: 'Brunch' },
    ]);
  });

  it('relabels a fresh context after the app language changes', async () => {
    expect(buildWatchMealTypes(systemMeals, i18n.t)[0].name).toBe('Frühstück');
    await i18n.changeLanguage('en');
    expect(buildWatchMealTypes(systemMeals, i18n.t)[0].name).toBe('Breakfast');
    expect(buildWatchMealTypes([], i18n.t)).toEqual([]);
  });
});
