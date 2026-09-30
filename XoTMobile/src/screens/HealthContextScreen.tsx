import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  contextPeriodCoversDay,
  type HealthContextPeriod,
} from '@workspace/shared';
import TrackingScreen from '../components/tracking/TrackingScreen';
import { useNeonScale } from '../components/tracking/useNeonScale';
import {
  CONTEXT_ICON,
  contextColor,
} from '../components/tracking/contextStyle';
import { contextKindLabel } from '../components/tracking/trackingLabels';
import GlowCard from '../components/ui/GlowCard';
import NeonButton from '../components/ui/NeonButton';
import IconBadge from '../components/ui/IconBadge';
import StatusView from '../components/StatusView';
import { useHealthContextPeriods } from '../hooks/useDailyTracking';
import { useServerConnection } from '../hooks';
import { useAppLocale } from '../localization';
import { formatDate, getTodayDate } from '../utils/dateUtils';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'HealthContext'>;

/**
 * User-declared injury, illness and vacation periods. Periods only add
 * context and can pause optional reminders; they never change schedules or
 * records.
 */
const HealthContextScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const scale = useNeonScale();
  const locale = useAppLocale();
  const { isConnected } = useServerConnection();
  const periodsQuery = useHealthContextPeriods({ enabled: isConnected });
  const today = getTodayDate();
  const periods = periodsQuery.data ?? [];
  const current = periods.filter((period) =>
    contextPeriodCoversDay(period, today)
  );
  const upcoming = periods.filter((period) => period.start_date > today);
  const past = periods.filter(
    (period) => period.end_date !== null && period.end_date < today
  );

  const rangeLabel = (period: HealthContextPeriod) =>
    period.end_date
      ? t('context.range', {
          defaultValue: '{{start}} – {{end}}',
          start: formatDate(period.start_date, locale),
          end: formatDate(period.end_date, locale),
        })
      : t('context.since', {
          defaultValue: 'Since {{start}}',
          start: formatDate(period.start_date, locale),
        });

  const section = (
    title: string,
    items: HealthContextPeriod[],
    testID: string
  ) =>
    items.length === 0 ? null : (
      <View className="mb-2" testID={testID}>
        <Text className="mb-2 text-sm font-semibold uppercase text-text-secondary">
          {title}
        </Text>
        {items.map((period) => {
          const color = contextColor(period.kind, scale);
          return (
            <GlowCard
              key={period.id}
              glowColor={color}
              className="mb-2 flex-row items-center gap-3 p-4"
              onPress={() =>
                navigation.navigate('HealthContextForm', {
                  periodId: period.id,
                })
              }
              testID={`context-period-${period.id}`}
            >
              <IconBadge
                icon={CONTEXT_ICON[period.kind]}
                color={color}
                size={40}
              />
              <View className="flex-1">
                <Text className="text-base font-semibold text-text-primary">
                  {contextKindLabel(t, period.kind)}
                  {period.body_area ? ` · ${period.body_area}` : ''}
                </Text>
                <Text className="text-sm text-text-secondary">
                  {rangeLabel(period)}
                </Text>
                {period.limitation ? (
                  <Text className="text-xs text-text-secondary">
                    {period.limitation}
                  </Text>
                ) : null}
                {period.pause_discretionary_reminders ? (
                  <Text className="text-xs" style={{ color }}>
                    {t('context.remindersPausedLong', {
                      defaultValue: 'Optional reminders paused',
                    })}
                  </Text>
                ) : null}
              </View>
            </GlowCard>
          );
        })}
      </View>
    );

  return (
    <TrackingScreen
      testID="health-context"
      title={t('context.title', { defaultValue: 'Health context' })}
      subtitle={t('context.subtitle', {
        defaultValue:
          'Note an injury, illness or vacation. Nothing is changed automatically.',
      })}
      onBack={navigation.goBack}
      onRefresh={() => periodsQuery.refetch()}
    >
      <NeonButton
        testID="context-add"
        icon="add"
        label={t('context.add', { defaultValue: 'Add period' })}
        onPress={() => navigation.navigate('HealthContextForm')}
        className="mb-4"
      />
      {!isConnected ? (
        <StatusView
          icon="cloud-offline"
          iconTone="muted"
          title={t('context.offline', {
            defaultValue: 'Connect to your server to manage context.',
          })}
        />
      ) : periodsQuery.isLoading ? (
        <StatusView
          loading
          title={t('context.loading', { defaultValue: 'Loading…' })}
        />
      ) : periods.length === 0 ? (
        <GlowCard className="p-5" testID="context-empty">
          <Text className="text-sm text-text-secondary">
            {t('context.empty', {
              defaultValue:
                'No periods recorded. Adding one keeps your history in context and can pause optional reminders while you recover or travel. Medication and supplement schedules are never changed.',
            })}
          </Text>
        </GlowCard>
      ) : (
        <>
          {section(
            t('context.current', { defaultValue: 'Current' }),
            current,
            'context-current'
          )}
          {section(
            t('context.upcoming', { defaultValue: 'Upcoming' }),
            upcoming,
            'context-upcoming'
          )}
          {section(
            t('context.past', { defaultValue: 'Past' }),
            past,
            'context-past'
          )}
        </>
      )}
    </TrackingScreen>
  );
};

export default HealthContextScreen;
