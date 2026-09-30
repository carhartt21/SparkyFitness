import { foodSearchComparison } from '../../src/utils/foodSearchComparison';

describe('food search comparison basis', () => {
  test('normalizes metric mass and volume independently', () => {
    expect(
      foodSearchComparison({
        serving_size: 25,
        serving_unit: 'g',
        calories: 50,
        protein: 5,
        carbs: 3,
        fat: 2,
      })
    ).toEqual({ basis: '100g', calories: 200, protein: 20, carbs: 12, fat: 8 });
    expect(
      foodSearchComparison({
        serving_size: 0.5,
        serving_unit: 'l',
        calories: 150,
        protein: 2,
      })
    ).toEqual({
      basis: '100ml',
      calories: 30,
      protein: 0.4,
      carbs: null,
      fat: null,
    });
  });

  test('does not pretend a package or volume serving is 100 grams', () => {
    expect(
      foodSearchComparison({
        serving_size: 1,
        serving_unit: 'bar',
        calories: 200,
        protein: 20,
      })
    ).toEqual({
      basis: 'serving',
      calories: 200,
      protein: 20,
      carbs: null,
      fat: null,
    });
    expect(
      foodSearchComparison({
        serving_size: 100,
        serving_unit: 'ml',
        calories: 40,
      }).basis
    ).toBe('100ml');
  });

  test('keeps missing nutrients unknown and rejects an invalid reference size', () => {
    expect(
      foodSearchComparison({
        serving_size: 0,
        serving_unit: 'g',
        calories: 25,
        carbs: undefined,
      })
    ).toEqual({
      basis: 'serving',
      calories: 25,
      protein: null,
      carbs: null,
      fat: null,
    });
  });
});
