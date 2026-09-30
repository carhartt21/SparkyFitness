import { useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { liveActivityStatus } from '../../modules/presentation-capabilities';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
export default function WidgetGuideScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const nativeHeader = useNativeIOSHeadersActive();
  const [status, setStatus] = useState(liveActivityStatus);
  const statusLabels = {
    enabled: t('widgetGuide.status.enabled', {
      defaultValue: 'Live Activities allowed',
    }),
    disabled: t('widgetGuide.status.disabled', {
      defaultValue: 'Live Activities disabled in iOS',
    }),
    unsupported: t('widgetGuide.status.unsupported', {
      defaultValue: 'Live Activities unavailable on this system',
    }),
    unknown: t('widgetGuide.status.unknown', {
      defaultValue: 'Availability not verified in this build',
    }),
  };
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setStatus(liveActivityStatus());
    });
    return () => subscription.remove();
  }, []);
  const header = useScreenHeader({
    title: t('widgetGuide.title', {
      defaultValue: 'Widgets & Live Activities',
    }),
    left: { kind: 'back' },
  });
  return (
    <View
      className="flex-1 bg-background"
      style={nativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 32,
        }}
        contentInsetAdjustmentBehavior={nativeHeader ? 'automatic' : 'never'}
      >
        <Text className="mb-5 text-base text-text-secondary">
          {t('widgetGuide.intro', {
            defaultValue:
              'Widgets are added manually. Live Activities appear during an active session or timer. Neither requires optional server reminders.',
          })}
        </Text>
        {Platform.OS === 'ios' ? (
          <>
            <SettingsRowGroup
              title={t('widgetGuide.liveTitle', {
                defaultValue: 'Live Activities',
              })}
            >
              <SettingsRow
                title={statusLabels[status]}
                subtitle={t('widgetGuide.liveDescription', {
                  defaultValue:
                    'Start a workout, fasting timer, movement break or guided mobility session. Supported iPhones show its current state on the Lock Screen and, where available, Dynamic Island. Timers still work if presentation is unavailable.',
                })}
                subtitleNumberOfLines={0}
              />
              <SettingsRow
                title={t('widgetGuide.openSettings', {
                  defaultValue: 'Open system settings',
                })}
                onPress={() => void Linking.openSettings()}
                subtitle={t('widgetGuide.liveSettings', {
                  defaultValue:
                    'In iOS Settings → Apps → X on Track, allow Live Activities. Notifications and Live Activities have separate permissions.',
                })}
                subtitleNumberOfLines={0}
              />
            </SettingsRowGroup>
            <SettingsRowGroup
              title={t('widgetGuide.lockTitle', {
                defaultValue: 'Lock Screen widgets',
              })}
            >
              <SettingsRow
                title={t('widgetGuide.lockAdd', {
                  defaultValue: 'Add meal and routine shortcuts',
                })}
                subtitle={t('widgetGuide.lockSteps', {
                  defaultValue:
                    'Touch and hold the Lock Screen → Customize → Lock Screen → Add Widgets → X on Track. Choose meal capture or routines. Energy and macro widgets are Home Screen widgets.',
                })}
                subtitleNumberOfLines={0}
              />
            </SettingsRowGroup>
            <SettingsRowGroup
              title={t('widgetGuide.homeTitle', {
                defaultValue: 'Home Screen widgets',
              })}
            >
              <SettingsRow
                title={t('widgetGuide.homeAdd', {
                  defaultValue: 'Add an overview widget',
                })}
                subtitle={t('widgetGuide.homeSteps', {
                  defaultValue:
                    'Touch and hold an empty Home Screen area → Edit → Add Widget → X on Track. Choose energy, macros, meal capture or routines. Open the app once after installing an update to refresh shared data.',
                })}
                subtitleNumberOfLines={0}
              />
            </SettingsRowGroup>
            <SettingsRowGroup
              title={t('widgetGuide.watchTitle', {
                defaultValue: 'Apple Watch complications',
              })}
            >
              <SettingsRow
                title={t('widgetGuide.watchAdd', {
                  defaultValue: 'Add to a compatible watch face',
                })}
                subtitle={t('widgetGuide.watchSteps', {
                  defaultValue:
                    'Install the companion in the iPhone Watch app. Touch and hold the watch face → Edit → Complications. Select a compatible slot and X on Track. Tap it to open the app.',
                })}
                subtitleNumberOfLines={0}
              />
              <SettingsRow
                title={t('widgetGuide.watchAvailable', {
                  defaultValue: 'Energy goals, water and Daily Progress X',
                })}
                subtitle={t('widgetGuide.watchLimits', {
                  defaultValue:
                    'Energy goals and water use circular slots. Daily Progress X also supports rectangular, corner and inline slots where the face provides them. It reflects completed daily tasks, not an aggregate health score.',
                })}
                subtitleNumberOfLines={0}
              />
            </SettingsRowGroup>
          </>
        ) : (
          <SettingsRowGroup
            title={t('widgetGuide.homeTitle', {
              defaultValue: 'Home Screen widgets',
            })}
          >
            <SettingsRow
              title={t('widgetGuide.androidAdd', {
                defaultValue: 'Add the calorie widget',
              })}
              subtitle={t('widgetGuide.androidSteps', {
                defaultValue:
                  'Touch and hold an empty Home Screen area → Widgets → X on Track. Launcher steps may differ.',
              })}
              subtitleNumberOfLines={0}
            />
            <SettingsRow
              title={t('widgetGuide.androidLive', {
                defaultValue: 'Active timer notifications',
              })}
              subtitle={t('widgetGuide.androidLiveDescription', {
                defaultValue:
                  'iOS Live Activities and Dynamic Island are not available on Android. Existing timer and workout alerts remain available.',
              })}
              subtitleNumberOfLines={0}
            />
          </SettingsRowGroup>
        )}
        <Text className="mt-2 text-sm text-text-secondary">
          {t('widgetGuide.placementUnknown', {
            defaultValue:
              'The app cannot verify whether you added a widget or whether a notification was seen.',
          })}
        </Text>
      </ScrollView>
    </View>
  );
}
