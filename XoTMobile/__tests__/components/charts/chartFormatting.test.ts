import { getSafeChartXTickCount } from '../../../src/components/charts/chartFormatting';

describe('chart x-axis tick spacing', () => {
  const dateLabels = { labelSpacing: 76, axisReserve: 70 };

  it('avoids adjacent overlapping dates in a narrow six-point weight chart', () => {
    expect(getSafeChartXTickCount('30d', 6, 315, dateLabels)).toBe(3);
  });

  it('uses more dates when the chart has enough space', () => {
    expect(getSafeChartXTickCount('30d', 6, 600, dateLabels)).toBe(6);
  });

  it('keeps a sparse axis until layout is measured', () => {
    expect(getSafeChartXTickCount('7d', 7, 0, dateLabels)).toBe(2);
  });

  it('keeps single-point and very narrow charts valid', () => {
    expect(getSafeChartXTickCount('7d', 1, 300, dateLabels)).toBe(1);
    expect(getSafeChartXTickCount('30d', 6, 90, dateLabels)).toBe(1);
  });
});
