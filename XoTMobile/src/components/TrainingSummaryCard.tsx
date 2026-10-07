import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import GlowCard from './ui/GlowCard';
import Icon from './Icon';
import { useDailyTraining } from '../hooks/useDailyTraining';
import { formatLocalizedNumber } from '../localization';
import { progressActivityLabel } from './tracking/trackingLabels';

export default function TrainingSummaryCard({
  date,
  enabled,
  onPress,
}: {
  date: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const data = useDailyTraining(date, enabled);
  const [training, neutral] = useCSSVariable([
    '--color-action-training',
    '--color-card-glow',
  ]) as string[];
  const unavailable =
    !data.daily.summary || data.mobility.isLoading || data.mobility.isError;
  return (
    <GlowCard
      testID="dashboard-training"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('dailyTraining.open', {
        defaultValue: 'Open daily training',
      })}
      glowColor={neutral}
      className="mb-2 px-3 py-2"
    >
      <View className="flex-row items-center gap-3">
        <Icon name="exercise-running" color={training} size={24} />
        <View className="min-w-0 flex-1">
          <Text className="text-base font-bold text-text-primary">
            {t('dailyTraining.title', { defaultValue: 'Training' })}
          </Text>
          <Text className="text-sm font-semibold text-text-primary">
            {unavailable
              ? data.daily.summary && data.mobility.isError
                ? t('dailyTraining.partial', {
                    defaultValue: 'Some training data could not be refreshed.',
                  })
                : t('dailyTraining.unavailable', {
                    defaultValue: 'Training summary unavailable',
                  })
              : `${t('dailyTraining.sessionCount', { defaultValue: '{{count}} sessions', count: data.count })} · ${t('dailyTraining.duration', { defaultValue: '{{value}} min', value: formatLocalizedNumber(Math.round(data.minutes)) })}`}
          </Text>
          {data.planned[0] && (
            <Text className="text-xs text-text-secondary" numberOfLines={1}>
              {t('dailyTraining.planned', { defaultValue: 'Planned' })}:{' '}
              {progressActivityLabel(
                t,
                data.planned[0].label,
                data.planned[0].activity_type
              )}
            </Text>
          )}
          {data.planning.query.isError && !unavailable && (
            <Text className="text-xs text-text-secondary">
              {t('dailyTraining.partial', {
                defaultValue: 'Some training data could not be refreshed.',
              })}
            </Text>
          )}
        </View>
        <Icon name="chevron-forward" color={neutral} size={18} />
      </View>
    </GlowCard>
  );
}
