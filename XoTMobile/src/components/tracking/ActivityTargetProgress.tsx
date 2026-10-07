import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ActivityOccurrence } from '@workspace/shared';
import { formatLocalizedNumber } from '../../localization';

/** Server-selected single-session evidence; never sum separate diary workouts. */
export default function ActivityTargetProgress({
  occurrence,
}: {
  occurrence: ActivityOccurrence | undefined;
}) {
  const { t } = useTranslation();
  const progress = occurrence?.target_progress;
  const lines: string[] = [];
  const number = (value: number) =>
    formatLocalizedNumber(value, { maximumFractionDigits: 1 });
  if (
    progress?.duration_minutes != null &&
    progress.target_duration_minutes != null
  )
    lines.push(
      t('activityPlanning.durationProgress', {
        defaultValue: '{{recorded}} of {{target}} min',
        recorded: number(progress.duration_minutes),
        target: number(progress.target_duration_minutes),
      })
    );
  if (progress?.distance_km != null && progress.target_distance_km != null)
    lines.push(
      t('activityPlanning.distanceProgress', {
        defaultValue: '{{recorded}} of {{target}} km',
        recorded: number(progress.distance_km),
        target: number(progress.target_distance_km),
      })
    );
  if (occurrence?.state === 'started' && progress) {
    if (
      progress.duration_minutes === null &&
      progress.target_duration_minutes !== null
    )
      lines.push(
        t('activityPlanning.durationMissing', {
          defaultValue: 'Time not recorded · target {{target}} min',
          target: number(progress.target_duration_minutes),
        })
      );
    if (progress.distance_km === null && progress.target_distance_km !== null)
      lines.push(
        t('activityPlanning.distanceMissing', {
          defaultValue: 'Distance not recorded · target {{target}} km',
          target: number(progress.target_distance_km),
        })
      );
  }
  const ambiguous = occurrence?.reason === 'ambiguous_activity_records';
  if (!lines.length && !ambiguous) return null;
  return (
    <View
      className="gap-1"
      testID={`activity-target-progress-${occurrence?.id}`}
    >
      {lines.map((line) => (
        <Text key={line} className="text-xs text-text-secondary">
          {line}
        </Text>
      ))}
      {ambiguous && (
        <Text className="text-xs text-text-secondary">
          {t('activityPlanning.ambiguousHint', {
            defaultValue:
              'Several sessions match. Link the session that should count.',
          })}
        </Text>
      )}
    </View>
  );
}
