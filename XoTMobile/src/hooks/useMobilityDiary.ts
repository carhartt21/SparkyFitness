import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  mobilitySnapshotSchema,
  recordedMobilitySessionsOn,
} from '@workspace/shared';
import { apiFetch } from '../services/api/apiClient';
import {
  getMobilityState,
  subscribeMobilityState,
  type MobilityState,
} from '../services/mobilityRoutineStore';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import type { NutritionActionIdentity } from '../services/nutritionActionOutbox';

/** Existing local history is immediate; the day-scoped query adds older synced sessions. */
export function useMobilityDiary(
  day: string,
  enabled: boolean,
  timezone?: string | null
) {
  const [local, setLocal] = useState<{
    identity: NutritionActionIdentity;
    state: MobilityState;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState(false);
  const generation = useRef(0);
  const refreshLocal = useCallback(async () => {
    const request = ++generation.current;
    try {
      const identity = await getActiveNutritionIdentity();
      const state = identity ? await getMobilityState(identity) : null;
      if (request !== generation.current) return;
      setLocal(identity && state ? { identity, state } : null);
      setLocalError(false);
    } catch {
      if (request !== generation.current) return;
      setLocal(null);
      setLocalError(true);
    }
    if (request === generation.current) setLoading(false);
  }, []);
  useEffect(() => {
    void refreshLocal();
    const stopState = subscribeMobilityState(() => void refreshLocal());
    const stopIdentity = subscribeNutritionIdentity(() => {
      generation.current += 1;
      setLocal(null);
      setLoading(true);
      void refreshLocal();
    });
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshLocal();
    });
    return () => {
      generation.current += 1;
      stopState();
      stopIdentity();
      foreground.remove();
    };
  }, [refreshLocal]);
  const identity = local?.identity;
  const query = useQuery({
    queryKey: [
      'mobility-diary',
      identity?.serverConfigId,
      identity?.userId,
      day,
    ],
    enabled: enabled && !!identity,
    staleTime: 30_000,
    queryFn: async () =>
      mobilitySnapshotSchema.parse(
        await apiFetch({
          endpoint: `/api/v2/mobility?from=${encodeURIComponent(day)}&to=${encodeURIComponent(day)}`,
          serviceName: 'Mobility',
          operation: 'load diary sessions',
          expectedIdentity: identity,
        })
      ),
  });
  const resolvedTimezone =
    query.data?.timezone ??
    local?.state.timezone ??
    timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const sessions = useMemo(() => {
    if (!local) return [];
    const rows = new Map(
      (query.data?.sessions ?? [])
        .filter((row) => !row.deleted)
        .map((row) => [row.data.id, row.data])
    );
    const deleted = new Set(
      (query.data?.sessions ?? [])
        .filter((row) => row.deleted)
        .map((row) => row.data.id)
    );
    for (const session of local.state.history) {
      const remote = query.data?.sessions.find(
        (row) => row.data.id === session.id
      );
      if (
        !deleted.has(session.id) &&
        (!remote ||
          (local.state.revisions[`session:${session.id}`] ?? 0) >
            remote.revision)
      )
        rows.set(session.id, session);
    }
    // Pending explicit deletes must not reappear from a stale server response/cache.
    for (const operation of local.state.pendingOperations)
      if (operation.mutation.kind === 'session') {
        if (operation.mutation.deleted) rows.delete(operation.mutation.data.id);
        else rows.set(operation.mutation.data.id, operation.mutation.data);
      }
    return recordedMobilitySessionsOn(
      [...rows.values()],
      day,
      resolvedTimezone
    );
  }, [local, query.data, day, resolvedTimezone]);
  const remoteRefetch = query.refetch;
  const refetch = useCallback(async () => {
    await refreshLocal();
    if (enabled && identity) await remoteRefetch();
  }, [refreshLocal, enabled, identity, remoteRefetch]);
  return {
    sessions,
    timezone: resolvedTimezone,
    isLoading: loading || (query.isLoading && sessions.length === 0),
    isError: localError || query.isError,
    refetch,
  };
}
