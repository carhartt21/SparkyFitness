import { Text, View } from 'react-native';
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
}: TrackingSummaryCardProps) {
  const scale = useNeonScale();
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
      glowColor={stage === 'ready' ? undefined : stageColor}
      className="mb-3 flex-row items-center p-4"
    >
      <View className="flex-row items-center gap-3" style={{ flex: 1.3 }}>
        <ProgressTrackX
          progress={percent}
          label={progressLabel}
          unknownLabel={emptyCaption}
          size={84}
          showValue={false}
        />
        <View className="flex-1">
          {applicable > 0 ? (
            <>
              <Text
                className="text-[26px] font-bold text-text-primary"
                testID={`${testID}-count`}
                maxFontSizeMultiplier={1.3}
              >
                {completed}/{applicable}
              </Text>
              <Text className="text-sm text-text-secondary">{caption}</Text>
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
      {stats.map((stat) => (
        <View
          key={stat.label}
          testID={stat.testID}
          className="flex-1 items-center gap-1 px-1"
          style={{ borderLeftWidth: 1, borderLeftColor: border }}
        >
          <IconBadge icon={stat.icon} color={stat.color} size={36} />
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
    </GlowCard>
  );
}
