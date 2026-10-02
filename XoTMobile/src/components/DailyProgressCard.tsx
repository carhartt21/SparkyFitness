import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { DailyProgressDomain } from '@workspace/shared';
import ProgressTrackX from './brand/ProgressTrackX';
import GlowCard from './ui/GlowCard';
import Icon, { type IconName } from './Icon';
import { useProjectedDailyProgress } from '../hooks/useProjectedDailyProgress';
import {
  nextProgressTasks,
  useProgressActions,
} from '../hooks/useProgressActions';

interface DailyProgressCardProps {
  date: string;
  enabled: boolean;
  onOpenProgress: () => void;
  onOpenHydration: () => void;
}
const taskIcons: Record<DailyProgressDomain, IconName> = {
  habit: 'habit',
  measurement: 'scale',
  supplement: 'medication',
  meal: 'food',
  goal: 'target',
  workout: 'exercise-running',
  checkin: 'daily-checkin',
};

/** A bounded preview of actual unresolved tasks, using the breakdown's actions. */
export default function DailyProgressCard({
  date,
  enabled,
  onOpenProgress,
  onOpenHydration,
}: DailyProgressCardProps) {
  const { t } = useTranslation();
  const [secondary, accent] = useCSSVariable([
    '--color-text-secondary',
    '--color-accent-primary',
  ]) as string[];
  const query = useProjectedDailyProgress(date, enabled);
  const { itemLabel, openItem } = useProgressActions(date, onOpenHydration);
  if (!enabled) return null;
  const progress = query.progress;
  if (!progress)
    return (
      <GlowCard testID="dashboard-daily-progress" className="mb-3 p-3">
        <Text className="text-base font-semibold text-text-primary">
          {t('progress.title', { defaultValue: 'Daily Progress' })}
        </Text>
        <Text className="mt-1 text-sm text-text-secondary">
          {query.isError
            ? t('progress.previewUnavailable', {
                defaultValue: 'Tasks could not be loaded.',
              })
            : t('common.loading', { defaultValue: 'Loading...' })}
        </Text>
        {query.isError ? (
          <Pressable
            onPress={() => void query.refetch()}
            accessibilityRole="button"
            className="min-h-11 justify-center"
          >
            <Text className="text-accent-primary">
              {t('common.retry', { defaultValue: 'Retry' })}
            </Text>
          </Pressable>
        ) : null}
      </GlowCard>
    );
  const next = nextProgressTasks(progress.items);
  return (
    <GlowCard testID="dashboard-daily-progress" className="mb-3 p-3">
      <Pressable
        testID="dashboard-progress-open"
        accessibilityRole="button"
        onPress={onOpenProgress}
        accessibilityLabel={t('progress.cardA11y', {
          defaultValue:
            'Daily Progress: {{completed}} of {{applicable}} tasks complete',
          completed: progress.completed,
          applicable: progress.applicable,
        })}
        className="min-h-12 flex-row items-center gap-3"
      >
        <ProgressTrackX
          progress={progress.percent}
          label={t('progress.xLabel', { defaultValue: 'Daily Progress' })}
          unknownLabel={t('progress.nothingApplies', {
            defaultValue: 'No tasks today',
          })}
          size={52}
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
              : t('progress.nothingApplies', {
                  defaultValue: 'No tasks today',
                })}
          </Text>
        </View>
        <Icon name="chevron-forward" size={18} color={secondary} />
      </Pressable>
      {query.isError ? (
        <Text className="mt-2 text-xs text-text-secondary">
          {t('progress.previewStale', {
            defaultValue: 'Saved tasks. Refresh to check recent changes.',
          })}
        </Text>
      ) : null}
      {next.length ? (
        <View className="mt-2 border-t border-border-subtle pt-1">
          {next.map((item) => (
            <Pressable
              key={item.id}
              testID={`dashboard-next-${item.id}`}
              accessibilityRole="button"
              onPress={() => openItem(item)}
              accessibilityLabel={itemLabel(item)}
              className="min-h-11 flex-row items-center gap-3 py-2 active:opacity-70"
            >
              <Icon name={taskIcons[item.domain]} size={18} color={accent} />
              <Text
                className="flex-1 text-sm text-text-primary"
                numberOfLines={2}
              >
                {itemLabel(item)}
              </Text>
              <Icon name="chevron-forward" size={14} color={secondary} />
            </Pressable>
          ))}
        </View>
      ) : progress.applicable > 0 ? (
        <Text className="mt-2 text-sm text-text-secondary">
          {t('progress.previewComplete', {
            defaultValue: 'All applicable tasks are resolved.',
          })}
        </Text>
      ) : null}
    </GlowCard>
  );
}
