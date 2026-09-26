import * as Notifications from 'expo-notifications';
import { z } from 'zod';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import {
  enqueueManualWaterAction,
  listNutritionActions,
} from './nutritionActionOutbox';
import {
  HYDRATION_QUICK_LOG_ACTION,
  HYDRATION_QUICK_LOG_CATEGORY,
  dismissDeliveredNotification,
} from './notifications';
import { getTodayDate } from '../utils/dateUtils';

const responseDataSchema = z.strictObject({
  version: z.literal(1),
  serverConfigId: z.string().min(1),
  userId: z.string().min(1),
  entryDate: z.iso.date(),
  clientOperationId: z.uuid(),
  waterMl: z.literal(250),
});

let initialized = false;
const handled = new Set<string>();
const inFlight = new Set<string>();

/** Only an explicit button press records water; opening a reminder does not. */
export async function handleHydrationQuickLogResponse(
  response: Notifications.NotificationResponse
): Promise<void> {
  if (response.actionIdentifier !== HYDRATION_QUICK_LOG_ACTION) return;
  const request = response.notification.request;
  if (request.content.categoryIdentifier !== HYDRATION_QUICK_LOG_CATEGORY)
    return;
  const parsed = responseDataSchema.safeParse(request.content.data);
  if (!parsed.success || parsed.data.entryDate !== getTodayDate()) return;
  const data = parsed.data;
  const identity = await getActiveNutritionIdentity();
  if (
    identity?.serverConfigId !== data.serverConfigId ||
    identity.userId !== data.userId
  )
    return;

  const key = data.clientOperationId;
  if (handled.has(key) || inFlight.has(key)) return;
  inFlight.add(key);
  try {
    // The operation ID is baked into the scheduled notification. If the
    // process restarts after the durable enqueue, the same response cannot
    // create another water entry with a new logged_at timestamp.
    const existing = (await listNutritionActions(identity)).find(
      (action) => action.clientOperationId === key
    );
    if (!existing) {
      await enqueueManualWaterAction({
        ...identity,
        entryDate: data.entryDate,
        waterMl: data.waterMl,
        loggedAt: new Date().toISOString(),
        clientOperationId: key,
      });
    } else if (
      existing.type !== 'logManualWater' ||
      existing.payload.entry_date !== data.entryDate ||
      existing.payload.water_ml !== data.waterMl
    ) {
      return;
    }
    handled.add(key);
    Notifications.clearLastNotificationResponse();
    await dismissDeliveredNotification(request.identifier);
  } finally {
    inFlight.delete(key);
  }
}

export function initHydrationQuickLogResponses(): void {
  if (initialized) return;
  initialized = true;

  Notifications.addNotificationResponseReceivedListener((response) => {
    void handleHydrationQuickLogResponse(response).catch(() => undefined);
  });
  const initial = Notifications.getLastNotificationResponse();
  if (initial?.actionIdentifier === HYDRATION_QUICK_LOG_ACTION) {
    void handleHydrationQuickLogResponse(initial).catch(() => undefined);
  }
}
