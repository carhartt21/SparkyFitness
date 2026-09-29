import {
  amountWheelScale,
  buildAmountSteps,
} from '../../src/components/AmountWheel';

describe('AmountWheel steps', () => {
  it('uses 5 g steps for weights and quarters for portions', () => {
    expect(amountWheelScale(true)).toEqual({ step: 5, max: 1000 });
    expect(amountWheelScale(false)).toEqual({ step: 0.25, max: 20 });
  });

  it('keeps an off-grid value in order and extends past the maximum', () => {
    const grams = buildAmountSteps(137, { step: 5, max: 1000 });
    expect(grams.slice(26, 29)).toEqual([135, 137, 140]);
    expect(buildAmountSteps(1200, { step: 5, max: 1000 }).at(-1)).toBe(1200);
    expect(buildAmountSteps(1, { step: 0.25, max: 2 })).toEqual([
      0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2,
    ]);
  });
});
