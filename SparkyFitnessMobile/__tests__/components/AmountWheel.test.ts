import { amountWheelScale, stepAmount } from '../../src/components/AmountWheel';

describe('AmountWheel steps', () => {
  const grams = { step: 5, max: 1000 };

  it('uses 5 g steps for weights and quarters for portions', () => {
    expect(amountWheelScale(true)).toEqual({ step: 5, max: 1000 });
    expect(amountWheelScale(false)).toEqual({ step: 0.25, max: 20 });
  });

  it('moves along the grid and snaps an off-grid value to its neighbours', () => {
    expect(stepAmount(100, 1, grams)).toBe(105);
    expect(stepAmount(100, -3, grams)).toBe(85);
    expect(stepAmount(137, 1, grams)).toBe(140);
    expect(stepAmount(137, -1, grams)).toBe(135);
    expect(stepAmount(137, 0, grams)).toBe(137);
    expect(stepAmount(1, 1, { step: 0.25, max: 2 })).toBe(1.25);
  });

  it('stays between one step and the larger of the maximum and the value', () => {
    expect(stepAmount(5, -1, grams)).toBe(5);
    expect(stepAmount(1000, 1, grams)).toBe(1000);
    expect(stepAmount(1200, 1, grams)).toBe(1200);
    expect(stepAmount(1200, -1, grams)).toBe(1195);
  });

  it('handles very large amounts without building a list', () => {
    expect(stepAmount(1e12, -1, grams)).toBe(1e12 - 5);
    expect(stepAmount(Number.MAX_SAFE_INTEGER, 1, grams)).toBe(
      Number.MAX_SAFE_INTEGER
    );
  });
});
