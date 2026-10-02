import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import ProgressTrackX from './brand/ProgressTrackX';
import GlowCard from './ui/GlowCard';
import Icon from './Icon';
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
  const [secondary, accent] = useCSSVariable([
    '--color-text-secondary',
    '--color-accent-primary',
  ]) as string[];
  const { width, fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;
  const markSize = Math.min(144, Math.max(112, Math.round(width * 0.32)));
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
    <GlowCard testID="dashboard-daily-progress" className="mb-3 p-4">
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
        className="min-h-11 flex-row items-center gap-3"
      >
        <Text
          className="flex-1 text-base font-semibold text-text-primary"
          accessibilityRole="header"
        >
          {t('progress.title', { defaultValue: 'Daily Progress' })}
        </Text>
        <Icon name="chevron-forward" size={18} color={secondary} />
      </Pressable>
      <View
        style={{
          flexDirection: stacked ? 'column' : 'row',
          gap: 12,
          alignItems: stacked ? 'center' : 'flex-start',
        }}
      >
        <View className="items-center gap-1">
          <ProgressTrackX
            progress={progress.percent}
            label={t('progress.xLabel', { defaultValue: 'Daily Progress' })}
            unknownLabel={t('progress.nothingApplies', {
              defaultValue: 'No tasks today',
            })}
            size={markSize}
            showValue={false}
          />
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
        <View style={stacked ? { width: '100%' } : { flex: 1, minWidth: 0 }}>
          {next.length ? (
            next.map((item) => (
              <Pressable
                key={item.id}
                testID={`dashboard-next-${item.id}`}
                accessibilityRole="button"
                onPress={() => openItem(item)}
                accessibilityLabel={itemLabel(item)}
                className="min-h-11 flex-row items-center gap-2 py-2 active:opacity-70"
              >
                <Icon
                  name={progressTaskIcon(item, habits.data ?? [])}
                  size={18}
                  color={accent}
                />
                <Text
                  className="flex-1 text-sm text-text-primary"
                  numberOfLines={stacked ? undefined : 2}
                >
                  {itemLabel(item)}
                </Text>
                <Icon name="chevron-forward" size={14} color={secondary} />
              </Pressable>
            ))
          ) : progress.applicable > 0 ? (
            <Text className="py-2 text-sm text-text-secondary">
              {t('progress.previewComplete', {
                defaultValue: 'All applicable tasks are resolved.',
              })}
            </Text>
          ) : null}
        </View>
      </View>
      {query.isError ? (
        <Text className="mt-2 text-xs text-text-secondary">
          {t('progress.previewStale', {
            defaultValue: 'Saved tasks. Refresh to check recent changes.',
          })}
        </Text>
      ) : null}
    </GlowCard>
  );
}
