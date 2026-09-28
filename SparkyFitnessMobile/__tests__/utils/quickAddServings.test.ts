import {
  buildQuickAddPresets,
  scaleServingNutrition,
} from '../../src/utils/quickAddServings';

describe('buildQuickAddPresets', () => {
  it('offers 50/100/150/200 g for a 100 g serving', () => {
    expect(
      buildQuickAddPresets({ serving_size: 100 }).map((p) => p.quantity)
    ).toEqual([50, 100, 150, 200]);
  });

  it('keeps piece servings in their own unit and guards invalid sizes', () => {
    expect(
      buildQuickAddPresets({ serving_size: 1 }).map((p) => p.quantity)
    ).toEqual([0.5, 1, 1.5, 2]);
    expect(
      buildQuickAddPresets({ serving_size: 0 }).map((p) => p.quantity)
    ).toEqual([0.5, 1, 1.5, 2]);
  });
});

describe('scaleServingNutrition', () => {
  const basis = {
    serving_size: 100,
    serving_unit: 'g',
    calories: 62,
    protein: 11,
    carbs: 4,
    fat: 0.2,
  };

  it('scales nutrition by quantity over serving size', () => {
    expect(scaleServingNutrition(basis, 150)).toEqual({
      calories: 93,
      protein: 16.5,
      carbs: 6,
      fat: expect.closeTo(0.3),
    });
  });

  it('returns zeros for an unusable serving size', () => {
    expect(
      scaleServingNutrition({ ...basis, serving_size: 0 }, 100).calories
    ).toBe(0);
  });
});
