import {
  createNutritionFixture,
  reviewFood,
} from '../../review/nutritionFixture';
import type { DailyProgress, MealTrackingStatus } from '@workspace/shared';
import type { DailySummaryApiResponse } from '../../src/services/api/dailySummaryApi';

const url = (path: string) => new URL(`https://ui-review.invalid${path}`);
const payload = {
  food_id: reviewFood.id,
  quantity: 200,
  unit: 'g',
  meal_type_id: 'review-breakfast-type',
  entry_date: '2026-09-26',
  notes: 'Long note\nEND',
  client_operation_id: 'review-operation',
};

describe('isolated nutrition review fixture', () => {
  it('keeps meal-status writes isolated by day and refreshes the Goals projection', () => {
    const fixture = createNutritionFixture('meal-status');
    const mealId = 'b3333333-3333-4333-8333-333333333333';
    const getStatus = (date: string) =>
      fixture.respond(
        url(`/api/v2/tracking/meal-status/${date}`),
        'GET'
      ) as MealTrackingStatus;
    const original = getStatus('2026-09-26');
    expect(original.meals[0].state).toBe('pending');
    fixture.respond(
      url('/api/v2/tracking/meal-status'),
      'PUT',
      JSON.stringify({
        entry_date: '2026-09-26',
        meal_type_id: mealId,
        status: 'skipped',
      })
    );
    expect(getStatus('2026-09-26').meals[0].state).toBe('skipped');
    expect(original.meals[0].state).toBe('pending');
    expect(getStatus('2026-09-27').meals[0].state).toBe('pending');
    const progress = fixture.respond(
      url('/api/v2/tracking/daily-progress/2026-09-26'),
      'GET'
    ) as DailyProgress;
    expect(progress.items.find((item) => item.domain === 'meal')).toMatchObject(
      { reference_id: mealId, state: 'complete', reason: 'meal_skipped' }
    );
    expect(fixture.snapshot()).toHaveLength(1);
    expect(() =>
      createNutritionFixture('populated').respond(
        url('/api/v2/tracking/meal-status'),
        'PUT',
        JSON.stringify({
          entry_date: '2026-09-26',
          meal_type_id: mealId,
          status: 'skipped',
        })
      )
    ).toThrow('Unconfigured');
  });

  it('serves disabled engagement settings without sending real notifications', () => {
    const fixture = createNutritionFixture('populated');
    expect(
      fixture.respond(url('/api/v2/engagement/settings'), 'GET')
    ).toMatchObject({
      remote_enabled: false,
      hydration_enabled: false,
      movement_break_enabled: false,
    });
    expect(() =>
      fixture.respond(url('/api/v2/engagement/settings'), 'PATCH', '{}')
    ).toThrow('Unconfigured');
  });
  it('leaves body-measurement hints absent without recording zero measurements', () => {
    const fixture = createNutritionFixture('populated');
    expect(
      fixture.respond(
        url(
          '/api/measurements/check-in/latest-on-or-before-date?date=2026-09-26'
        ),
        'GET'
      )
    ).toBeNull();
    expect(
      fixture.respond(
        url(
          '/api/measurements/custom-entries/latest-manual-on-or-before-date?date=2026-09-26'
        ),
        'GET'
      )
    ).toEqual([]);
  });
  it('reconciles create, idempotent retry, edit and delete against the selected day', () => {
    const fixture = createNutritionFixture('populated');
    const post = () =>
      fixture.respond(
        url('/api/food-entries/'),
        'POST',
        JSON.stringify(payload)
      );
    post();
    post();
    expect(fixture.snapshot()).toHaveLength(2);
    const summary = () =>
      fixture.respond(
        url('/api/daily-summary?date=2026-09-26'),
        'GET'
      ) as DailySummaryApiResponse;
    expect(summary().calorieBalance?.eaten).toBe(900);
    expect(summary().calorieBalance?.remaining).toBe(1100);
    fixture.respond(
      url('/api/food-entries/review-created-1'),
      'PUT',
      JSON.stringify({ quantity: 100 })
    );
    expect(summary().calorieBalance?.eaten).toBe(750);
    expect(fixture.snapshot()[1].notes).toBe(payload.notes);
    expect(
      (
        fixture.respond(
          url('/api/daily-summary?date=2026-09-25'),
          'GET'
        ) as DailySummaryApiResponse
      ).foodEntries
    ).toEqual([]);
    fixture.respond(url('/api/food-entries/review-created-1'), 'DELETE');
    expect(summary().calorieBalance?.eaten).toBe(600);
    expect(summary().foodEntries).toHaveLength(1);
  });
  it('rejects real origins, unsupported writes and foreign entry IDs', () => {
    const fixture = createNutritionFixture('empty');
    expect(() =>
      fixture.respond(
        new URL('https://health.ilmtech.de/api/food-entries'),
        'POST',
        JSON.stringify(payload)
      )
    ).toThrow('blocked');
    expect(() => fixture.respond(url('/api/foods'), 'DELETE')).toThrow(
      'Unconfigured'
    );
    expect(() =>
      fixture.respond(url('/api/food-entries/real-entry'), 'DELETE')
    ).toThrow('Unconfigured');
    expect(fixture.snapshot()).toEqual([]);
  });
  it('keeps fixture instances and returned audit snapshots isolated', () => {
    const first = createNutritionFixture('populated');
    first.snapshot()[0].calories = 1;
    first.respond(url('/api/food-entries'), 'POST', JSON.stringify(payload));
    const second = createNutritionFixture('populated');
    expect(second.snapshot()).toHaveLength(1);
    expect(first.snapshot()[0].calories).toBe(600);
  });
});

it('reconciles the quick water action with the day total and itemized ledger', () => {
  const fixture = createNutritionFixture('populated');
  expect(
    fixture.respond(
      url('/api/measurements/water-intake'),
      'POST',
      JSON.stringify({
        entry_date: '2026-09-26',
        change_drinks: 1,
        container_id: -1,
      })
    )
  ).toEqual({ water_ml: 1250 });
  const summary = fixture.respond(
    url('/api/daily-summary?date=2026-09-26'),
    'GET'
  ) as DailySummaryApiResponse;
  expect(summary.waterIntake).toBe(1250);
  expect(
    fixture.respond(
      url('/api/v2/measurements/water-intake/2026-09-26/log'),
      'GET'
    )
  ).toEqual([
    expect.objectContaining({ water_ml: 250, entry_date: '2026-09-26' }),
  ]);
});
