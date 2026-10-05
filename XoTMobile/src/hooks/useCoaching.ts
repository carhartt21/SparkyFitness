import { useEffect, useMemo, useState } from 'react';
import { createCoachingClientV2 } from '@workspace/shared';
import { apiFetch } from '../services/api/apiClient';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import type { NutritionActionIdentity } from '../services/nutritionActionOutbox';
import { newUuid } from '../utils/ids';

export function useCoaching() {
  const [identity, setIdentity] = useState<NutritionActionIdentity | null>(
    null
  );
  useEffect(() => {
    let active = true;
    const update = () => {
      void getActiveNutritionIdentity()
        .then((value) => {
          if (active) setIdentity(value);
        })
        .catch(() => {
          if (active) setIdentity(null);
        });
    };
    update();
    const unsubscribe = subscribeNutritionIdentity(update);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const api = useMemo(
    () =>
      createCoachingClientV2(async ({ path, method, body, params }) => {
        const assert = async () => {
          const current = await getActiveNutritionIdentity();
          if (
            !identity ||
            !current ||
            current.serverConfigId !== identity.serverConfigId ||
            current.userId !== identity.userId
          )
            throw new Error('The active account changed.');
        };
        await assert();
        const query = new URLSearchParams();
        for (const [name, value] of Object.entries(params ?? {}))
          if (value !== undefined) query.set(name, String(value));
        const result = await apiFetch<unknown>({
          endpoint:
            '/api/v2/coaching' +
            path +
            (query.size ? '?' + query.toString() : ''),
          method,
          body,
          serviceName: 'Coaching',
          operation: method,
        });
        await assert();
        return result;
      }, newUuid),
    [identity]
  );
  return {
    api,
    identity,
    scope: identity ? `${identity.serverConfigId}:${identity.userId}` : null,
  };
}
