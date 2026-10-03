import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import ProgressTrackX from './brand/ProgressTrackX';
import DashboardSummaryCard, {
  DashboardSummaryRow,
} from './ui/DashboardSummaryCard';
import {
  progressCategories,
  PROGRESS_CATEGORY_ICONS,
} from '../utils/progressCategories';
import {
  progressDomainLabel,
  categoryStateLabel,
} from './tracking/trackingLabels';
import { useProjectedDailyProgress } from '../hooks/useProjectedDailyProgress';
import { useProgressActions } from '../hooks/useProgressActions';

interface DailyProgressCardProps {
  date: string;
  enabled: boolean;
  onOpenProgress: () => void;
  onOpenHydration: () => void;
}
/** A bounded category overview, with individual goals available in the breakdown. */
export default function DailyProgressCard({
  date,
  enabled,
  onOpenProgress,
  onOpenHydration,
}: DailyProgressCardProps) {
  const { t } = useTranslation();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const query = useProjectedDailyProgress(date, enabled);
  const { openCategory } = useProgressActions(date, onOpenHydration);
  if (!enabled) return null;
  const progress = query.progress;
  if (!progress)
    return (
      <DashboardSummaryCard
        testID="dashboard-daily-progress"
        headingIcon="target"
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
  const categories = progressCategories(progress.items);
  const next = categories.slice(0, 4);
  return (
    <DashboardSummaryCard
      testID="dashboard-daily-progress"
      headingIcon="target"
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
            unknownLabel={
              progress.items.length
                ? t('progress.noCountedTasks', {
                    defaultValue: 'No counted tasks',
                  })
                : t('progress.nothingApplies', {
                    defaultValue: 'No tasks today',
                  })
            }
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
              : progress.items.length
                ? t('progress.noCountedTasks', {
                    defaultValue: 'No counted tasks',
                  })
                : t('progress.nothingApplies', {
                    defaultValue: 'No tasks today',
                  })}
          </Text>
        </>
      )}
      footer={
        <>
          {query.isError ? (
            <Text className="mt-2 text-xs text-text-secondary">
              {t('progress.previewStale', {
                defaultValue: 'Saved tasks. Refresh to check recent changes.',
              })}
            </Text>
          ) : null}
        </>
      }
    >
      {next.map((category, index) => {
        const label =
          category.domain === 'supplement'
            ? t('progress.categoryLabel.supplement', {
                defaultValue: 'Supplements',
              })
            : category.domain === 'workout'
              ? t('progress.categoryLabel.workout', {
                  defaultValue: 'Training',
                })
              : progressDomainLabel(t, category.domain);
        const state = categoryStateLabel(t, category.state);
        const compactState =
          category.state === 'partial'
            ? t('progress.partialShort', { defaultValue: 'Partial' })
            : state;
        return (
          <DashboardSummaryRow
            key={category.domain}
            compact
            testID={`dashboard-category-${category.domain}`}
            onPress={() => openCategory(category.domain)}
            accessibilityLabel={`${label}: ${state}`}
            icon={PROGRESS_CATEGORY_ICONS[category.domain]}
            color={accent}
            last={index === next.length - 1}
          >
            <Text className="text-sm font-medium text-text-primary">
              {label}
            </Text>
            <Text className="text-xs text-text-secondary">{compactState}</Text>
          </DashboardSummaryRow>
        );
      })}
    </DashboardSummaryCard>
  );
}
