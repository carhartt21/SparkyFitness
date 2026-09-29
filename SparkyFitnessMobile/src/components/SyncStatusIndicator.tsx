import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon, { type IconName } from './Icon';
import { useServerConnection } from '../hooks/useServerConnection';
import {
  listNutritionActions,
  subscribeNutritionActions,
} from '../services/nutritionActionOutbox';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import {
  countOutbox,
  summarizeSyncActivity,
  SYNCED_VISIBLE_MS,
  useSyncActivityStore,
  type OutboxCounts,
  type SyncIndicatorState,
} from '../services/syncActivity';
import type { RootStackParamList } from '../types/navigation';

const EMPTY: OutboxCounts = { pending: 0, syncing: 0, attention: 0 };

function useOutboxCounts(): OutboxCounts {
  const [counts, setCounts] = useState<OutboxCounts>(EMPTY);
  useEffect(() => {
    let generation = 0;
    const refresh = () => {
      const current = ++generation;
      void getActiveNutritionIdentity()
        .then((identity) => (identity ? listNutritionActions(identity) : []))
        .then((actions) => {
          if (current === generation) setCounts(countOutbox(actions));
        })
        .catch(() => {
          // Unreadable local storage is itself something to look at.
          if (current === generation)
            setCounts({ pending: 0, syncing: 0, attention: 1 });
        });
    };
    refresh();
    const stopActions = subscribeNutritionActions(refresh);
    const stopIdentity = subscribeNutritionIdentity(refresh);
    return () => {
      generation += 1;
      stopActions();
      stopIdentity();
    };
  }, []);
  return counts;
}

/**
 * Compact sync status beside Settings: a spinner while work runs, a brief
 * checkmark when the Health sync finishes, and persistent icons for unsent
 * local saves, offline waiting, or anything needing attention. Tapping opens
 * the Sync screen for details and retry. It never covers content.
 */
export default function SyncStatusIndicator() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const health = useSyncActivityStore((s) => s.health);
  const outbox = useOutboxCounts();
  const { isConnected } = useServerConnection();
  const [now, setNow] = useState(() => Date.now());
  const [secondary, green, red] = useCSSVariable([
    '--color-text-secondary',
    '--color-neon-green',
    '--color-neon-red',
  ]) as [string, string, string];

  // Re-evaluate once the checkmark's display window ends.
  useEffect(() => {
    if (health.status !== 'synced') return;
    const remaining = health.at + SYNCED_VISIBLE_MS - Date.now();
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, remaining) + 50
    );
    return () => clearTimeout(timer);
  }, [health]);

  const state: SyncIndicatorState = summarizeSyncActivity({
    health,
    outbox,
    online: isConnected,
    now: Math.max(now, health.at),
  });
  if (state === 'hidden') return null;

  const look: Record<
    Exclude<SyncIndicatorState, 'hidden' | 'syncing'>,
    { icon: IconName; color: string; label: string }
  > = {
    synced: {
      icon: 'checkmark-circle',
      color: green,
      label: t('syncStatus.synced', { defaultValue: 'Health data synced' }),
    },
    savedLocally: {
      icon: 'clock',
      color: secondary,
      label: t('syncStatus.savedLocally', {
        defaultValue: 'Saved on this phone, not yet uploaded',
      }),
    },
    waiting: {
      icon: 'cloud-offline',
      color: secondary,
      label: t('syncStatus.waiting', {
        defaultValue: 'Offline. Saved changes will upload when connected',
      }),
    },
    attention: {
      icon: 'alert-circle',
      color: red,
      label: t('syncStatus.attention', {
        defaultValue: 'Sync needs attention. Open sync details',
      }),
    },
  };
  const label =
    state === 'syncing'
      ? t('syncStatus.syncing', { defaultValue: 'Syncing' })
      : look[state].label;

  return (
    <Pressable
      testID="sync-status-indicator"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('syncStatus.hint', {
        defaultValue: 'Opens sync details',
      })}
      // Only a problem is announced; routine progress stays quiet.
      accessibilityLiveRegion={state === 'attention' ? 'polite' : 'none'}
      onPress={() => navigation.navigate('Sync')}
      className="h-11 w-11 items-center justify-center rounded-full active:opacity-70"
    >
      <View testID={`sync-status-${state}`}>
        {state === 'syncing' ? (
          <ActivityIndicator size="small" color={secondary} />
        ) : (
          <Icon name={look[state].icon} size={20} color={look[state].color} />
        )}
      </View>
    </Pressable>
  );
}
