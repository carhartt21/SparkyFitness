import {
  convertNutrientAmount,
  normalizeNutrientUnit,
} from '@workspace/shared';

describe('provider import unit conversion', () => {
  it('uses the same strict conversion contract as the server', () => {
    expect(convertNutrientAmount(0.04, 'g', 'mg')).toBe(40);
    expect(normalizeNutrientUnit('μg')).toBe('µg');
    expect(convertNutrientAmount(0.1, 'μg', 'g')).toBeCloseTo(1e-7, 15);
    expect(convertNutrientAmount(10, 'IU', 'mg')).toBeNull();
    expect(convertNutrientAmount(18, undefined, 'mg')).toBeNull();
    expect(convertNutrientAmount(Number.NaN, 'g', 'mg')).toBeNull();
  });
});
