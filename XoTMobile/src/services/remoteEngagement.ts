import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import i18n from '../localization/i18n';
import { getWellbeingSession } from './wellbeingSessionStore';
import { engagementReminderKindV2Schema } from '@workspace/shared';
import { reconcileTrackingEngagementReminders } from './trackingEngagementReminders';
import {
  engagementSettingsV2Schema,
  type EngagementSettingsV2,
  type EngagementSettingsPatchV2,
} from '@workspace/shared';
import { apiFetch } from './api/apiClient';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import { newUuid } from '../utils/ids';
import { reconcileNutritionEngagementReminders } from './nutritionEngagementReminders';
import { reconcileMovementEngagementReminders } from './movementEngagementReminders';
import { reconcileMobilityEngagementReminders } from './mobilityEngagementReminders';
import { cancelWaterReminders } from '../hooks/useHydrationReminder';

const SETTINGS_PREFIX = '@XonTrack/remoteEngagement/v1/';
const INSTALLATION_KEY = '@XonTrack/installationId/v1';
const listeners = new Set<() => void>();

function key(identity: NutritionActionIdentity): string {
  return `${SETTINGS_PREFIX}${encodeURIComponent(identity.serverConfigId)}:${encodeURIComponent(identity.userId)}`;
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeRemoteEngagement(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function readCachedRemoteEngagement(
  identity: NutritionActionIdentity
): Promise<EngagementSettingsV2 | null> {
  const raw = await AsyncStorage.getItem(key(identity));
  if (!raw) return null;
  try {
    return engagementSettingsV2Schema.parse(JSON.parse(raw));
  } catch {
    await AsyncStorage.removeItem(key(identity));
    return null;
  }
}

async function storeSettings(
  identity: NutritionActionIdentity,
  settings: EngagementSettingsV2
): Promise<void> {
  await AsyncStorage.setItem(key(identity), JSON.stringify(settings));
  notify();
}

async function assertCurrentIdentity(
  identity: NutritionActionIdentity
): Promise<void> {
  const current = await getActiveNutritionIdentity();
  if (
    !current ||
    current.serverConfigId !== identity.serverConfigId ||
    current.userId !== identity.userId
  ) {
    throw new Error('The active account changed.');
  }
}

export async function refreshRemoteEngagement(
  identity: NutritionActionIdentity
): Promise<EngagementSettingsV2> {
  await assertCurrentIdentity(identity);
  const response = await apiFetch<EngagementSettingsV2>({
    endpoint: '/api/v2/engagement/settings?version=2',
    serviceName: 'Engagement',
    operation: 'load notification settings',
  });
  await assertCurrentIdentity(identity);
  const settings = engagementSettingsV2Schema.parse(response);
  await storeSettings(identity, settings);
  if (!settings.schedule_initialized)
    return applyRemotePatch(identity, currentReminderSchedule());
  return settings;
}

async function applyRemotePatch(
  identity: NutritionActionIdentity,
  patch: Omit<EngagementSettingsPatchV2, 'expected_revision'>
): Promise<EngagementSettingsV2> {
  await assertCurrentIdentity(identity);
  const previous =
    (await readCachedRemoteEngagement(identity)) ??
    (await refreshRemoteEngagement(identity));
  const response = await apiFetch<EngagementSettingsV2>({
    endpoint: '/api/v2/engagement/settings?version=2',
    serviceName: 'Engagement',
    operation: 'update notification settings',
    method: 'PATCH',
    body: { ...patch, expected_revision: previous.revision },
  });
  await assertCurrentIdentity(identity);
  const settings = engagementSettingsV2Schema.parse(response);
  await storeSettings(identity, settings);
  return settings;
}

export async function getInstallationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;
  const created = newUuid();
  await AsyncStorage.setItem(INSTALLATION_KEY, created);
  return created;
}

/** Register only after permission. A development build without APNs stays local. */
export async function registerRemoteEngagementDevice(
  identity: NutritionActionIdentity,
  requestPermission: boolean,
  deliveryOwner: 'local' | 'remote' = 'remote'
): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('Remote reminders require an iOS or Android device.');
  }
  await assertCurrentIdentity(identity);
  const permission = requestPermission
    ? await Notifications.requestPermissionsAsync()
    : await Notifications.getPermissionsAsync();
  if (!permission.granted)
    throw new Error('Notification permission is not granted.');
  const projectId =
    Constants.easConfig?.projectId ??
    (
      Constants.expoConfig?.extra as
        { eas?: { projectId?: string } } | undefined
    )?.eas?.projectId;
  if (!projectId) throw new Error('Expo project ID is unavailable.');
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await assertCurrentIdentity(identity);
  await apiFetch<void>({
    endpoint: '/api/v2/engagement/devices',
    serviceName: 'Engagement',
    operation: 'register notification device',
    method: 'PUT',
    body: {
      installation_id: await getInstallationId(),
      expo_push_token: token.data,
      platform: Platform.OS,
      protocol_version: 2,
      reminder_kinds: engagementReminderKindV2Schema.options,
      delivery_owner: deliveryOwner,
      language: i18n.language.startsWith('de') ? 'de' : 'en',
    },
  });
}

/** Best effort before replacing the active server or credentials. */
export async function retireCurrentRemoteEngagementDevice(): Promise<void> {
  const identity = await getActiveNutritionIdentity();
  if (!identity) return;
  const installationId = await getInstallationId();
  await apiFetch<void>({
    endpoint: `/api/v2/engagement/devices/${installationId}`,
    serviceName: 'Engagement',
    operation: 'unregister notification device',
    method: 'DELETE',
  });
}

export function currentReminderSchedule(): Omit<
  EngagementSettingsPatchV2,
  'expected_revision'
> {
  const p = useAppPreferencesStore.getState();
  return {
    daily_limit: p.optionalReminderDailyLimit,
    hydration_interval_hours: p.waterReminderIntervalHours,
    hydration_start: p.waterReminderWindowStart,
    hydration_end: p.waterReminderWindowEnd,
    meal_capture_start: p.mealCaptureWindowStart,
    meal_capture_end: p.mealCaptureWindowEnd,
    meal_capture_time: p.mealCapturePromptTime,
    meal_review_time: p.mealPhotoReviewTime,
    movement_break_time: p.movementBreakReminderTime,
  };
}
export async function enableRemoteEngagement(
  identity: NutritionActionIdentity,
  enabledKinds: Pick<
    EngagementSettingsV2,
    | 'hydration_enabled'
    | 'meal_capture_enabled'
    | 'meal_review_enabled'
    | 'movement_break_enabled'
    | 'mobility_enabled'
  >
): Promise<EngagementSettingsV2> {
  await registerRemoteEngagementDevice(identity, true, 'local');
  await cancelLocalOptionalReminders(identity);
  const settings = await patchRemoteEngagement(identity, {
    remote_enabled: true,
    ...currentReminderSchedule(),
    ...enabledKinds,
  });
  await registerRemoteEngagementDevice(identity, false, 'remote');
  return settings;
}

export async function cancelLocalOptionalReminders(
  identity: NutritionActionIdentity
): Promise<void> {
  // The first remote cycle cannot run until the mobile-owned future prompts
  // have been removed. Medication and rest timer alerts are separate owners.
  await Promise.all([
    reconcileNutritionEngagementReminders({
      identity,
      enabled: false,
      candidates: [],
    }),
    reconcileMovementEngagementReminders({
      identity,
      enabled: false,
      candidates: [],
    }),
    reconcileMobilityEngagementReminders({
      identity,
      enabled: false,
      candidates: [],
    }),
    cancelWaterReminders(),
    reconcileTrackingEngagementReminders({
      identity,
      enabled: false,
      candidates: [],
      habitNames: new Map(),
    }),
  ]);
}

/** Foreground renewal follows the same cancel-before-confirm handoff as enable. */
export async function renewRemoteEngagementDevice(
  identity: NutritionActionIdentity
): Promise<void> {
  await registerRemoteEngagementDevice(identity, false, 'local');
  await cancelLocalOptionalReminders(identity);
  await registerRemoteEngagementDevice(identity, false, 'remote');
}

let settingsTail: Promise<void> = Promise.resolve();
export function patchRemoteEngagement(
  identity: NutritionActionIdentity,
  patch: Omit<EngagementSettingsPatchV2, 'expected_revision'>
): Promise<EngagementSettingsV2> {
  const next = settingsTail.then(() => applyRemotePatch(identity, patch));
  settingsTail = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}
const DEVICE_OFF_PREFIX = '@XonTrack/notification-device-off/v1/';
/** Device off is immediate locally; a persisted marker retries only this installation. */
export async function disableThisNotificationDevice(
  identity: NutritionActionIdentity
): Promise<void> {
  await AsyncStorage.setItem(DEVICE_OFF_PREFIX + key(identity), 'pending');
  await flushNotificationDeviceOff(identity);
}
export async function notificationDeviceOffPending(
  identity: NutritionActionIdentity
): Promise<boolean> {
  return (
    (await AsyncStorage.getItem(DEVICE_OFF_PREFIX + key(identity))) ===
    'pending'
  );
}
export async function flushNotificationDeviceOff(
  identity: NutritionActionIdentity
): Promise<void> {
  if (!(await notificationDeviceOffPending(identity))) return;
  await assertCurrentIdentity(identity);
  await apiFetch({
    endpoint: `/api/v2/engagement/devices/${await getInstallationId()}`,
    method: 'DELETE',
    serviceName: 'Engagement',
    operation: 'disable this notification device',
  });
  await assertCurrentIdentity(identity);
  await AsyncStorage.removeItem(DEVICE_OFF_PREFIX + key(identity));
}

/** Reuse the persisted timer record as the retry source, not another outbox. */
export async function syncMovementTimerStart(
  identity: NutritionActionIdentity
): Promise<void> {
  const timer = await getWellbeingSession();
  if (
    !timer ||
    timer.serverConfigId !== identity.serverConfigId ||
    timer.userId !== identity.userId
  )
    return;
  await assertCurrentIdentity(identity);
  await apiFetch({
    endpoint: `/api/v2/engagement/movement-starts/${timer.id}`,
    method: 'PUT',
    body: { startedAt: timer.startedAt },
    serviceName: 'Engagement',
    operation: 'sync timer start',
  });
}
