import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import TrackingScreen from '../components/tracking/TrackingScreen';
import WellnessCard from '../components/tracking/WellnessCard';
import StatusView from '../components/StatusView';
import { useServerConnection } from '../hooks';
import { habitLogsRootQueryKey, habitsRootQueryKey } from '../hooks/queryKeys';
import type { RootStackParamList } from '../types/navigation';
import { getTodayDate } from '../utils/dateUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'Wellness'>;

export default function WellnessScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isConnected, isLoading } = useServerConnection();
  const [date, setDate] = useState(route.params?.date ?? getTodayDate());

  return (
    <TrackingScreen
      testID="wellness"
      title={t('wellness.title', { defaultValue: 'Wellness' })}
      subtitle={t('wellness.subtitle', {
        defaultValue: 'Log an activity for this day.',
      })}
      date={date}
      onDateChange={setDate}
      onBack={navigation.goBack}
      onRefresh={
        isConnected
          ? () =>
              Promise.all([
                queryClient.invalidateQueries({ queryKey: habitsRootQueryKey }),
                queryClient.invalidateQueries({
                  queryKey: habitLogsRootQueryKey,
                }),
              ])
          : undefined
      }
    >
      {isLoading ? (
        <StatusView
          loading
          title={t('wellness.loading', {
            defaultValue: 'Loading wellness activities…',
          })}
        />
      ) : isConnected ? (
        <WellnessCard date={date} mode="log" className="mb-3 p-4" />
      ) : (
        <StatusView
          icon="cloud-offline"
          iconTone="muted"
          title={t('wellness.offlineTitle', {
            defaultValue: 'Wellness needs your server',
          })}
          subtitle={t('wellness.offlineSubtitle', {
            defaultValue:
              'Connect to your server to see and log wellness activities.',
          })}
        />
      )}
    </TrackingScreen>
  );
}
