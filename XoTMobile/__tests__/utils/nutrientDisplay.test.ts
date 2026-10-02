import {
  buildCustomNutrientRows,
  formatNutrientAmount,
} from '../../src/utils/nutrientDisplay';

const definitions = [
  { id: 'one', name: 'Vitamin B12', unit: 'µg' },
  { id: 'two', name: 'Magnesium', unit: 'mg' },
];
it('distinguishes measured zero, absent values and qualified/invalid source values', () => {
  expect(buildCustomNutrientRows({ 'Vitamin B12': 0 }, definitions)).toEqual([
    { label: 'Vitamin B12', value: 0, unit: 'µg' },
    { label: 'Magnesium', value: null, unit: 'mg' },
  ]);
  expect(
    buildCustomNutrientRows(
      { 'Vitamin B12': '<LOD', Magnesium: 'not a number' },
      definitions
    ).every((row) => row.value === null)
  ).toBe(true);
});
it('preserves fractional amounts and unknown units without inventing values', () => {
  expect(
    buildCustomNutrientRows(
      { Magnesium: '0,125', 'Personal nutrient': 1 },
      definitions
    )
  ).toContainEqual({ label: 'Magnesium', value: 0.125, unit: 'mg' });
  expect(buildCustomNutrientRows({ 'Personal nutrient': 1 }, []).at(0)).toEqual(
    { label: 'Personal nutrient', value: 1, unit: '' }
  );
  expect(formatNutrientAmount(0.125, 'mg', 2)).toBe('0.25 mg');
  expect(formatNutrientAmount(0.0001, 'g')).toBe('<0.001 g');
  expect(formatNutrientAmount(null, 'mg')).toBe('—');
});

it('does not display an overflowing or negative scaled amount as nutrition', () => {
  expect(formatNutrientAmount(Number.MAX_VALUE, 'mg', 2)).toBe('—');
  expect(formatNutrientAmount(-1, 'mg')).toBe('—');
});
