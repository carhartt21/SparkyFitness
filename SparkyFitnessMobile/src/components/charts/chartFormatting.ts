import { Platform } from 'react-native';
import { getAppLocale, formatLocalizedNumber } from '../../localization';
import { matchFont } from '@shopify/react-native-skia';

const fontFamily = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });

/** Skia label font shared by the dashboard/wellness charts. */
export const makeChartFont = (fontSize: number) =>
  matchFont({ fontFamily, fontSize });

/**
 * Axis label size for the dashboard trend charts. Skia text ignores the OS font-size
 * setting, so any chart drawing its axis with React Native `<Text>` instead has to pin
 * this size and pass `allowFontScaling={false}` — otherwise its labels grow past the
 * ones beside them in the pager and truncate.
 */
export const CHART_LABEL_FONT_SIZE = 12;

type ChartRange = '7d' | '30d' | '90d';

const PREFERRED_X_TICKS: Record<ChartRange, number> = {
  '7d': 7,
  '30d': 6,
  '90d': 5,
};

/**
 * Victory downsamples categorical ticks by rounding evenly spaced data indices.
 * Merely dividing the available width by the label width can still choose two
 * adjacent points (for example, indices 2 and 3 of a six-point series). Check
 * the actual downsampled spacing so localized date labels never collide.
 */
export const getSafeChartXTickCount = (
  range: ChartRange,
  pointCount: number,
  width: number,
  options: { labelSpacing: number; axisReserve?: number }
): number => {
  if (pointCount <= 1) return pointCount;
  // The first layout has no measured width; start sparse until onLayout fires.
  if (width <= 0) return Math.min(2, pointCount);

  const plotWidth = Math.max(0, width - (options.axisReserve ?? 0));
  const pointSpacing = plotWidth / (pointCount - 1);
  const preferred = Math.min(PREFERRED_X_TICKS[range], pointCount);
  for (let count = preferred; count >= 2; count -= 1) {
    const indices = Array.from({ length: count }, (_, index) =>
      Math.round((index * (pointCount - 1)) / (count - 1))
    );
    const minDistance = Math.min(
      ...indices
        .slice(1)
        .map((index, position) => (index - indices[position]) * pointSpacing)
    );
    if (minDistance >= options.labelSpacing) return count;
  }
  return 1;
};

export const formatXLabel7d = (day: string): string => {
  if (typeof day !== 'string') return '';
  const [year, month, d] = day.split('-').map(Number);
  const date = new Date(year, month - 1, d);
  return date.toLocaleDateString(getAppLocale(), { weekday: 'short' });
};

export const formatXLabel30d90d = (day: string): string => {
  if (typeof day !== 'string') return '';
  const [year, month, d] = day.split('-').map(Number);
  const date = new Date(year, month - 1, d);
  return date.toLocaleDateString(getAppLocale(), {
    month: 'short',
    day: 'numeric',
  });
};

export const formatTooltipDate = (day: string): string => {
  const parts = day.split('-');
  if (parts.length < 3) return day;
  const [year, month, d] = parts.map(Number);
  const date = new Date(year, (month || 1) - 1, d || 1);
  return date.toLocaleDateString(getAppLocale(), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

/** Formats chart tick values according to the active application locale. */
export const formatChartYLabel = (value: number): string =>
  value >= 1000
    ? new Intl.NumberFormat(getAppLocale(), {
        notation: 'compact',
        maximumFractionDigits: 0,
      }).format(value)
    : formatLocalizedNumber(value);
