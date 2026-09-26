import { useEffect } from 'react';
import WatchConnectivity from '../../modules/watch-connectivity';
import { getActiveNutritionIdentity } from '../services/nutritionIdentity';
import {
  listNutritionActions,
  subscribeNutritionActions,
} from '../services/nutritionActionOutbox';
import { handleWatchManualWaterAction } from '../services/watchManualWaterAction';
import { addLog } from '../services/LogService';

/** Accepts Watch water actions even when the API is temporarily unavailable. */
export default function WatchManualWaterCoordinator() {
  useEffect(() => {
    const transport = WatchConnectivity;
    if (!transport?.isSupported()) return;
    const pendingIds = new Set<string>();
    const inspect = async () => {
      const identity = await getActiveNutritionIdentity();
      if (!identity || pendingIds.size === 0) return;
      const actions = await listNutritionActions(identity);
      for (const action of actions) {
        if (!pendingIds.has(action.clientOperationId)) continue;
        if (action.syncState === 'synced') {
          pendingIds.delete(action.clientOperationId);
          await transport
            .sendAck(action.clientOperationId, true)
            .catch(() => undefined);
        } else if (action.syncState === 'attentionRequired') {
          pendingIds.delete(action.clientOperationId);
          await transport
            .sendAck(action.clientOperationId, false)
            .catch(() => undefined);
        }
      }
    };
    const subscription = transport.addListener('onManualWater', (payload) => {
      pendingIds.add(payload.clientId);
      void handleWatchManualWaterAction(payload)
        .then((result) => {
          if (result === 'queued') return;
          pendingIds.delete(payload.clientId);
          void transport
            .sendAck(payload.clientId, result === 'synced')
            .catch(() => undefined);
        })
        .catch((error) => {
          pendingIds.delete(payload.clientId);
          addLog(
            `Watch manual water action failed: ${error instanceof Error ? error.name : 'unknown'}`,
            'ERROR'
          );
          void transport
            .sendAck(payload.clientId, false)
            .catch(() => undefined);
        });
    });
    const unsubscribe = subscribeNutritionActions(() => {
      void inspect().catch(() => undefined);
    });
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, []);
  return null;
}
