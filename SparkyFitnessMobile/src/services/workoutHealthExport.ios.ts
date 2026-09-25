import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  authorizationStatusFor,
  ComparisonPredicateOperator,
  queryWorkoutSamples,
  saveWorkoutSample,
  WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';
import { addLog } from './LogService';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import { loadHealthPreference } from './healthkit/preferences';
import type { FinishedWorkoutForHealth } from './workoutHealthExport';

export type { FinishedWorkoutForHealth } from './workoutHealthExport';

const PREFIX = '@XOnTrack/workout-health-export/v1/';
const PREFERENCE = 'writebackWorkoutEnabled';
const WORKOUT_TYPE = 'HKWorkoutTypeIdentifier';

interface PendingExport {
  status: 'pending';
  workout: FinishedWorkoutForHealth;
  syncId: string;
}

interface CompletedExport {
  status: 'done';
  syncId: string;
}

let operationTail: Promise<void> = Promise.resolve();

function serialize(work: () => Promise<void>): Promise<void> {
  const result = operationTail.then(work, work);
  operationTail = result.catch(() => undefined);
  return result;
}

function identityPrefix(serverConfigId: string, userId: string): string {
  return `${PREFIX}${encodeURIComponent(serverConfigId)}/${encodeURIComponent(userId)}/`;
}

export function hasWorkoutWritePermission(): boolean {
  return authorizationStatusFor(WORKOUT_TYPE) === 2;
}

async function exportPending(
  key: string,
  pending: PendingExport
): Promise<void> {
  if ((await loadHealthPreference<boolean>(PREFERENCE)) !== true) return;
  if (!hasWorkoutWritePermission()) return;

  // A query before save handles the crash window between HealthKit saving the
  // sample and AsyncStorage recording success. The sync metadata is a second
  // safeguard: HealthKit compares versions for objects with the same ID.
  const existing = await queryWorkoutSamples({
    limit: 1,
    filter: {
      metadata: {
        withMetadataKey: 'HKMetadataKeySyncIdentifier',
        operatorType: ComparisonPredicateOperator.equalTo,
        value: pending.syncId,
      },
    },
  });
  if (existing.length === 0) {
    const { startedAt, finishedAt } = pending.workout;
    if (
      startedAt == null ||
      !Number.isFinite(startedAt) ||
      startedAt >= finishedAt
    ) {
      throw new Error('Completed workout has an invalid time range.');
    }
    await saveWorkoutSample(
      WorkoutActivityType.traditionalStrengthTraining,
      [],
      new Date(startedAt),
      new Date(finishedAt),
      undefined,
      {
        HKMetadataKeySyncIdentifier: pending.syncId,
        HKMetadataKeySyncVersion: 1,
        HKMetadataKeyExternalUUID: pending.syncId,
        HKMetadataKeyWorkoutBrandName: 'X on Track',
      }
    );
  }
  const done: CompletedExport = { status: 'done', syncId: pending.syncId };
  await AsyncStorage.setItem(key, JSON.stringify(done));
}

async function activeIdentity() {
  return getActiveNutritionIdentity().catch(() => null);
}

export async function queueCompletedWorkoutExport(
  workout: FinishedWorkoutForHealth
): Promise<void> {
  if (workout.completedSetCount < 1) return;
  if ((await loadHealthPreference<boolean>(PREFERENCE)) !== true) return;
  const identity = await activeIdentity();
  if (!identity)
    throw new Error('Cannot identify the signed-in workout account.');
  if (
    workout.sourceServerConfigId &&
    workout.sourceServerConfigId !== identity.serverConfigId
  ) {
    throw new Error('Workout belongs to a different server.');
  }
  const prefix = identityPrefix(identity.serverConfigId, identity.userId);
  const key = `${prefix}${encodeURIComponent(workout.sessionId)}`;
  const syncId = `com.cg.phi.workout.${encodeURIComponent(identity.serverConfigId)}.${encodeURIComponent(identity.userId)}.${encodeURIComponent(workout.sessionId)}`;
  await serialize(async () => {
    if (await AsyncStorage.getItem(key)) return;
    const pending: PendingExport = { status: 'pending', workout, syncId };
    await AsyncStorage.setItem(key, JSON.stringify(pending));
    try {
      await exportPending(key, pending);
    } catch (error) {
      addLog(
        `[Workout Health export] Pending retry: ${String(error)}`,
        'WARNING'
      );
    }
  });
}

export async function retryPendingWorkoutExports(): Promise<void> {
  if ((await loadHealthPreference<boolean>(PREFERENCE)) !== true) return;
  const identity = await activeIdentity();
  if (!identity) return;
  const prefix = identityPrefix(identity.serverConfigId, identity.userId);
  await serialize(async () => {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith(prefix)
    );
    for (const key of keys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      let record: PendingExport | CompletedExport;
      try {
        record = JSON.parse(raw) as PendingExport | CompletedExport;
      } catch {
        addLog(
          '[Workout Health export] Pending record is unreadable.',
          'ERROR'
        );
        continue;
      }
      if (record.status !== 'pending') continue;
      const current = await activeIdentity();
      if (
        current?.serverConfigId !== identity.serverConfigId ||
        current.userId !== identity.userId
      )
        return;
      try {
        await exportPending(key, record);
      } catch (error) {
        addLog(
          `[Workout Health export] Retry failed: ${String(error)}`,
          'WARNING'
        );
      }
    }
  });
}
