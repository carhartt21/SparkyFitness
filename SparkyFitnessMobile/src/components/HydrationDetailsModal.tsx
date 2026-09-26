import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import { fetchWaterIntakeLog } from '../services/api/measurementsApi';
import { waterIntakeLogQueryKey } from '../hooks/queryKeys';
import { formatDate } from '../utils/dateUtils';
import { useAppLocale } from '../localization';
import {
  formatVolumeForUnit,
  volumeFromMl,
  WATER_UNIT_LABELS,
} from '../utils/unitConversions';
import Icon from './Icon';

/** Read-only itemized ledger; the dashboard retains the server's reconciled total. */
export default function HydrationDetailsModal({
  visible,
  date,
  unit,
  onClose,
  onConfigure,
}: {
  visible: boolean;
  date: string;
  unit: string;
  onClose: () => void;
  onConfigure: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const locale = useAppLocale();
  const color = useCSSVariable('--color-text-primary') as string;
  const query = useQuery({
    queryKey: waterIntakeLogQueryKey(date),
    queryFn: () => fetchWaterIntakeLog(date),
    enabled: visible,
    staleTime: 0,
  });
  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      allowSwipeDismissal
      onRequestClose={onClose}
    >
      <View
        style={{
          paddingTop: Platform.OS === 'ios' ? 12 : insets.top,
          paddingBottom: insets.bottom,
        }}
        className="flex-1 bg-background"
        accessibilityViewIsModal
      >
        <View className="flex-row items-center px-4 gap-3 border-b border-border-subtle">
          <Pressable
            testID="hydration-details-close"
            accessibilityRole="button"
            accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
            onPress={onClose}
            className="min-h-11 min-w-11 items-center justify-center"
          >
            <Icon name="close" size={24} color={color} />
          </Pressable>
          <Text
            accessibilityRole="header"
            className="text-lg font-bold text-text-primary flex-1"
          >
            {t('dashboard.hydration', { defaultValue: 'Hydration' })}
          </Text>
        </View>
        <ScrollView contentContainerClassName="p-4 gap-4">
          <Text className="text-base text-text-secondary">
            {formatDate(date, locale)}
          </Text>
          <Text className="text-sm text-text-secondary">
            {t('dashboard.hydrationLedgerNote', {
              defaultValue:
                'Recorded drinks for this day. Water from food and older daily totals may not have individual drink entries.',
            })}
          </Text>
          {query.isPending && (
            <Text className="text-text-secondary">
              {t('common.loading', { defaultValue: 'Loading...' })}
            </Text>
          )}
          {query.isError && (
            <View className="gap-2">
              <Text accessibilityRole="alert" className="text-text-primary">
                {t('dashboard.hydrationLedgerError', {
                  defaultValue: 'Could not load recorded drinks.',
                })}
              </Text>
              <Pressable
                onPress={() => void query.refetch()}
                accessibilityRole="button"
                className="min-h-11 justify-center"
              >
                <Text className="text-text-link">
                  {t('common.retry', { defaultValue: 'Retry' })}
                </Text>
              </Pressable>
            </View>
          )}
          {query.isSuccess && query.data.length === 0 && (
            <Text className="text-text-secondary">
              {t('dashboard.noRecordedDrinks', {
                defaultValue: 'No individual drinks recorded for this day.',
              })}
            </Text>
          )}
          {query.isSuccess &&
            query.data.map((entry) => (
              <View key={entry.id} className="bg-surface rounded-xl p-4 gap-1">
                <Text className="text-lg font-semibold text-text-primary">
                  {formatVolumeForUnit(
                    volumeFromMl(entry.water_ml, unit),
                    unit
                  )}{' '}
                  {WATER_UNIT_LABELS[unit] ?? unit}
                </Text>
                <Text className="text-base text-text-primary">
                  {entry.container_name ??
                    t('dashboard.quickWater', { defaultValue: 'Water' })}
                </Text>
                <Text className="text-sm text-text-secondary">
                  {new Date(entry.logged_at).toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  ·{' '}
                  {entry.source === 'manual'
                    ? t('dashboard.waterSourceManual', {
                        defaultValue: 'Manually logged',
                      })
                    : entry.source}
                </Text>
              </View>
            ))}
          <Pressable
            accessibilityRole="button"
            onPress={onConfigure}
            className="min-h-11 bg-raised rounded-xl px-4 justify-center"
          >
            <Text className="text-text-link">
              {t('waterContainers.title', { defaultValue: 'Water containers' })}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
