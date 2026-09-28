import { buildTodaysFocus, computeLoggingStreak } from '@/utils/todaysFocus';

describe('computeLoggingStreak', () => {
  it('counts consecutive logged days ending at the selected day', () => {
    expect(
      computeLoggingStreak(
        ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28'],
        '2026-09-28'
      )
    ).toBe(4);
  });

  it('does not break the streak for an unlogged, in-progress end day', () => {
    expect(
      computeLoggingStreak(['2026-09-26', '2026-09-27'], '2026-09-28')
    ).toBe(2);
  });

  it('stops at the first gap and returns zero without recent logs', () => {
    expect(
      computeLoggingStreak(
        ['2026-09-24', '2026-09-26', '2026-09-27'],
        '2026-09-27'
      )
    ).toBe(2);
    expect(computeLoggingStreak(['2026-09-20'], '2026-09-28')).toBe(0);
  });

  it('crosses month boundaries using calendar days', () => {
    expect(
      computeLoggingStreak(['2026-08-31', '2026-09-01'], '2026-09-01')
    ).toBe(2);
  });
});

describe('buildTodaysFocus', () => {
  const base = {
    caloriesEaten: 1400,
    calorieGoal: 2200,
    proteinConsumed: 90,
    proteinGoal: 120,
    waterMl: 3000,
    waterGoalMl: 2500,
    foodEntryCount: 4,
  };

  it('derives each check from configured goals', () => {
    expect(buildTodaysFocus(base).map(({ key, met }) => [key, met])).toEqual([
      ['energy', true],
      ['protein', false],
      ['water', true],
      ['logged', true],
    ]);
  });

  it('omits items whose goal is not configured or data is unavailable', () => {
    const keys = buildTodaysFocus({
      ...base,
      proteinGoal: 0,
      waterMl: null,
    }).map((item) => item.key);
    expect(keys).toEqual(['energy', 'logged']);
  });

  it('does not mark an empty or over-goal day as within the energy goal', () => {
    expect(
      buildTodaysFocus({ ...base, caloriesEaten: 0, foodEntryCount: 0 })[0]?.met
    ).toBe(false);
    expect(buildTodaysFocus({ ...base, caloriesEaten: 2500 })[0]?.met).toBe(
      false
    );
  });
});
