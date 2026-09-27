import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import {
  engagementActionSchema,
  engagementReminderKindSchema,
  type EngagementAction,
} from '@workspace/shared';
import { apiFetch } from './api/apiClient';
import { ApiError } from './api/errors';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from './nutritionIdentity';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import { getInstallationId } from './remoteEngagement';
import { newUuid } from '../utils/ids';
import {
  REMOTE_ENGAGEMENT_SKIP,
  REMOTE_ENGAGEMENT_SNOOZE,
} from './notifications';

const OUTBOX_KEY = '@XonTrack/remoteEngagementActions/v1';
type QueuedAction = {
  serverConfigId: string;
  userId: string;
  installationId: string;
  action: EngagementAction;
};
let initialized = false;
let work: Promise<void> = Promise.resolve();

function serialize(task: () => Promise<void>): Promise<void> {
  const next = work.then(task);
  work = next.catch(() => undefined);
  return next;
}

async function readQueue(): Promise<QueuedAction[]> {
  const raw = await AsyncStorage.getItem(OUTBOX_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QueuedAction =>
        item &&
        typeof item === 'object' &&
        typeof item.serverConfigId === 'string' &&
        typeof item.userId === 'string' &&
        typeof item.installationId === 'string' &&
        engagementActionSchema.safeParse(item.action).success
    );
  } catch {
    return [];
  }
}

async function enqueue(item: QueuedAction): Promise<void> {
  await serialize(async () => {
    const queue = await readQueue();
    if (
      queue.some(
        (existing) =>
          existing.serverConfigId === item.serverConfigId &&
          existing.userId === item.userId &&
          existing.action.occurrence_id === item.action.occurrence_id &&
          existing.action.action === item.action.action
      )
    )
      return;
    queue.push(item);
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
  });
}

/** Retries the exact operation ID; server receipts make a lost response harmless. */
export function flushRemoteEngagementActions(
  identity: NutritionActionIdentity
): Promise<void> {
  return serialize(async () => {
    const current = await getActiveNutritionIdentity();
    if (
      !current ||
      current.serverConfigId !== identity.serverConfigId ||
      current.userId !== identity.userId
    )
      return;
    const installationId = await getInstallationId();
    const queue = await readQueue();
    const remaining: QueuedAction[] = [];
    for (const item of queue) {
      if (
        item.serverConfigId !== identity.serverConfigId ||
        item.userId !== identity.userId ||
        item.installationId !== installationId
      ) {
        remaining.push(item);
        continue;
      }
      try {
        await apiFetch({
          endpoint: '/api/v2/engagement/actions',
          serviceName: 'Engagement',
          operation: 'respond to reminder',
          method: 'POST',
          body: item.action,
        });
      } catch (error) {
        // A deleted or no-longer-actionable occurrence cannot become valid on retry.
        if (
          !(error instanceof ApiError) ||
          ![400, 403, 404, 409].includes(error.statusCode)
        ) {
          remaining.push(item);
        }
      }
    }
    if (remaining.length !== queue.length) {
      await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(remaining));
    }
  });
}

function destination(kind: string): string {
  switch (kind) {
    case 'meal_capture':
      return 'sparkyfitnessmobile://meal-photo';
    case 'meal_review':
      return 'sparkyfitnessmobile://diary';
    case 'movement_break':
      return 'sparkyfitnessmobile://movement-break';
    case 'mobility':
      return 'sparkyfitnessmobile://guided-mobility';
    default:
      return 'sparkyfitnessmobile://dashboard';
  }
}

export function initRemoteEngagementResponses(): void {
  if (initialized) return;
  initialized = true;
  const handle = async (
    response: Notifications.NotificationResponse
  ): Promise<boolean> => {
    const data = response.notification.request.content.data;
    if (
      data?.remoteEngagementVersion !== 1 ||
      !engagementReminderKindSchema.safeParse(data.kind).success ||
      !engagementActionSchema.shape.occurrence_id.safeParse(data.occurrenceId)
        .success ||
      typeof data.userId !== 'string' ||
      typeof data.installationId !== 'string'
    )
      return true;
    if ((await getInstallationId()) !== data.installationId) return true;
    const identity = await getActiveNutritionIdentity();
    // Cold launches can deliver a response before the authenticated profile
    // has restored the account scope. Keep it until identity is known.
    if (!identity) return false;
    if (identity.userId !== data.userId) return true;
    if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      await Linking.openURL(destination(data.kind as string));
      return true;
    }
    if (
      response.actionIdentifier !== REMOTE_ENGAGEMENT_SKIP &&
      response.actionIdentifier !== REMOTE_ENGAGEMENT_SNOOZE
    )
      return true;
    const action: EngagementAction = {
      operation_id: newUuid(),
      occurrence_id: data.occurrenceId as string,
      action:
        response.actionIdentifier === REMOTE_ENGAGEMENT_SKIP
          ? 'skip'
          : 'snooze',
      ...(response.actionIdentifier === REMOTE_ENGAGEMENT_SNOOZE
        ? { snooze_minutes: 15 }
        : {}),
    };
    await enqueue({
      serverConfigId: identity.serverConfigId,
      userId: data.userId,
      installationId: data.installationId,
      action,
    });
    await flushRemoteEngagementActions(identity);
    return true;
  };
  Notifications.addNotificationResponseReceivedListener((response) => {
    void handle(response).catch(() => undefined);
  });
  let processingLast = false;
  const processLast = async () => {
    if (processingLast) return;
    const response = Notifications.getLastNotificationResponse();
    if (
      response?.notification.request.content.data?.remoteEngagementVersion !== 1
    )
      return;
    processingLast = true;
    try {
      if (await handle(response)) Notifications.clearLastNotificationResponse();
    } finally {
      processingLast = false;
    }
  };
  void processLast().catch(() => undefined);
  subscribeNutritionIdentity(() => {
    void processLast().catch(() => undefined);
  });
}
