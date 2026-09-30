import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MealTrackingStatus } from '@workspace/shared';

/** "3 of 4 meals resolved · 1 incomplete", from explicit statuses only. */
export default function MealCoverageLine({
  coverage,
}: {
  coverage: MealTrackingStatus['coverage'] | undefined;
}) {
  const { t } = useTranslation();
  if (!coverage || coverage.total === 0) return null;
  const parts = [
    t('mealStatus.coverage', {
      defaultValue: '{{resolved}} of {{total}} meals resolved',
      resolved: coverage.resolved,
      total: coverage.total,
    }),
  ];
  if (coverage.incomplete > 0) {
    parts.push(
      t('mealStatus.coverageIncomplete', {
        defaultValue: '{{count}} incomplete',
        count: coverage.incomplete,
      })
    );
  }
  return (
    <Text
      testID="meal-coverage"
      className="mb-2 px-1 text-sm text-text-secondary"
    >
      {parts.join(' · ')}
    </Text>
  );
}
