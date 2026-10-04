import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { MobilitySession } from '@workspace/shared';
import { getAppLocale } from '../localization';
import Icon from './Icon';
import Button from './ui/Button';

export default function MobilityDiarySection({
  sessions,
  timezone,
  failed,
  onRetry,
  onPress,
}: {
  sessions: MobilitySession[];
  timezone?: string;
  failed: boolean;
  onRetry: () => void;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const accent = useCSSVariable('--color-accent-primary') as string;
  if (sessions.length === 0 && !failed) return null;
  return (
    <View
      className="mb-4 gap-3 rounded-2xl bg-raised p-4"
      testID="mobility-diary"
    >
      <View className="flex-row items-center gap-2">
        <Icon name="exercise-yoga" size={22} color={accent} />
        <Text className="flex-1 text-lg font-semibold text-text-primary">
          {t('mobility.diaryTitle', { defaultValue: 'Mobility workouts' })}
        </Text>
      </View>
      {sessions.map((session, index) => (
        <Pressable
          key={session.id}
          accessibilityRole="button"
          onPress={onPress}
          className={`min-h-16 flex-row items-center gap-3 py-2 ${index > 0 ? 'border-t border-border-subtle' : ''}`}
        >
          <View className="flex-1 gap-1">
            <Text className="text-base font-semibold text-text-primary">
              {session.routine.name}
            </Text>
            <Text className="text-sm text-text-secondary">
              {new Intl.DateTimeFormat(getAppLocale(), {
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
                timeZone: timezone,
              }).format(new Date(session.startedAt))}{' '}
              ·{' '}
              {t('mobility.historyCounts', {
                defaultValue: '{{completed}} completed · {{skipped}} skipped',
                completed: session.outcomes.filter(
                  (item) => item.result === 'completed'
                ).length,
                skipped: session.outcomes.filter(
                  (item) => item.result === 'skipped'
                ).length,
              })}
            </Text>
            {session.state === 'cancelled' ? (
              <Text className="text-sm text-text-secondary">
                {t('mobility.historyEndedEarly', {
                  defaultValue: 'Ended early',
                })}
              </Text>
            ) : null}
          </View>
          <Icon name="chevron-forward" size={18} color={accent} />
        </Pressable>
      ))}
      {failed ? (
        <View className="gap-2">
          <Text className="text-sm text-text-secondary">
            {t('mobility.diaryLoadError', {
              defaultValue:
                'Synced mobility sessions could not be refreshed. Saved sessions remain available. Try again when connected.',
            })}
          </Text>
          <Button variant="secondary" onPress={onRetry}>
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
