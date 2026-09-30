import { useEffect, useState } from 'react';
import { useCurrentFast } from '../hooks/useFasting';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import type { NutritionActionIdentity } from '../services/nutritionActionOutbox';
import {
  initActiveTimerLiveActivities,
  reconcileActiveTimerLiveActivities,
} from '../services/activeTimerLiveActivity';

/** Reconciles only verified account timers; no fast is fabricated from stale cache. */
export default function ActiveTimerLiveActivityCoordinator() {
  const [identity, setIdentity] = useState<NutritionActionIdentity | null>(
    null
  );
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const {
    data: fast,
    isPending,
    isError,
  } = useCurrentFast({ enabled: identity !== null });
  useEffect(() => {
    initActiveTimerLiveActivities();
    let mounted = true;
    const refresh = () => {
      void getActiveNutritionIdentity()
        .then((value) => {
          if (mounted) {
            setIdentity(value);
            setIdentityLoaded(true);
          }
        })
        .catch(() => {
          if (mounted) setIdentityLoaded(false);
        });
    };
    refresh();
    const unsubscribe = subscribeNutritionIdentity(refresh);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!identityLoaded) return;
    const verifiedFast =
      identity && !isPending && !isError
        ? fast?.user_id === identity.userId
          ? fast
          : null
        : undefined;
    void reconcileActiveTimerLiveActivities(identity, verifiedFast);
  }, [identity, identityLoaded, fast, isPending, isError]);
  return null;
}
