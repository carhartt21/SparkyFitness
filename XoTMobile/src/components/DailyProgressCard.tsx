import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import { progressionStage } from '@workspace/shared';
import ProgressTrackX from './brand/ProgressTrackX';
import GlowCard from './ui/GlowCard';
import Icon from './Icon';
import { useNeonScale } from './tracking/useNeonScale';
import { useDailyCheckin, useDailyProgress } from '../hooks/useDailyTracking';

interface DailyProgressCardProps {
  date: string;
  enabled: boolean;
  onOpenProgress: () => void;
  onOpenCheckin: () => void;
}

/**
 * Dashboard entry to Daily Progress: the canonical Progression X, the day's
 * explicit task count and a shortcut to the check-in.
 */
export default function DailyProgressCard({
  date,
  enabled,
  onOpenProgress,
  onOpenCheckin,
}: DailyProgressCardProps) {
  const { t } = useTranslation();
  const scale = useNeonScale();
  const secondary = useCSSVariable('--color-text-secondary') as string;
  const progressQuery = useDailyProgress(date, { enabled });
  const checkinQuery = useDailyCheckin(date, { enabled });
  const progress = progressQuery.data;
  if (!enabled || !progress) return null;

  const stage = progressionStage(progress.percent);
  const checkinState = checkinQuery.data?.state ?? null;
  const checkinLabel =
    checkinState === 'completed'
      ? t('progress.checkinDone', { defaultValue: 'Checked in' })
      : checkinState === 'skipped'
        ? t('progress.checkinSkipped', { defaultValue: 'Check-in skipped' })
        : t('progress.checkinCta', { defaultValue: 'Check in' });

  return (
    <GlowCard
      testID="dashboard-daily-progress"
      glowColor={
        stage === 'ready'
          ? undefined
          : stage === 'completed'
            ? scale.green
            : scale.yellow
      }
      className="mb-3 flex-row items-center gap-3 p-3"
      onPress={onOpenProgress}
      accessibilityLabel={t('progress.cardA11y', {
        defaultValue:
          'Daily Progress: {{completed}} of {{applicable}} tasks complete',
        completed: progress.completed,
        applicable: progress.applicable,
      })}
    >
      <ProgressTrackX
        progress={progress.percent}
        label={t('progress.xLabel', { defaultValue: 'Daily Progress' })}
        unknownLabel={t('progress.nothingApplies', {
          defaultValue: 'No tasks today',
        })}
        size={60}
        showValue={false}
      />
      <View className="flex-1">
        <Text className="text-base font-semibold text-text-primary">
          {t('progress.title', { defaultValue: 'Daily Progress' })}
        </Text>
        <Text
          className="text-sm text-text-secondary"
          testID="dashboard-daily-progress-count"
        >
          {progress.applicable > 0
            ? t('progress.domainCount', {
                defaultValue: '{{completed}} of {{applicable}}',
                completed: progress.completed,
                applicable: progress.applicable,
              })
            : t('progress.nothingApplies', { defaultValue: 'No tasks today' })}
        </Text>
      </View>
      <Pressable
        testID="dashboard-checkin"
        accessibilityRole="button"
        onPress={onOpenCheckin}
        className="min-h-11 flex-row items-center gap-1 rounded-full border px-3"
        style={{
          borderColor: checkinState === 'completed' ? scale.green : secondary,
        }}
      >
        <Icon
          name={
            checkinState === 'completed' ? 'checkmark-circle' : 'daily-checkin'
          }
          size={16}
          color={checkinState === 'completed' ? scale.green : secondary}
        />
        <Text className="text-sm text-text-primary">{checkinLabel}</Text>
      </Pressable>
    </GlowCard>
  );
}
