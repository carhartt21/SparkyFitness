import { foodLoggingReturnAction } from '../../src/utils/foodLoggingReturn';

const origin = { routeKey: 'meal', date: '2026-10-03', mealTypeId: 'lunch' };
const routes = [
  { key: 'home', name: 'Tabs' },
  { key: 'meal', name: 'DailyMeals', params: { date: origin.date } },
  { key: 'search', name: 'FoodSearch', params: { loggingOrigin: origin } },
  { key: 'details', name: 'FoodEntryAdd' },
];

describe('successful food logging return', () => {
  it('pops to the same mounted meal instead of resetting its state', () => {
    expect(foodLoggingReturnAction({ routes, index: 3 }, origin)).toEqual({
      type: 'POP',
      payload: { count: 2 },
    });
  });
  it('inherits origin for nested photo and scan flows', () => {
    expect(
      foodLoggingReturnAction({
        routes: [
          ...routes.slice(0, 3),
          { key: 'photo', name: 'FoodPhotoFlow' },
        ],
        index: 3,
      })
    ).toEqual({ type: 'POP', payload: { count: 2 } });
  });
  it('preserves the search basket return before the final meal return', () => {
    expect(foodLoggingReturnAction({ routes, index: 3 }, origin, 1)).toEqual({
      type: 'POP',
      payload: { count: 1 },
    });
  });
  it('falls back to the same date and meal if the origin was removed', () => {
    const result = foodLoggingReturnAction(
      { routes: [routes[0]!], index: 0 },
      origin
    );
    expect(result).toMatchObject({
      type: 'NAVIGATE',
      payload: {
        name: 'DailyMeals',
        params: { date: origin.date, mealTypeId: 'lunch' },
      },
    });
  });
  it('keeps existing root behavior for independent logging', () => {
    expect(
      foodLoggingReturnAction({ routes: [routes[0]!], index: 0 }).type
    ).toBe('POP_TO_TOP');
  });
});
