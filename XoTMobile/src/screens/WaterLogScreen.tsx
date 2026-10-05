import { useState, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HydrationGauge from '../components/HydrationGauge';
import HydrationDetailsModal from '../components/HydrationDetailsModal';
import StatusView from '../components/StatusView';
import { useDailySummary, useServerConnection, usePreferences } from '../hooks';
import { useWaterIntakeMutation } from '../hooks/useWaterIntakeMutation';
import { useManualWaterActions } from '../hooks/useManualWaterActions';
import { useRetrySavedWater } from '../hooks/useRetrySavedWater';
import {
  linkedWaterPressLabel,
  waterPresetOptions,
} from '../utils/waterLoggingLabels';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { getTodayDate } from '../utils/dateUtils';
import type { RootStackScreenProps } from '../types/navigation';

/** The existing dashboard water logger, reachable from Quick Add with its date. */
export default function WaterLogScreen({
  navigation,
  route,
}: RootStackScreenProps<'WaterLog'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const native = useNativeIOSHeadersActive();
  const date = route.params?.date ?? getTodayDate();
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
  const [details, setDetails] = useState(false);
  const header = useScreenHeader({
    title: t('dashboard.quickWater', { defaultValue: 'Log water' }),
    left: { kind: 'back' },
  });
  return (
    <View
      className="flex-1 bg-background"
      style={native ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 32,
        }}
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
            variant="full"
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
            onDetails={() => setDetails(true)}
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
      </ScrollView>
      <HydrationDetailsModal
        visible={details}
        date={date}
        unit={unit}
        goal={summary?.waterGoal}
        onClose={() => setDetails(false)}
        onConfigure={() => {
          setDetails(false);
          navigation.navigate('WaterContainers');
        }}
      />
    </View>
  );
}
