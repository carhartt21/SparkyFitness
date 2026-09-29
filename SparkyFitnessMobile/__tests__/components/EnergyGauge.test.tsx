import React from 'react';
import { render } from '@testing-library/react-native';
import EnergyGauge, { gaugeArcPath } from '../../src/components/EnergyGauge';

jest.mock('uniwind', () => ({
  useCSSVariable: (keys: string[]) => keys.map(() => '#16c79b'),
}));

jest.mock('../../src/components/ui/glow', () => ({
  useGlowTheme: () => true,
}));

jest.mock('../../src/hooks/useTweenedValue', () => ({
  useTweenedValue: (value: number) => value,
}));

describe('EnergyGauge', () => {
  it.each([132, 168])(
    'keeps the glow stroke inside a %i-pt viewport',
    (size) => {
      const stroke = 14;
      const screen = render(
        <EnergyGauge progress={0.45} size={size} strokeWidth={stroke} />
      );
      // The gauge is intentionally hidden from accessibility, so use the raw
      // element query to inspect its decorative SVG geometry.
      const fill = screen.UNSAFE_getByProps({ testID: 'energy-gauge-fill' });
      const radius = Number(/A ([\d.]+) /.exec(fill.props.d)?.[1]);
      const haloHalfWidth = (stroke + 10) / 2;

      expect(radius).toBeGreaterThan(0);
      expect(size / 2 - radius - haloHalfWidth).toBeGreaterThanOrEqual(1);
    }
  );

  it('preserves the 270-degree shape while insetting its radius', () => {
    const path = gaugeArcPath(168, 14, 270, 6);
    expect(path).toContain('A 71 71 0 1 1');
  });
});
