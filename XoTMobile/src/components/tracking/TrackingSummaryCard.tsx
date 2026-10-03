import { Text, View, useWindowDimensions } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { progressionStage } from '@workspace/shared';
import ProgressTrackX from '../brand/ProgressTrackX';
import GlowCard from '../ui/GlowCard';
import IconBadge from '../ui/IconBadge';
import type { IconName } from '../Icon';
import { useNeonScale } from './useNeonScale';

export interface SummaryStat {
  icon: IconName;
  color: string;
  value: string;
  label: string;
  detail?: string;
  testID?: string;
}

interface TrackingSummaryCardProps {
  /** Completed and applicable counts; applicable 0 renders a neutral X. */
  completed: number;
  applicable: number;
  /** e.g. "logged today" / "taken today". */
  caption: string;
  /** Shown instead of the count when nothing applies. */
  emptyCaption: string;
  /** Neutral status line under the count; never a pressure message. */
  status?: string;
  stats: SummaryStat[];
  progressLabel: string;
  testID: string;
  quiet?: boolean;
}

/**
 * Summary header for the tracking screens: the canonical Progression X with
 * the day's explicit completion and up to two supporting stats.
 */
export default function TrackingSummaryCard({
  completed,
  applicable,
  caption,
  emptyCaption,
  status,
  stats,
  progressLabel,
  testID,
  quiet = false,
}: TrackingSummaryCardProps) {
  const scale = useNeonScale();
  // Large Dynamic Type stacks the stats under the count instead of
  // squeezing three columns.
  const stacked = useWindowDimensions().fontScale > 1.3;
  const quietColumns = quiet && !stacked;
  const [border, secondary] = useCSSVariable([
    '--color-border-subtle',
    '--color-text-secondary',
  ]) as [string, string];
  const percent = applicable > 0 ? (completed / applicable) * 100 : null;
  const stage = progressionStage(percent);
  const stageColor =
    stage === 'completed'
      ? scale.green
      : stage === 'progressing'
        ? scale.yellow
        : stage === 'started'
          ? scale.orange
          : secondary;

  return (
    <GlowCard
      testID={testID}
      glowColor={quiet || stage === 'ready' ? undefined : stageColor}
      className={`mb-3 p-4 ${stacked ? 'gap-3' : 'flex-row items-center'}`}
    >
      <View
        className={
          quietColumns ? 'items-center gap-1' : 'flex-row items-center gap-3'
        }
        style={stacked ? undefined : { flex: 1.7 }}
      >
        <ProgressTrackX
          progress={percent}
          label={progressLabel}
          unknownLabel={emptyCaption}
          size={68}
          showValue={false}
        />
        <View className={quietColumns ? 'w-full' : 'flex-1'}>
          {applicable > 0 ? (
            <>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                className={`text-[26px] font-bold text-text-primary ${quietColumns ? 'text-center' : ''}`}
                testID={`${testID}-count`}
                maxFontSizeMultiplier={1.3}
              >
                {completed}/{applicable}
              </Text>
              <Text
                className={`text-sm text-text-secondary ${quietColumns ? 'text-center' : ''}`}
                numberOfLines={2}
              >
                {caption}
              </Text>
            </>
          ) : (
            <Text className="text-sm text-text-secondary">{emptyCaption}</Text>
          )}
          {status ? (
            <Text
              className="mt-1 text-sm font-medium"
              style={{ color: stageColor }}
            >
              {status}
            </Text>
          ) : null}
        </View>
      </View>
      {stats.length > 0 ? (
        <View
          className="flex-row"
          style={stacked ? undefined : { flex: stats.length }}
        >
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              testID={stat.testID}
              className="flex-1 items-center gap-1 px-1"
              style={
                stacked && index === 0
                  ? undefined
                  : { borderLeftWidth: 1, borderLeftColor: border }
              }
            >
              <IconBadge
                icon={stat.icon}
                color={stat.color}
                size={quiet ? 28 : 36}
              />
              <Text
                className="text-center text-base font-bold text-text-primary"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {stat.value}
              </Text>
              <Text
                className="text-center text-xs text-text-secondary"
                numberOfLines={2}
              >
                {stat.label}
              </Text>
              {stat.detail ? (
                <Text
                  className="text-center text-xs text-text-secondary"
                  numberOfLines={1}
                >
                  {stat.detail}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </GlowCard>
  );
}
