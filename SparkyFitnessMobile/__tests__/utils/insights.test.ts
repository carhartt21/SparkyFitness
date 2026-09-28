import {
  summarizeNutritionTrends,
  summarizeWeight,
} from '../../src/utils/insights';
import type { NutritionTrendPoint } from '../../src/services/api/reportsApi';

const point = (
  date: string,
  values: Partial<NutritionTrendPoint> = {}
): NutritionTrendPoint =>
  ({
    date,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ...values,
  }) as NutritionTrendPoint;

describe('summarizeNutritionTrends', () => {
  it('averages logged days only and treats missing days as unknown', () => {
    const points = [
      point('2026-09-26', {
        calories: 2000,
        protein: 100,
        carbs: 200,
        fat: 50,
      }),
      point('2026-09-27'),
      point('2026-09-28', { calories: 1000, protein: 50, carbs: 100, fat: 30 }),
    ];
    const result = summarizeNutritionTrends(
      points,
      new Set(['2026-09-26', '2026-09-28'])
    );

    expect(result.loggedDays).toBe(2);
    expect(result.totalDays).toBe(3);
    expect(result.averageCalories).toBe(1500);
    expect(result.averageProtein).toBe(75);
    expect(result.averageFat).toBe(40);
    // 75*4=300, 150*4=600, 40*9=360 => 1260 kcal from macros
    expect(result.macroShares?.protein).toBeCloseTo(300 / 1260);
    expect(result.macroShares?.fat).toBeCloseTo(360 / 1260);
  });

  it('returns no averages when nothing was logged', () => {
    const result = summarizeNutritionTrends(
      [point('2026-09-28')],
      new Set<string>()
    );
    expect(result).toMatchObject({
      loggedDays: 0,
      totalDays: 1,
      averageCalories: null,
      macroShares: null,
    });
  });
});

describe('summarizeWeight', () => {
  it('reports the latest weight and change since the first reading', () => {
    expect(
      summarizeWeight([
        { day: '2026-09-01', weight: 80 },
        { day: '2026-09-28', weight: 78.5 },
      ])
    ).toEqual({ latest: 78.5, change: -1.5 });
  });

  it('omits a change for a single reading and returns null without data', () => {
    expect(summarizeWeight([{ day: '2026-09-28', weight: 70 }])).toEqual({
      latest: 70,
      change: null,
    });
    expect(summarizeWeight([])).toBeNull();
  });
});
