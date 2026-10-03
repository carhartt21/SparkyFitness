import { useEffect, useRef, useState } from 'react';
import type { NutritionActionIdentity } from '../services/nutritionActionOutbox';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';

const EMPTY_TAGS: string[] = [];

/** Options are device preferences, not selected check-in answers. */
export function useCheckinTagOptions(historicalTags: readonly string[]) {
  const [identity, setIdentity] = useState<NutritionActionIdentity | null>(
    null
  );
  const firstScope = useRef<string | null>(null);
  const scope = identity
    ? JSON.stringify([identity.serverConfigId, identity.userId])
    : null;
  const tags = useAppPreferencesStore((state) =>
    scope ? (state.checkinCustomTagsByAccount[scope] ?? EMPTY_TAGS) : EMPTY_TAGS
  );
  const remember = useAppPreferencesStore((state) => state.rememberCheckinTags);
  useEffect(() => {
    let generation = 0;
    let mounted = true;
    const refresh = async () => {
      const request = ++generation;
      try {
        const identity = await getActiveNutritionIdentity();
        if (mounted && request === generation) setIdentity(identity);
      } catch {
        if (mounted && request === generation) setIdentity(null);
      }
    };
    void refresh();
    const stop = subscribeNutritionIdentity(() => {
      setIdentity(null);
      void refresh();
    });
    return () => {
      mounted = false;
      generation++;
      stop();
    };
  }, []);
  useEffect(() => {
    // Recover literal options from a loaded historical entry as well.
    if (!scope) return;
    if (firstScope.current === null) firstScope.current = scope;
    // An account switch must not import the old screen's loaded answers.
    if (scope === firstScope.current) remember(scope, historicalTags);
  }, [scope, historicalTags, remember]);
  return {
    tags,
    canRemember: scope !== null,
    remember: (tag: string) => {
      if (scope) remember(scope, [tag]);
    },
  };
}
