import { useQueryClient } from '@tanstack/react-query';
import { hydrationDetailsQueryKey } from '../hooks/queryKeys';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import HydrationGauge from '../components/HydrationGauge';
import HydrationHistory from '../components/HydrationHistory';
import DailyDetailScreen from '../components/DailyDetailScreen';
import StatusView from '../components/StatusView';
import { useDailySummary, useServerConnection, usePreferences } from '../hooks';
import { useWaterIntakeMutation } from '../hooks/useWaterIntakeMutation';
import { useManualWaterActions } from '../hooks/useManualWaterActions';
import { useRetrySavedWater } from '../hooks/useRetrySavedWater';
import {
  linkedWaterPressLabel,
  waterPresetOptions,
} from '../utils/waterLoggingLabels';
import { getTodayDate } from '../utils/dateUtils';
import type { RootStackScreenProps } from '../types/navigation';

/** The existing dashboard water logger, reachable from Quick Add with its date. */
export default function WaterLogScreen({
  navigation,
  route,
}: RootStackScreenProps<'WaterLog'>) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [date, setDate] = useState(route.params?.date ?? getTodayDate());
  const { isConnected } = useServerConnection();
  const { summary, isLoading, isError, refetch } = useDailySummary({
    date,
    enabled: isConnected,
  });
  const { preferences } = usePreferences({ enabled: isConnected });
  const water = useWaterIntakeMutation({ date, enabled: isConnected });
  const unit = water.unit ?? preferences?.water_display_unit ?? 'ml';
  const pending = useManualWaterActions(date);
  const retry = useRetrySavedWater(date);
  const linkedPressLabel = useMemo(
    () => linkedWaterPressLabel(water.activeContainer),
    [water.activeContainer]
  );
  const quickAddPresets = useMemo(
    () => waterPresetOptions(water.quickAddPresets),
    [water.quickAddPresets]
  );

  return (
    <DailyDetailScreen
      title={t('dashboard.hydration', { defaultValue: 'Hydration' })}
      date={date}
      onDateChange={setDate}
      onRefresh={() =>
        Promise.all([
          refetch(),
          client.refetchQueries({ queryKey: hydrationDetailsQueryKey(date) }),
        ])
      }
    >
      {!summary ? (
        <StatusView
          loading={isLoading}
          icon="water"
          title={
            isConnected
              ? t('common.loading', { defaultValue: 'Loading...' })
              : t('waterLog.offline', {
                  defaultValue: 'Connect to your server to log water.',
                })
          }
        />
      ) : (
        <HydrationGauge
          variant="daily"
          consumed={summary.waterConsumed}
          goal={summary.waterGoal}
          fromFoodMl={summary.waterFromFood}
          unit={unit}
          containerVolume={water.servingVolume}
          linkedPressLabel={linkedPressLabel}
          pendingMl={pending.pendingMl}
          attentionMl={pending.attentionMl}
          pendingContainerCount={pending.pendingContainerCount}
          attentionContainerCount={pending.attentionContainerCount}
          pendingStorageError={pending.storageError}
          onRetryAttention={retry.retry}
          retryingAttention={retry.retrying}
          containers={water.containers}
          activeContainerId={water.activeContainer?.id}
          onSelectContainer={water.selectContainer}
          quickAddPresets={quickAddPresets}
          onIncrement={water.isContainersLoaded ? water.increment : undefined}
          onDecrement={water.isContainersLoaded ? water.decrement : undefined}
          disableDecrement={summary.waterConsumed <= 0}
          onQuickAdd={water.isContainersLoaded ? water.logPreset : undefined}
          onConfigure={() => navigation.navigate('WaterContainers')}
        />
      )}
      {isError && (
        <StatusView
          title={t('waterLog.error', {
            defaultValue: 'Could not load hydration details.',
          })}
          action={{
            label: t('common.retry', { defaultValue: 'Retry' }),
            onPress: () => void refetch(),
          }}
        />
      )}
      <HydrationHistory
        visible={isConnected}
        date={date}
        unit={unit}
        showTotals={false}
        onClose={() => {}}
        onConfigure={() => navigation.navigate('WaterContainers')}
      />
    </DailyDetailScreen>
  );
}
