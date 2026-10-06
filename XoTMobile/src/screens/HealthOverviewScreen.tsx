import { useMemo, useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackScreenProps } from '../types/navigation';
import type { HealthTrendDateRange } from '../types/healthTrends';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import {
  useServerConnection,
  usePreferences,
  useCaffeineKinetics,
  useHealthTrends,
} from '../hooks';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { useDiaryDateStore } from '../stores/diaryDateStore';
import {
  resolveHealthTrendOrder,
  selectVisibleHealthTrends,
} from '../utils/healthTrendPreferences';
import { weightFromKg } from '../utils/unitConversions';
import CaffeineCard from '../components/CaffeineCard';
import HealthTrendsPager from '../components/HealthTrendsPager';
import FastingCard from '../components/FastingCard';
import CycleCard from '../components/CycleCard';
import MedicationsCard from '../components/MedicationsCard';
import ProgressPhotosCard from '../components/ProgressPhotosCard';
import SegmentedControl from '../components/SegmentedControl';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';

export default function HealthOverviewScreen({
  navigation,
  route,
}: RootStackScreenProps<'HealthOverview'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const native = useNativeIOSHeadersActive();
  const barPadding = useActiveWorkoutBarPadding();
  const selectedDate = useDiaryDateStore((s) => s.selectedDate);
  const date = route.params?.date ?? selectedDate;
  const section = route.params.section;
  const title =
    section === 'caffeine'
      ? t('caffeine.title', { defaultValue: 'Active Caffeine' })
      : section === 'trends'
        ? t('dashboard.healthTrends', { defaultValue: 'Health Trends' })
        : t('healthOverview.routines', { defaultValue: 'Health & routines' });
  const header = useScreenHeader({ title, left: { kind: 'back' } });
  const { isConnected } = useServerConnection();
  const { preferences } = usePreferences({ enabled: isConnected });
  const [range, setRange] = useState<HealthTrendDateRange>('7d');
  const [page, setPage] = useState(0);
  const order = useAppPreferencesStore((s) => s.healthTrendOrder);
  const hidden = useAppPreferencesStore((s) => s.hiddenHealthTrends);
  const visible = useMemo(
    () => selectVisibleHealthTrends(resolveHealthTrendOrder(order), hidden),
    [order, hidden]
  );
  const trends = useHealthTrends({
    range,
    enabled: isConnected && section === 'trends',
    activeTrends: visible,
  });
  const caffeine = useCaffeineKinetics(
    date,
    isConnected && section === 'caffeine'
  );
  const settings = useAppPreferencesStore();
  const weightUnit = preferences?.default_weight_unit === 'kg' ? 'kg' : 'lbs';
  const weight =
    weightUnit === 'kg'
      ? trends.weight
      : {
          ...trends.weight,
          data: trends.weight.data.map((p) => ({
            ...p,
            weight: weightFromKg(p.weight, weightUnit),
          })),
        };
  return (
    <View
      className="flex-1 bg-background"
      style={native ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + barPadding + 24,
        }}
      >
        {!isConnected && section !== 'routines' ? (
          <Text className="text-sm text-text-secondary">
            {t('healthOverview.offline', {
              defaultValue:
                'Connect to your server to load this overview. Missing data is not zero.',
            })}
          </Text>
        ) : (
          section === 'caffeine' && (
            <>
              <CaffeineCard
                kinetics={caffeine.kinetics}
                nowMs={caffeine.nowMs}
                isLoading={caffeine.isLoading}
                isError={caffeine.isError}
                onRetry={() => caffeine.refetch()}
              />
              {!caffeine.isLoading &&
                !caffeine.isError &&
                !caffeine.kinetics?.doses.length && (
                  <Text className="text-sm text-text-secondary">
                    {t('healthOverview.noCaffeine', {
                      defaultValue: 'No caffeine recorded for this day.',
                    })}
                  </Text>
                )}
            </>
          )
        )}
        {section === 'trends' && isConnected && (
          <>
            <SegmentedControl
              segments={(['7d', '30d', '90d'] as const).map((key) => ({
                key,
                label: key,
              }))}
              activeKey={range}
              onSelect={setRange}
            />
            <HealthTrendsPager
              steps={trends.steps}
              weight={weight}
              sleep={trends.sleep}
              hydration={trends.hydration}
              range={range}
              weightUnit={weightUnit}
              waterUnit={preferences?.water_display_unit ?? 'ml'}
              visibleTrends={visible}
              activePage={page}
              onPageSelected={setPage}
            />
          </>
        )}
        {section === 'routines' && (
          <>
            {!(settings.fastingEnabled && settings.fastingCardVisible) &&
              !settings.cycleCardVisible &&
              !settings.medicationsCardVisible &&
              !settings.progressPhotosCardVisible && (
                <Text className="text-sm text-text-secondary">
                  {t('healthOverview.noRoutines', {
                    defaultValue:
                      'No overview cards enabled. Manage them in settings.',
                  })}
                </Text>
              )}
            {settings.fastingEnabled && settings.fastingCardVisible && (
              <FastingCard navigation={navigation} />
            )}
            {settings.cycleCardVisible && <CycleCard navigation={navigation} />}
            {settings.medicationsCardVisible && (
              <MedicationsCard navigation={navigation} />
            )}
            {settings.progressPhotosCardVisible && (
              <ProgressPhotosCard navigation={navigation} date={date} />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
