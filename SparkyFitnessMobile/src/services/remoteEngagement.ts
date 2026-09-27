import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  engagementSettingsSchema,
  type EngagementSettings,
  type EngagementSettingsPatch,
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
): Promise<EngagementSettings | null> {
  const raw = await AsyncStorage.getItem(key(identity));
  if (!raw) return null;
  try {
    return engagementSettingsSchema.parse(JSON.parse(raw));
  } catch {
    await AsyncStorage.removeItem(key(identity));
    return null;
  }
}

async function storeSettings(
  identity: NutritionActionIdentity,
  settings: EngagementSettings
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
): Promise<EngagementSettings> {
  await assertCurrentIdentity(identity);
  const response = await apiFetch<EngagementSettings>({
    endpoint: '/api/v2/engagement/settings',
    serviceName: 'Engagement',
    operation: 'load notification settings',
  });
  await assertCurrentIdentity(identity);
  const settings = engagementSettingsSchema.parse(response);
  await storeSettings(identity, settings);
  return settings;
}

export async function patchRemoteEngagement(
  identity: NutritionActionIdentity,
  patch: Omit<EngagementSettingsPatch, 'expected_revision'>
): Promise<EngagementSettings> {
  const previous = await refreshRemoteEngagement(identity);
  const response = await apiFetch<EngagementSettings>({
    endpoint: '/api/v2/engagement/settings',
    serviceName: 'Engagement',
    operation: 'update notification settings',
    method: 'PATCH',
    body: { ...patch, expected_revision: previous.revision },
  });
  await assertCurrentIdentity(identity);
  const settings = engagementSettingsSchema.parse(response);
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
  requestPermission: boolean
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

export async function enableRemoteEngagement(
  identity: NutritionActionIdentity,
  enabledKinds: Pick<
    EngagementSettings,
    | 'hydration_enabled'
    | 'meal_capture_enabled'
    | 'meal_review_enabled'
    | 'movement_break_enabled'
    | 'mobility_enabled'
  >
): Promise<EngagementSettings> {
  await registerRemoteEngagementDevice(identity, true);
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
  ]);
  return patchRemoteEngagement(identity, {
    remote_enabled: true,
    ...enabledKinds,
  });
}
