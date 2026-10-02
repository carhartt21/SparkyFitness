import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import {
  Modal,
  useWindowDimensions,
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
import { fetchHydrationDetails } from '../services/api/measurementsApi';
import { hydrationDetailsQueryKey } from '../hooks/queryKeys';
import { formatDate } from '../utils/dateUtils';
import { useAppLocale } from '../localization';
import {
  formatVolumeForUnit,
  volumeFromMl,
  WATER_UNIT_LABELS,
} from '../utils/unitConversions';
import Icon from './Icon';

/** Unified snapshot-backed hydration history; solid-food water is informational. */
export default function HydrationDetailsModal({
  visible,
  date,
  unit,
  onClose,
  goal,
  onConfigure,
}: {
  visible: boolean;
  date: string;
  unit: string;
  goal?: number;
  onClose: () => void;
  onConfigure: () => void;
}) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const locale = useAppLocale();
  const { fontScale } = useWindowDimensions();
  const color = useCSSVariable('--color-text-primary') as string;
  const query = useQuery({
    queryKey: hydrationDetailsQueryKey(date),
    queryFn: () => fetchHydrationDetails(date),
    enabled: visible,
    staleTime: 0,
  });
  const volume = (ml: number) =>
    `${formatVolumeForUnit(volumeFromMl(ml, unit), unit)} ${WATER_UNIT_LABELS[unit] ?? unit}`;
  const sourceLabels = {
    water: t('hydrationDetails.sources.water', {
      defaultValue: 'Logged water',
    }),
    drink: t('hydrationDetails.sources.drink', { defaultValue: 'Drinks' }),
    supplement: t('hydrationDetails.sources.supplement', {
      defaultValue: 'Supplement drinks',
    }),
    food: t('hydrationDetails.sources.food', { defaultValue: 'Solid food' }),
    imported: t('hydrationDetails.sources.imported', {
      defaultValue: 'Imported water',
    }),
  };
  const sourceLabel = (kind: keyof typeof sourceLabels) => sourceLabels[kind];
  const entries = query.data?.entries ?? [];
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
          {query.data && (
            <View className="bg-surface border border-border-subtle rounded-xl p-4 gap-3">
              <Text className="text-sm text-text-secondary">
                {t('hydrationDetails.recorded', {
                  defaultValue: 'Recorded toward your goal',
                })}
              </Text>
              <Text className="text-3xl font-bold text-text-primary">
                {volume(query.data.totals.water_ml)}
              </Text>
              {!!goal && goal > 0 && (
                <Text className="text-sm text-text-secondary">
                  {t('hydrationDetails.goal', {
                    defaultValue: 'Goal: {{value}}',
                    value: volume(goal),
                  })}
                </Text>
              )}
              {(['water', 'drink', 'supplement', 'imported'] as const).map(
                (kind) => {
                  const rows = entries.filter((entry) => entry.kind === kind);
                  if (!rows.length) return null;
                  return (
                    <View
                      key={kind}
                      className={
                        fontScale > 1.3
                          ? 'gap-1'
                          : 'flex-row justify-between gap-3'
                      }
                    >
                      <Text className="text-base text-text-secondary flex-1">
                        {sourceLabel(kind)}
                      </Text>
                      <Text className="text-base text-text-primary">
                        {volume(
                          rows.reduce(
                            (sum, entry) => sum + (entry.water_ml ?? 0),
                            0
                          )
                        )}
                      </Text>
                    </View>
                  );
                }
              )}
            </View>
          )}
          <Text className="text-sm text-text-secondary">
            {t('hydrationDetails.policy', {
              defaultValue:
                'Drinks and declared water in supplement drinks count toward your goal. Water in solid foods is shown separately.',
            })}
          </Text>
          {query.data && (
            <View className="bg-surface rounded-xl p-4 gap-2">
              <Text className="text-base font-semibold text-text-primary">
                {t('hydrationDetails.solidFood', {
                  defaultValue: 'Water in solid foods',
                })}
              </Text>
              <Text className="text-lg text-text-primary">
                {volume(query.data.totals.solid_food_ml)}
              </Text>
              <Text className="text-sm text-text-secondary">
                {t('hydrationDetails.solidFoodNote', {
                  defaultValue:
                    'Informational only. Not included in your hydration goal.',
                })}
              </Text>
              {query.data.totals.unknown_count > 0 && (
                <Text className="text-sm text-text-secondary">
                  {t('hydrationDetails.unknownNote', {
                    defaultValue:
                      '{{count}} entries have no known water content.',
                    count: query.data.totals.unknown_count,
                  })}
                </Text>
              )}
            </View>
          )}
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
          {query.isSuccess && entries.length === 0 && (
            <Text className="text-text-secondary">
              {t('dashboard.noRecordedDrinks', {
                defaultValue: 'No individual drinks recorded for this day.',
              })}
            </Text>
          )}
          {query.isSuccess && entries.length > 0 && (
            <Text
              accessibilityRole="header"
              className="text-lg font-semibold text-text-primary"
            >
              {t('hydrationDetails.history', {
                defaultValue: 'Sources and history',
              })}
            </Text>
          )}
          {query.isSuccess &&
            entries.map((entry) => (
              <View
                key={entry.id}
                className="bg-surface border border-border-subtle rounded-xl p-4 gap-2"
              >
                <View className="flex-row gap-2 items-center">
                  <Icon
                    name={entry.kind === 'food' ? 'food' : 'water'}
                    size={18}
                    color={color}
                  />
                  <Text className="text-xs text-text-secondary">
                    {sourceLabel(entry.kind)}
                  </Text>
                </View>
                <Text className="text-lg font-semibold text-text-primary">
                  {entry.water_ml === null
                    ? t('hydrationDetails.unknown', {
                        defaultValue: 'Water content unknown',
                      })
                    : volume(entry.water_ml)}
                </Text>
                <Text className="text-base text-text-primary">
                  {entry.name ??
                    t('dashboard.water', { defaultValue: 'Water' })}
                </Text>
                <Text className="text-sm text-text-secondary">
                  {entry.logged_at
                    ? new Date(entry.logged_at).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                        hourCycle: 'h23',
                        timeZone: query.data.timezone,
                      })
                    : t('hydrationDetails.noTime', {
                        defaultValue: 'Daily record \u00b7 time unavailable',
                      })}{' '}
                  · {sourceLabel(entry.kind)}
                  {entry.amount_basis === 'volume'
                    ? ` · ${t('hydrationDetails.volumeEstimate', { defaultValue: 'Estimated from drink volume' })}`
                    : ''}
                  {!entry.counts_toward_goal
                    ? ` · ${t('hydrationDetails.detailsOnly', { defaultValue: 'Details only' })}`
                    : ''}
                </Text>
                {(entry.food_entry_id || entry.medication_id) && (
                  <Pressable
                    accessibilityRole="button"
                    className="min-h-11 flex-row items-center justify-between gap-2"
                    onPress={() => {
                      onClose();
                      if (entry.medication_id)
                        navigation.navigate('MedicationDetail', {
                          medicationId: entry.medication_id,
                        });
                      else
                        navigation.navigate('Tabs', {
                          screen: 'Diary',
                          params: { selectedDate: date },
                        });
                    }}
                  >
                    <Text className="text-sm font-semibold text-text-link">
                      {entry.medication_id
                        ? t('hydrationDetails.openSupplement', {
                            defaultValue: 'Open supplement',
                          })
                        : t('hydrationDetails.openDiary', {
                            defaultValue: 'View in diary',
                          })}
                    </Text>
                    <Icon name="chevron-forward" size={18} color={color} />
                  </Pressable>
                )}
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
