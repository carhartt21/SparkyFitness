import { formatServingLabel } from '@/utils/foodServing';

describe('formatServingLabel', () => {
  it('keeps provider descriptions and plain amounts', () => {
    expect(
      formatServingLabel({
        serving_size: 1,
        serving_unit: 'slice',
        serving_description: '1 slice (30 g)',
      })
    ).toBe('1 slice (30 g)');
    expect(formatServingLabel({ serving_size: 100, serving_unit: 'g' })).toBe(
      '100 g'
    );
  });

  it('names saved portions with their weight', () => {
    expect(
      formatServingLabel({
        serving_size: 1,
        serving_unit: 'piece',
        serving_label: 'Medium',
        metric_amount: '130',
        metric_unit: 'g',
      })
    ).toBe('Medium (130 g)');
    expect(
      formatServingLabel({
        serving_size: 1,
        serving_unit: 'cup',
        metric_amount: 245,
        metric_unit: 'g',
      })
    ).toBe('1 cup (245 g)');
    expect(
      formatServingLabel({
        serving_size: 2,
        serving_unit: 'slice',
        serving_label: 'Toast',
      })
    ).toBe('Toast (2 slice)');
    // A gram row does not repeat its own weight.
    expect(
      formatServingLabel({
        serving_size: 50,
        serving_unit: 'g',
        metric_amount: 50,
        metric_unit: 'g',
      })
    ).toBe('50 g');
  });
});
