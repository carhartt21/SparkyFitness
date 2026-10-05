import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import {
  listNutritionActions,
  retryNutritionAction,
} from '../services/nutritionActionOutbox';
import { getActiveNutritionIdentity } from '../services/nutritionIdentity';
import { reconcileNutritionActions } from '../services/nutritionActionSync';

/** Retry the existing account-scoped outbox; both water logging surfaces share it. */
export function useRetrySavedWater(date: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);
  const inFlight = useRef(false);
  const retry = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRetrying(true);
    try {
      const identity = await getActiveNutritionIdentity();
      if (!identity) throw new Error('No active nutrition account');
      const actions = await listNutritionActions(identity);
      const failed = actions.filter(
        (action) =>
          (action.type === 'logManualWater' ||
            action.type === 'logContainerWater') &&
          action.payload.entry_date === date &&
          action.syncState === 'attentionRequired'
      );
      for (const action of failed)
        await retryNutritionAction(identity, action.clientOperationId);
      if (failed.length) await reconcileNutritionActions(queryClient);
    } catch {
      Toast.show({
        type: 'error',
        text1: t('dashboard.retrySavedWaterFailed', {
          defaultValue: 'Could not retry saved water entries',
        }),
      });
    } finally {
      inFlight.current = false;
      setRetrying(false);
    }
  }, [date, queryClient, t]);
  return { retry, retrying };
}
