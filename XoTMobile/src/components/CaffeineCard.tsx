import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAppLocale } from '../localization';
import { useTranslation } from 'react-i18next';
import { CartesianChart, Line } from 'victory-native';
import { DashPathEffect } from '@shopify/react-native-skia';
import { useCSSVariable } from 'uniwind';
import {
  activeCaffeineAt,
  caffeineCurve,
  caffeineDisplayWindow,
  thresholdCrossingTime,
} from '@workspace/shared';
import type { CaffeineActiveResponse } from '@workspace/shared';
import { makeChartFont, CHART_LABEL_FONT_SIZE } from './charts/chartFormatting';
import LineSeriesMark from './charts/LineSeriesMark';
import { usePreferences } from '../hooks/usePreferences';
import { formatTimeLabel } from '../utils/entryTimeDisplay';

const font = makeChartFont(CHART_LABEL_FONT_SIZE);

type CaffeineCardProps = {
  kinetics: CaffeineActiveResponse | undefined;
  nowMs: number;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
};

/**
 * Mirrors the web Diary card: the circulating figure now, the projection at
 * bedtime, when another dose stops being affordable, and the curve joining
 * them. Every number comes from the shared kinetics helpers, so the two
 * platforms cannot drift apart.
 */
const CaffeineCard: React.FC<CaffeineCardProps> = ({
  kinetics,
  nowMs,
  isLoading,
  isError = false,
  onRetry,
}) => {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { preferences } = usePreferences();
  const [accentColor, dangerColor, textMuted] = useCSSVariable([
    '--color-accent-primary',
    '--color-icon-danger',
    '--color-text-muted',
  ]) as [string, string, string];

  const timeZone =
    kinetics?.timezone ||
    preferences?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  const clockLabel = (value: number | string | Date) => {
    const d = value instanceof Date ? value : new Date(value);
    const time = new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(d);
    return `${new Intl.DateTimeFormat(locale, { timeZone, day: '2-digit', month: '2-digit' }).format(d)} ${time}`;
  };

  const windowMs = useMemo(
    () =>
      kinetics
        ? caffeineDisplayWindow(kinetics.bedtime_at, nowMs, timeZone)
        : null,
    [kinetics, nowMs, timeZone]
  );
  const referenceMs = windowMs?.reference ?? nowMs;

  const chartData = useMemo(() => {
    if (!kinetics || kinetics.doses.length === 0 || !windowMs) return [];
    return caffeineCurve(
      kinetics.doses,
      windowMs.start,
      windowMs.end,
      kinetics.half_life_hours,
      15
    ).map((point) => ({
      ...point,
      // A constant series is how a threshold line is drawn here: victory-native
      // has no reference-line primitive.
      threshold: kinetics.threshold_mg,
    }));
  }, [kinetics, windowMs]);

  const lastCrossingAt = useMemo(
    () =>
      kinetics
        ? thresholdCrossingTime(
            kinetics.doses,
            kinetics.half_life_hours,
            kinetics.threshold_mg
          )
        : null,
    [kinetics]
  );

  // A past crossing outside this day is not a current-day projection.
  const crossingAt =
    lastCrossingAt && windowMs && Date.parse(lastCrossingAt) >= windowMs.start
      ? lastCrossingAt
      : null;

  if (isError) {
    return (
      <View
        className="bg-surface rounded-2xl border border-border-subtle p-4 my-2"
        testID="caffeine-error"
      >
        <Text className="text-text-primary text-lg font-semibold">
          {t('caffeine.title', { defaultValue: 'Active Caffeine' })}
        </Text>
        <Text accessibilityRole="alert" className="text-text-secondary my-2">
          {t('caffeine.refreshError', {
            defaultValue: 'Caffeine data could not be refreshed.',
          })}
        </Text>
        {onRetry && (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            className="min-h-11 justify-center"
          >
            <Text className="text-text-link">
              {t('common.retry', { defaultValue: 'Retry' })}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (isLoading || !kinetics || kinetics.doses.length === 0) {
    // A caffeine card on a day with no caffeine is noise, not information.
    return null;
  }

  const activeNowMg = activeCaffeineAt(
    kinetics.doses,
    referenceMs,
    kinetics.half_life_hours
  );

  // Below the display's 1 mg resolution, past residual alone is not useful.
  // Do not suppress a dose on the selected day or alter the underlying model.
  const hasDoseOnSelectedDay = kinetics.doses.some(
    (dose) =>
      windowMs &&
      Date.parse(dose.at) >= windowMs.start &&
      Date.parse(dose.at) <= windowMs.end
  );
  if (!hasDoseOnSelectedDay && activeNowMg < 1) return null;

  const cutoffText =
    kinetics.cutoff_state === 'by' && kinetics.latest_safe_dose_time
      ? formatTimeLabel(
          kinetics.latest_safe_dose_time,
          preferences?.time_format
        )
      : kinetics.cutoff_state === 'passed'
        ? t('caffeine.cutoffPassed', { defaultValue: 'Too late' })
        : kinetics.cutoff_state === 'over'
          ? t('caffeine.cutoffOver', { defaultValue: 'Over' })
          : t('caffeine.anytimeSafe', { defaultValue: 'Any time' });

  return (
    <View className="bg-surface rounded-2xl border border-border-subtle p-4 my-2">
      <Text className="text-text-primary text-lg font-semibold mb-2">
        {t('caffeine.title', { defaultValue: 'Active Caffeine' })}
      </Text>
      <Text className="text-text-secondary text-sm mb-3">
        {new Intl.DateTimeFormat(locale, {
          timeZone,
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(new Date(kinetics.bedtime_at))}
      </Text>

      {!hasDoseOnSelectedDay && (
        <Text className="text-text-secondary text-sm mb-2">
          {t('caffeine.previousDoses', {
            defaultValue: 'Residual from earlier entries',
          })}
        </Text>
      )}
      <View className="flex-row justify-between mb-3">
        <View>
          <Text className="text-text-muted text-xs">
            {windowMs?.isToday
              ? t('caffeine.activeNow', { defaultValue: 'Active now' })
              : t('caffeine.dayEnd', { defaultValue: 'At day end' })}
          </Text>
          <Text className="text-text-primary text-2xl font-bold">
            {Math.round(activeNowMg)}
            <Text className="text-text-muted text-xs">
              {' '}
              {t('caffeine.unitMg', { defaultValue: 'mg' })}
            </Text>
          </Text>
        </View>
        <View>
          <Text className="text-text-muted text-xs">
            {t('caffeine.atBedtime', { defaultValue: 'At {{time}}' }).replace(
              '{{time}}',
              formatTimeLabel(
                kinetics.target_bedtime,
                preferences?.time_format
              ) ?? kinetics.target_bedtime
            )}
          </Text>
          <Text className="text-text-primary text-2xl font-bold">
            {Math.round(kinetics.at_bedtime_mg)}
            <Text className="text-text-muted text-xs">
              {' '}
              {t('caffeine.unitMg', { defaultValue: 'mg' })}
            </Text>
          </Text>
        </View>
        <View>
          <Text className="text-text-muted text-xs">
            {t('caffeine.lastDose', { defaultValue: 'Last dose by' })}
          </Text>
          <Text className="text-text-primary text-2xl font-bold">
            {cutoffText}
          </Text>
        </View>
      </View>

      <View style={{ height: 150 }} testID="caffeine-chart">
        <CartesianChart
          data={chartData}
          xKey="t"
          yKeys={['mg', 'threshold']}
          domainPadding={{ left: 10, right: 10, top: 12 }}
          xAxis={{
            font,
            tickCount: 3,
            labelColor: textMuted,
            formatXLabel: (value: number) =>
              new Intl.DateTimeFormat(locale, {
                timeZone,
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
              }).format(value),
          }}
          yAxis={[{ font, tickCount: 4, labelColor: textMuted }]}
        >
          {({ points }) => (
            <>
              {/* Dashed so it reads as a limit rather than a second series. */}
              <Line
                points={points.threshold}
                color={dangerColor}
                strokeWidth={1}
              >
                <DashPathEffect intervals={[4, 4]} />
              </Line>
              <LineSeriesMark
                points={points.mg}
                color={accentColor}
                strokeWidth={2}
                curveType="linear"
                connectMissingData
              />
            </>
          )}
        </CartesianChart>
      </View>

      {/* The plot carries two series and no axis legend, so name them. */}
      <View className="flex-row justify-center items-center gap-4 mt-1">
        <View className="flex-row items-center gap-1.5">
          <View
            style={{ width: 14, height: 2, backgroundColor: accentColor }}
          />
          <Text className="text-text-muted text-[11px]">
            {t('caffeine.legendCurve', { defaultValue: 'Active caffeine' })}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View
            style={{
              width: 14,
              height: 0,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderColor: dangerColor,
            }}
          />
          <Text className="text-text-muted text-[11px]">
            {t('caffeine.legendThreshold', {
              defaultValue: '{{threshold}}mg threshold',
            }).replace('{{threshold}}', String(kinetics.threshold_mg))}
          </Text>
        </View>
      </View>

      <Text className="text-text-muted text-xs text-center mt-1">
        {crossingAt
          ? t('caffeine.crossingNote', {
              defaultValue: 'Back under {{threshold}}mg from {{time}}',
            })
              .replace('{{threshold}}', String(kinetics.threshold_mg))
              .replace('{{time}}', clockLabel(crossingAt))
          : t('caffeine.underThreshold', {
              defaultValue: 'Stays under {{threshold}}mg tonight',
            }).replace('{{threshold}}', String(kinetics.threshold_mg))}
      </Text>

      {kinetics.has_estimated_times ? (
        <Text className="text-text-muted text-[11px] text-center mt-1">
          {t('caffeine.estimatedTimes', {
            defaultValue: 'Some dose times were estimated',
          })}
        </Text>
      ) : null}
    </View>
  );
};

export default CaffeineCard;
