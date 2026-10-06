import type { FoodEntry } from '../../src/types/foodEntries';
import type { MealType } from '../../src/types/mealTypes';
import {
  diaryTimestamp,
  diaryMealGroups,
  sortDiaryTimeline,
  wellnessTimestamp,
} from '../../src/utils/diaryTimeline';

describe('diary chronology', () => {
  it('interleaves kinds earliest to latest and separates missing times without mutating sources', () => {
    const events = [
      {
        id: 'food:late',
        timestamp: diaryTimestamp('2026-10-05', '20:30', 'Europe/Berlin'),
      },
      { id: 'workout:untimed', timestamp: null },
      {
        id: 'water:early',
        timestamp: diaryTimestamp(
          '2026-10-05',
          '2026-10-05T05:00:00Z',
          'Europe/Berlin'
        ),
      },
      {
        id: 'intake:midday',
        timestamp: diaryTimestamp('2026-10-05', '12:00:01', 'Europe/Berlin'),
      },
      {
        id: 'mobility:evening',
        timestamp: diaryTimestamp(
          '2026-10-05',
          '2026-10-05T16:00:00Z',
          'Europe/Berlin'
        ),
      },
    ];
    expect(sortDiaryTimeline(events).map((item) => item.id)).toEqual([
      'water:early',
      'intake:midday',
      'mobility:evening',
      'food:late',
      'workout:untimed',
    ]);
    expect(events[0].id).toBe('food:late');
  });
  it('has deterministic identities for same-time and untimed events', () => {
    expect(
      sortDiaryTimeline([
        { id: 'b', timestamp: 3 },
        { id: 'a', timestamp: 3 },
        { id: 'z', timestamp: null },
        { id: 'x', timestamp: null },
      ]).map((item) => item.id)
    ).toEqual(['a', 'b', 'x', 'z']);
  });
  it('preserves order of repeated DST hours represented by real instants', () => {
    expect(
      diaryTimestamp('2026-10-25', '2026-10-25T02:30:00+02:00', 'Europe/Berlin')
    ).toBeLessThan(
      diaryTimestamp(
        '2026-10-25',
        '2026-10-25T02:10:00+01:00',
        'Europe/Berlin'
      )!
    );
  });
  it.each([
    undefined,
    null,
    '',
    '24:01',
    '12:99',
    '12:30:60',
    'invalid',
    '2026-10-05',
  ])('does not invent a time for %s', (time) => {
    expect(diaryTimestamp('2026-10-05', time, 'Europe/Berlin')).toBeNull();
  });
  it('does not turn the recording time of backfilled wellness into occurrence time', () => {
    expect(
      wellnessTimestamp('2026-10-04', '2026-10-05T10:00:00Z', 'Europe/Berlin')
    ).toBeNull();
    expect(
      wellnessTimestamp('2026-10-05', '2026-10-05T10:00:00Z', 'Europe/Berlin')
    ).not.toBeNull();
  });
});

describe('meal groups on the diary timeline', () => {
  const breakfast: MealType = {
    id: 'breakfast',
    name: 'Breakfast',
    user_id: null,
    sort_order: 1,
    is_visible: true,
    show_in_quick_log: true,
    created_at: '',
    default_time: '08:00',
  };
  const lunch: MealType = {
    ...breakfast,
    id: 'lunch',
    name: 'Lunch',
    default_time: '12:30',
  };
  const food = (id: string, mealId: string, time: string): FoodEntry => ({
    id,
    meal_type_id: mealId,
    meal_type: 'Breakfast',
    entry_time: time,
    entry_date: '2026-10-05',
    quantity: 1,
    unit: 'g',
    serving_size: 100,
    calories: 120,
  });
  it('retains explicitly resolved empty historical meals without inventing a time', () => {
    const groups = diaryMealGroups(
      [],
      [breakfast, lunch],
      '2026-10-04',
      '2026-10-05',
      'Europe/Berlin',
      new Map([['breakfast', 'skipped']])
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      mealTypeId: 'breakfast',
      entries: [],
      timestamp: null,
      clock: null,
    });
  });
  it('shows empty configured meals today/future and positions them by the reminder meal time', () => {
    const groups = diaryMealGroups(
      [food('late', 'breakfast', '10:00'), food('early', 'breakfast', '09:00')],
      [breakfast, lunch],
      '2026-10-05',
      '2026-10-05',
      'Europe/Berlin'
    );
    expect(groups.map((group) => group.mealTypeId)).toEqual([
      'breakfast',
      'lunch',
    ]);
    expect(groups[0].entries.map((entry) => entry.id)).toEqual([
      'early',
      'late',
    ]);
    expect(groups[0].clock).toBeNull();
    expect(groups[0].timestamp).toBe(
      diaryTimestamp('2026-10-05', '09:00', 'Europe/Berlin')
    );
    expect(groups[1].clock).toBe('12:30');
    expect(groups[1].entries).toHaveLength(0);
    expect(
      diaryMealGroups(
        [],
        [breakfast, lunch],
        '2026-10-06',
        '2026-10-05',
        'Europe/Berlin'
      )
    ).toHaveLength(2);
  });
  it('uses only actual records and occurrence times in the past', () => {
    const groups = diaryMealGroups(
      [food('logged', 'breakfast', '10:00')],
      [breakfast, lunch],
      '2026-10-04',
      '2026-10-05',
      'Europe/Berlin'
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].clock).toBeNull();
    expect(groups[0].timestamp).toBe(
      diaryTimestamp('2026-10-04', '10:00', 'Europe/Berlin')
    );
  });
  it('preserves different canonical IDs with the same name and omits import-only/hidden empty meals', () => {
    const groups = diaryMealGroups(
      [food('old', 'deleted-breakfast', '09:00')],
      [
        breakfast,
        { ...lunch, purpose: 'import' },
        { ...lunch, id: 'hidden', is_visible: false },
      ],
      '2026-10-05',
      '2026-10-05',
      'UTC'
    );
    expect(groups.map((group) => group.mealTypeId)).toEqual([
      'deleted-breakfast',
      'breakfast',
    ]);
  });
});
