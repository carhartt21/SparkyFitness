import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  type CompositeScreenProps,
} from '@react-navigation/native';
import { useCSSVariable } from 'uniwind';
import {
  useServerConnection,
  useServerConfigs,
  usePreferences,
  queryClient,
} from '../hooks';
import DevTools from '../components/DevTools';
import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
import { SectionErrorBoundary } from '../components/ScreenErrorBoundary';
import {
  shareDiagnosticReport,
  sanitizeQueryKey,
} from '../services/diagnosticReportService';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import { loadLastSyncedTime } from '../services/storage';
import { formatRelativeTime } from '../utils/dateUtils';
import type { DiagnosticQueryState } from '../types/diagnosticReport';
import Constants from 'expo-constants';
import { useDiscreetMode } from '../hooks/useDiscreetMode';

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, TabParamList } from '../types/navigation';

type SettingsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

const SettingsSection: React.FC<{
  title: string;
  children: React.ReactNode;
  footer?: string;
}> = ({ title, children, footer }) => (
  <View className="mb-7">
    <Text
      className="text-lg font-bold text-text-primary px-1 mb-3"
      accessibilityRole="header"
    >
      {title}
    </Text>
    <SettingsRowGroup className="mb-0">{children}</SettingsRowGroup>
    {footer ? (
      <Text className="text-sm text-text-secondary px-1 mt-3 leading-5">
        {footer}
      </Text>
    ) : null}
  </View>
);

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { t, i18n: translationI18n } = useTranslation();
  const dateLocale = translationI18n.language.startsWith('pl')
    ? 'pl-PL'
    : 'en-US';
  const insets = useSafeAreaInsets();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding();
  const usesNativeTabs = useNativeIOSTabsActive();

  const { isConnected, isLoading: isCheckingConnection } =
    useServerConnection();
  const { activeConfig } = useServerConfigs();
  const { preferences: userPreferences } = usePreferences({
    enabled: isConnected,
  });
  const { discreetMode } = useDiscreetMode();
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [hasLoadedLastSyncedTime, setHasLoadedLastSyncedTime] = useState(false);
  const [syncHistoryUnavailable, setSyncHistoryUnavailable] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadLastSyncedTime()
        .then((time) => {
          if (!cancelled) {
            setLastSyncedTime(time);
            setSyncHistoryUnavailable(false);
          }
        })
        .catch(() => {
          if (!cancelled) setSyncHistoryUnavailable(true);
        })
        .finally(() => {
          if (!cancelled) setHasLoadedLastSyncedTime(true);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const syncSubtitle = !hasLoadedLastSyncedTime
    ? t('settings.syncChecking', { defaultValue: 'Checking sync history' })
    : syncHistoryUnavailable
      ? t('settings.syncHistoryUnavailable', {
          defaultValue: 'Sync history unavailable',
        })
      : lastSyncedTime
        ? t('settings.lastSynced', {
            defaultValue: 'Last synced {{time}}',
            time: formatRelativeTime(
              new Date(lastSyncedTime),
              t,
              dateLocale,
              userPreferences?.time_format
            ),
          })
        : t('date.neverSynced', { defaultValue: 'Never synced' });

  const [success, danger, brand, secondary, iconBackground] = useCSSVariable([
    '--color-icon-success',
    '--color-bg-danger',
    '--color-brand-secondary',
    '--color-text-secondary',
    '--color-raised',
  ]) as [string, string, string, string, string];

  const connectionStatus = isCheckingConnection
    ? t('settings.connectionStatus.checking', {
        defaultValue: 'Checking connection',
      })
    : isConnected
      ? t('settings.connectionStatus.connected', {
          defaultValue: 'Connected',
        })
      : t('settings.connectionStatus.unavailable', {
          defaultValue: 'Connection unavailable',
        });
  const serverAccessibilityLabel = !activeConfig
    ? t('settings.serverNotConfigured', {
        defaultValue: 'Server settings. No server configured.',
      })
    : isCheckingConnection
      ? t('settings.serverChecking', {
          defaultValue: 'Server settings. Checking connection.',
        })
      : isConnected
        ? t('settings.serverConnected', {
            defaultValue: 'Server settings. Connected.',
          })
        : t('settings.serverConnectionFailed', {
            defaultValue: 'Server settings. Connection failed.',
          });

  const serverSubtitle = activeConfig ? (
    <View>
      <View className="flex-row items-center mb-0.5">
        <View
          className="w-2 h-2 rounded-full mr-2"
          style={{
            backgroundColor: isCheckingConnection
              ? secondary
              : isConnected
                ? success
                : danger,
          }}
        />
        <Text className="text-sm text-text-secondary">{connectionStatus}</Text>
      </View>
      <Text
        className="text-sm text-text-secondary"
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {activeConfig.url}
      </Text>
    </View>
  ) : (
    t('settings.addServer', { defaultValue: 'Tap to add a server' })
  );

  const handleShareDiagnosticReport = async (): Promise<void> => {
    setIsSharing(true);
    try {
      const queryStates: DiagnosticQueryState[] = queryClient
        .getQueryCache()
        .getAll()
        .map((query) => ({
          queryKey: JSON.stringify(sanitizeQueryKey(query.queryKey)),
          status: query.state.status,
          fetchStatus: query.state.fetchStatus,
          isStale: query.isStale(),
          errorMessage:
            query.state.error instanceof Error
              ? query.state.error.message
              : query.state.error
                ? String(query.state.error)
                : null,
        }));

      await shareDiagnosticReport({
        isServerConnected: isConnected,
        userPreferences: userPreferences ?? null,
        queryStates,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Toast.show({
        type: 'error',
        text1: t('common.error', { defaultValue: 'Error' }),
        text2: t('settings.shareReportFailed', {
          defaultValue: 'Failed to share diagnostic report: {{error}}',
          error: errorMessage,
        }),
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      style={usesNativeTabs ? undefined : { paddingTop: insets.top }}
      contentContainerStyle={{ paddingBottom: 80 + activeWorkoutBarPadding }}
      contentInsetAdjustmentBehavior={usesNativeTabs ? 'automatic' : 'never'}
      automaticallyAdjustsScrollIndicatorInsets={usesNativeTabs}
    >
      <View className={usesNativeTabs ? 'px-5 pt-2' : 'px-5 pt-5'}>
        {!usesNativeTabs && (
          <Text
            className="text-3xl font-bold text-text-primary mb-7"
            accessibilityRole="header"
          >
            {t('settings.title', { defaultValue: 'Settings' })}
          </Text>
        )}

        <SectionErrorBoundary
          sectionName={t('settings.sections.connection', {
            defaultValue: 'Data & sync',
          })}
        >
          <SettingsSection
            title={t('settings.sections.connection', {
              defaultValue: 'Data & sync',
            })}
          >
            <SettingsRow
              icon="server"
              title={t('settings.rows.server', { defaultValue: 'Server' })}
              subtitle={serverSubtitle}
              onPress={() => navigation.navigate('ServerSettings')}
              iconColor={brand}
              iconBackgroundColor={iconBackground}
              accessibilityLabel={serverAccessibilityLabel}
            />
            <SettingsRow
              icon="health-data-sync"
              title={t('settings.rows.healthSync', {
                defaultValue: 'Health Data Sync',
              })}
              subtitle={syncSubtitle}
              onPress={() => navigation.navigate('Sync')}
              iconColor={brand}
              iconBackgroundColor={iconBackground}
            />
          </SettingsSection>
        </SectionErrorBoundary>

        <SectionErrorBoundary
          sectionName={t('settings.sections.experience', {
            defaultValue: 'App experience',
          })}
        >
          <SettingsSection
            title={t('settings.sections.experience', {
              defaultValue: 'App experience',
            })}
          >
            <SettingsRow
              icon="app-settings"
              title={t('settings.rows.app', { defaultValue: 'App Settings' })}
              onPress={() => navigation.navigate('AppSettings')}
              iconColor={secondary}
              iconBackgroundColor={iconBackground}
            />
            {isConnected && (
              <SettingsRow
                icon="dashboard-settings"
                title={t('settings.rows.dashboard', {
                  defaultValue: 'Dashboard',
                })}
                onPress={() => navigation.navigate('DashboardSettings')}
                iconColor={secondary}
                iconBackgroundColor={iconBackground}
              />
            )}
            {isConnected && (
              <SettingsRow
                icon="diary-settings"
                title={t('settings.rows.diary', { defaultValue: 'Diary' })}
                onPress={() => navigation.navigate('DiarySettings')}
                iconColor={secondary}
                iconBackgroundColor={iconBackground}
              />
            )}
          </SettingsSection>
        </SectionErrorBoundary>

        <SectionErrorBoundary
          sectionName={t('settings.sections.tracking', {
            defaultValue: 'Tracking preferences',
          })}
        >
          <SettingsSection
            title={t('settings.sections.tracking', {
              defaultValue: 'Tracking preferences',
            })}
          >
            {isConnected && (
              <SettingsRow
                icon="food-search-settings"
                title={t('settings.rows.food', { defaultValue: 'Food' })}
                onPress={() => navigation.navigate('FoodSettings')}
                iconColor={brand}
                iconBackgroundColor={iconBackground}
              />
            )}
            {isConnected && (
              <SettingsRow
                icon="calorie-settings"
                title={t('settings.rows.calories', {
                  defaultValue: 'Calories & BMR',
                })}
                onPress={() => navigation.navigate('CalorieSettings')}
                iconColor={brand}
                iconBackgroundColor={iconBackground}
              />
            )}
            <SettingsRow
              icon="workout-settings"
              title={t('settings.rows.workout', { defaultValue: 'Workout' })}
              onPress={() => navigation.navigate('WorkoutSettings')}
              iconColor={brand}
              iconBackgroundColor={iconBackground}
            />
            {isConnected && (
              <SettingsRow
                icon="wellness"
                title={
                  discreetMode
                    ? t('settings.rows.wellness', {
                        defaultValue: 'Wellness',
                      })
                    : t('settings.rows.cyclePregnancy', {
                        defaultValue: 'Cycle & Pregnancy',
                      })
                }
                onPress={() => navigation.navigate('CycleSettings')}
                iconColor={brand}
                iconBackgroundColor={iconBackground}
              />
            )}
          </SettingsSection>
        </SectionErrorBoundary>

        {isConnected && (
          <SectionErrorBoundary
            sectionName={t('settings.sections.family', {
              defaultValue: 'Family & sharing',
            })}
          >
            <SettingsSection
              title={t('settings.sections.family', {
                defaultValue: 'Family & sharing',
              })}
            >
              <SettingsRow
                icon="people"
                title={t('familyDiary.title', {
                  defaultValue: 'Family Diaries',
                })}
                onPress={() => navigation.navigate('FamilyMembers')}
                iconColor={brand}
                iconBackgroundColor={iconBackground}
              />
            </SettingsSection>
          </SectionErrorBoundary>
        )}

        <SectionErrorBoundary
          sectionName={t('settings.sections.support', {
            defaultValue: 'Help & information',
          })}
        >
          <SettingsSection
            title={t('settings.sections.support', {
              defaultValue: 'Help & information',
            })}
            footer={t('settings.shareReportDescription', {
              defaultValue:
                'Exports a local diagnostic report (app version, sync status, logs). No personal health or food data is included. Nothing is sent automatically.',
            })}
          >
            <SettingsRow
              icon="whats-new"
              title={t('settings.rows.whatsNew', {
                defaultValue: "What's New",
              })}
              onPress={() => navigation.navigate('WhatsNew')}
              iconColor={secondary}
              iconBackgroundColor={iconBackground}
            />
            <SettingsRow
              icon="info-circle"
              title={t('settings.rows.about', { defaultValue: 'About' })}
              onPress={() => navigation.navigate('About')}
              iconColor={secondary}
              iconBackgroundColor={iconBackground}
            />
            <SettingsRow
              icon="document-text"
              title={t('settings.rows.logs', { defaultValue: 'View Logs' })}
              onPress={() => navigation.navigate('Logs')}
              iconColor={secondary}
              iconBackgroundColor={iconBackground}
            />
            <SettingsRow
              icon="share"
              title={t('settings.rows.shareReport', {
                defaultValue: 'Share Diagnostic Report',
              })}
              onPress={handleShareDiagnosticReport}
              disabled={isSharing}
              iconColor={secondary}
              iconBackgroundColor={iconBackground}
              rightAccessory={
                isSharing ? <ActivityIndicator size="small" /> : undefined
              }
            />
          </SettingsSection>
        </SectionErrorBoundary>

        {__DEV__ &&
          (Constants.expoConfig?.extra?.APP_VARIANT === 'development' ||
            Constants.expoConfig?.extra?.APP_VARIANT === 'dev') && <DevTools />}
      </View>
    </ScrollView>
  );
};

export default SettingsScreen;
