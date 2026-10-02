import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import ProgressTrackX from './brand/ProgressTrackX';
import DashboardSummaryCard, {
  DashboardSummaryRow,
} from './ui/DashboardSummaryCard';
import { progressTaskIcon } from './tracking/progressTaskIcons';
import { useHabits } from '../hooks/useDailyTracking';
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
/** A bounded preview of actual unresolved tasks, using the breakdown's actions. */
export default function DailyProgressCard({
  date,
  enabled,
  onOpenProgress,
  onOpenHydration,
}: DailyProgressCardProps) {
  const { t } = useTranslation();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const query = useProjectedDailyProgress(date, enabled);
  const habits = useHabits({
    enabled:
      enabled &&
      !!query.progress?.items.some((item) => item.domain === 'habit'),
  });
  const { itemLabel, openItem } = useProgressActions(date, onOpenHydration);
  if (!enabled) return null;
  const progress = query.progress;
  if (!progress)
    return (
      <DashboardSummaryCard
        testID="dashboard-daily-progress"
        title={t('progress.title', { defaultValue: 'Daily Progress' })}
      >
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
      </DashboardSummaryCard>
    );
  const next = nextProgressTasks(progress.items);
  return (
    <DashboardSummaryCard
      testID="dashboard-daily-progress"
      title={t('progress.title', { defaultValue: 'Daily Progress' })}
      openTestID="dashboard-progress-open"
      onOpen={onOpenProgress}
      accessibilityLabel={t('progress.cardA11y', {
        defaultValue:
          'Daily Progress: {{completed}} of {{applicable}} tasks complete',
        completed: progress.completed,
        applicable: progress.applicable,
      })}
      renderVisual={({ size, light }) => (
        <>
          <ProgressTrackX
            progress={progress.percent}
            label={t('progress.xLabel', { defaultValue: 'Daily Progress' })}
            unknownLabel={t('progress.nothingApplies', {
              defaultValue: 'No tasks today',
            })}
            size={size}
            light={light}
            fit="track"
            showValue={false}
          />
          <Text
            className="min-h-6 text-center text-sm text-text-secondary"
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
        </>
      )}
      footer={
        query.isError ? (
          <Text className="mt-2 text-xs text-text-secondary">
            {t('progress.previewStale', {
              defaultValue: 'Saved tasks. Refresh to check recent changes.',
            })}
          </Text>
        ) : null
      }
    >
      {next.length ? (
        next.map((item, index) => (
          <DashboardSummaryRow
            key={item.id}
            testID={`dashboard-next-${item.id}`}
            onPress={() => openItem(item)}
            accessibilityLabel={itemLabel(item)}
            icon={progressTaskIcon(item, habits.data ?? [])}
            color={accent}
            last={index === next.length - 1}
          >
            <Text className="text-sm text-text-primary">{itemLabel(item)}</Text>
          </DashboardSummaryRow>
        ))
      ) : progress.applicable > 0 ? (
        <Text className="py-2 text-sm text-text-secondary">
          {t('progress.previewComplete', {
            defaultValue: 'All applicable tasks are resolved.',
          })}
        </Text>
      ) : null}
    </DashboardSummaryCard>
  );
}
