import { useEffect, useState } from 'react';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import {
  readDashboardSnapshot,
  saveDashboardSnapshot,
  type DashboardSnapshot,
} from '../services/dashboardSnapshot';
import type { DailySummary } from '../types/dailySummary';
import type { UserPreferences } from '../types/preferences';

/** Last successful view, bounded and isolated by authenticated account + day. */
export function useDashboardSnapshot(
  date: string,
  serverId: string | undefined,
  summary: DailySummary | undefined,
  preferences: UserPreferences | undefined,
  canSave: boolean
) {
  const [snapshot, setSnapshot] = useState<{
    serverId: string;
    value: DashboardSnapshot;
  } | null>(null);
  useEffect(() => {
    let generation = 0;
    const refresh = async (allowSave = canSave) => {
      const token = ++generation;
      setSnapshot(null);
      try {
        const identity = await getActiveNutritionIdentity();
        if (!identity || identity.serverConfigId !== serverId) return;
        const next: DashboardSnapshot | null =
          allowSave && summary?.date === date && preferences
            ? { version: 1, date, savedAt: Date.now(), summary, preferences }
            : await readDashboardSnapshot(identity, date);
        if (generation !== token) return;
        setSnapshot(
          next ? { serverId: identity.serverConfigId, value: next } : null
        );
        if (allowSave && next) await saveDashboardSnapshot(identity, next);
      } catch {
        /* A cache failure must never hide a live summary. */
      }
    };
    void refresh();
    const unsubscribe = subscribeNutritionIdentity(() => void refresh(false));
    return () => {
      ++generation;
      unsubscribe();
    };
  }, [date, serverId, summary, preferences, canSave]);
  return snapshot?.serverId === serverId && snapshot?.value.date === date
    ? snapshot.value
    : null;
}
