import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { ExtensionStorage } from '@bacons/apple-targets';
import { useQuery } from '@tanstack/react-query';
import { useServerConnection } from '../hooks/useServerConnection';
import { workoutPresetsQueryKey } from '../hooks/queryKeys';
import { fetchWorkoutPresetsPage } from '../services/api/workoutPresetsApi';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import type { NutritionActionIdentity } from '../services/nutritionActionOutbox';
import { addLog } from '../services/LogService';

const SNAPSHOT_KEY = 'routineWidgetSnapshot';
const SCOPE_KEY = 'routineWidgetScope';
const WIDGET_KIND = 'routineWidget';
const iosAppGroup = (
  Constants.expoConfig?.extra as { iosAppGroup?: string } | undefined
)?.iosAppGroup;

/** Publishes only the count of account-visible routines, never their names. */
export default function RoutineWidgetCoordinator() {
  const [identity, setIdentity] = useState<NutritionActionIdentity | null>(
    null
  );
  const { isConnected } = useServerConnection();

  useEffect(() => {
    if (Platform.OS !== 'ios' || !iosAppGroup) return;
    let generation = 0;
    const storage = new ExtensionStorage(iosAppGroup);
    const refresh = () => {
      const current = ++generation;
      // The old account's count must disappear before the identity read starts.
      try {
        storage.remove(SCOPE_KEY);
        storage.remove(SNAPSHOT_KEY);
        ExtensionStorage.reloadWidget(WIDGET_KIND);
      } catch (error) {
        addLog(
          `[RoutineWidget] Snapshot clearing failed: ${error instanceof Error ? error.name : 'unknown'}`,
          'ERROR'
        );
      }
      setIdentity(null);
      void getActiveNutritionIdentity()
        .then((next) => {
          if (current === generation) setIdentity(next);
        })
        .catch(() => {
          if (current === generation) setIdentity(null);
        });
    };
    refresh();
    const unsubscribe = subscribeNutritionIdentity(refresh);
    return () => {
      generation += 1;
      unsubscribe();
    };
  }, []);

  const query = useQuery({
    queryKey: [
      ...workoutPresetsQueryKey,
      'count',
      identity?.serverConfigId,
      identity?.userId,
    ],
    queryFn: () => fetchWorkoutPresetsPage({ page: 1, pageSize: 1 }),
    enabled:
      Platform.OS === 'ios' && !!iosAppGroup && !!identity && isConnected,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (Platform.OS !== 'ios' || !iosAppGroup) return;
    const storage = new ExtensionStorage(iosAppGroup);
    const scope = identity
      ? JSON.stringify([identity.serverConfigId, identity.userId])
      : null;
    try {
      if (!scope) return;
      // The extension compares this marker to the payload. Changing accounts
      // makes a previous payload unreadable before a new fetch has completed.
      storage.set(SCOPE_KEY, scope);
      const total = query.data?.pagination.totalCount;
      if (
        !isConnected ||
        query.isError ||
        typeof total !== 'number' ||
        !Number.isSafeInteger(total) ||
        total < 0
      ) {
        storage.remove(SNAPSHOT_KEY);
      } else {
        storage.set(SNAPSHOT_KEY, {
          version: 1,
          scope,
          total,
          generatedAt: Math.floor(query.dataUpdatedAt / 1000),
        });
      }
      ExtensionStorage.reloadWidget(WIDGET_KIND);
    } catch (error) {
      addLog(
        `[RoutineWidget] Snapshot publication failed: ${error instanceof Error ? error.name : 'unknown'}`,
        'ERROR'
      );
    }
  }, [identity, isConnected, query.data, query.dataUpdatedAt, query.isError]);

  return null;
}
