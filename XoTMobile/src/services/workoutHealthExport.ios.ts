import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  authorizationStatusFor,
  ComparisonPredicateOperator,
  queryWorkoutSamples,
  requestAuthorization,
  saveWorkoutSample,
  WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';
import WatchConnectivity, {
  type WatchWorkoutHealthEvent,
  type WatchWorkoutHealthCommand,
} from '../../modules/watch-connectivity';
import { addLog } from './LogService';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import { loadHealthPreference } from './healthkit/preferences';
import type {
  FinishedWorkoutForHealth,
  WorkoutHealthRecordingSession,
  WorkoutHealthExportResult,
} from './workoutHealthExport';

export type {
  FinishedWorkoutForHealth,
  WorkoutHealthRecordingSession,
  WorkoutHealthExportResult,
} from './workoutHealthExport';

const PREFIX = '@XOnTrack/workout-health-export/v1/';
const PREFERENCE = 'writebackWorkoutEnabled';
const WORKOUT_TYPE = 'HKWorkoutTypeIdentifier';

interface PendingExport {
  status: 'pending';
  workout: FinishedWorkoutForHealth;
  syncId: string;
}

interface WatchExport {
  status: 'watch';
  syncId: string;
  scope: string;
  sessionId: string;
  phase: 'reserved' | 'recording' | 'saved' | 'failed' | 'discarded';
  finishedAt?: number;
  save?: boolean;
  workoutUuid?: string;
  acknowledgedPhase?: WatchWorkoutHealthEvent['phase'];
}

type ExportRecord =
  | PendingExport
  | CompletedExport
  | WatchExport
  | { status: 'skipped'; syncId: string };

interface CompletedExport {
  status: 'done';
  syncId: string;
}

let operationTail: Promise<void> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = operationTail.then(work, work);
  operationTail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function identityPrefix(serverConfigId: string, userId: string): string {
  return `${PREFIX}${encodeURIComponent(serverConfigId)}/${encodeURIComponent(userId)}/`;
}

export function hasWorkoutWritePermission(): boolean {
  return authorizationStatusFor(WORKOUT_TYPE) === 2;
}

export async function isWorkoutHealthRecordingEnabled(): Promise<boolean> {
  return (await loadHealthPreference<boolean>(PREFERENCE)) === true;
}

async function exportPending(
  key: string,
  pending: PendingExport
): Promise<void> {
  if ((await loadHealthPreference<boolean>(PREFERENCE)) !== true) return;
  if (
    !hasWorkoutWritePermission() ||
    authorizationStatusFor('HKQuantityTypeIdentifierActiveEnergyBurned') !== 2
  ) {
    throw new Error('Apple Health workout write permission is not enabled.');
  }

  // A query before save handles the crash window between HealthKit saving the
  // sample and AsyncStorage recording success. The sync metadata is a second
  // safeguard: HealthKit compares versions for objects with the same ID.
  let existing = await queryWorkoutSamples({
    limit: 1,
    filter: {
      metadata: {
        withMetadataKey: 'HKSyncIdentifier',
        operatorType: ComparisonPredicateOperator.equalTo,
        value: pending.syncId,
      },
    },
  });
  if (existing.length === 0) {
    // Earlier releases wrote the constant NAME as a custom key. Keep lookup
    // compatibility without perpetuating it for new HealthKit records.
    existing = await queryWorkoutSamples({
      limit: 1,
      filter: {
        metadata: {
          withMetadataKey: 'HKMetadataKeySyncIdentifier',
          operatorType: ComparisonPredicateOperator.equalTo,
          value: pending.syncId,
        },
      },
    });
  }
  if (existing.length === 0) {
    const { startedAt, finishedAt } = pending.workout;
    if (
      startedAt == null ||
      !Number.isFinite(startedAt) ||
      !Number.isFinite(finishedAt) ||
      startedAt >= finishedAt
    ) {
      throw new Error('Completed workout has an invalid time range.');
    }
    const energy = pending.workout.activeEnergyKcal;
    if (energy == null || !Number.isFinite(energy) || energy <= 0) {
      // Includes old pending exports: absent energy is not a measured zero.
      addLog(
        '[Workout Health export] Energy unavailable; export deferred.',
        'WARNING'
      );
      return;
    }
    await saveWorkoutSample(
      WorkoutActivityType.traditionalStrengthTraining,
      [
        {
          quantityType: 'HKQuantityTypeIdentifierActiveEnergyBurned',
          quantity: energy,
          unit: 'kcal',
          startDate: new Date(startedAt),
          endDate: new Date(finishedAt),
          metadata: { HKWasUserEntered: true, XOnTrackWritebackVersion: 1 },
        },
      ],
      new Date(startedAt),
      new Date(finishedAt),
      { energyBurned: energy },
      {
        XOnTrackWritebackVersion: 1,
        HKWasUserEntered: true,
        HKSyncIdentifier: pending.syncId,
        HKSyncVersion: 1,
        HKExternalUUID: pending.syncId,
        HKWorkoutBrandName: 'X on Track',
      }
    );
    addLog('[Workout Health export] Saved workout to Apple Health.', 'INFO');
  } else {
    addLog(
      '[Workout Health export] Found existing Apple Health workout.',
      'INFO'
    );
  }
  const done: CompletedExport = { status: 'done', syncId: pending.syncId };
  await AsyncStorage.setItem(key, JSON.stringify(done));
}

async function activeIdentity() {
  return getActiveNutritionIdentity().catch(() => null);
}

async function location(sessionId: string) {
  const identity = await activeIdentity();
  if (!identity) return null;
  const prefix = identityPrefix(identity.serverConfigId, identity.userId);
  return {
    identity,
    key: `${prefix}${encodeURIComponent(sessionId)}`,
    scope: JSON.stringify([identity.serverConfigId, identity.userId]),
    syncId: `com.cg.phi.workout.${encodeURIComponent(identity.serverConfigId)}.${encodeURIComponent(identity.userId)}.${encodeURIComponent(sessionId)}`,
  };
}

async function readRecord(key: string): Promise<ExportRecord | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as ExportRecord) : null;
}

async function sendWatchCommand(
  record: WatchExport,
  action?: WatchWorkoutHealthCommand['action'],
  ackPhase?: WatchWorkoutHealthEvent['phase']
): Promise<void> {
  if (!WatchConnectivity) return;
  await WatchConnectivity.sendWorkoutHealthCommand({
    type: 'workoutHealthCommand',
    action:
      action ??
      (record.finishedAt != null
        ? record.save
          ? 'finish'
          : 'discard'
        : 'start'),
    sessionId: record.sessionId,
    scope: record.scope,
    syncId: record.syncId,
    finishedAt: record.finishedAt,
    save: record.save,
    ackPhase:
      ackPhase ??
      (record.phase === 'saved'
        ? 'saved'
        : record.phase === 'discarded'
          ? 'discarded'
          : record.phase === 'failed'
            ? 'failed'
            : undefined),
  });
}

export async function needsPhoneWorkoutEnergy(
  sessionId: string
): Promise<boolean> {
  if ((await loadHealthPreference<boolean>(PREFERENCE)) !== true) return false;
  const loc = await location(sessionId);
  if (!loc) return false;
  return serialize(async () => (await readRecord(loc.key)) == null);
}

/** Reservation is durable BEFORE sending start. Once reserved, the phone never
 * writes this session, even on timeout, permission failure, or a lost receipt. */
export async function handleWatchWorkoutHealth(
  event: WatchWorkoutHealthEvent,
  active: WorkoutHealthRecordingSession
): Promise<void> {
  await serialize(async () => {
    const loc = await location(event.sessionId);
    if (!loc || event.scope !== loc.scope) return;
    const existing = await readRecord(loc.key);
    if (event.phase === 'request') {
      if (existing?.status === 'watch') {
        await sendWatchCommand(
          existing,
          existing.phase === 'saved' ? 'ack' : undefined
        );
        return;
      }
      if (
        existing ||
        active.sessionId !== event.sessionId ||
        active.startedAt == null ||
        active.sourceServerConfigId !== loc.identity.serverConfigId ||
        (await loadHealthPreference<boolean>(PREFERENCE)) !== true
      ) {
        await WatchConnectivity?.sendWorkoutHealthCommand({
          type: 'workoutHealthCommand',
          action: 'reject',
          scope: loc.scope,
          sessionId: event.sessionId,
          syncId: loc.syncId,
        });
        return;
      }
      const reserved: WatchExport = {
        status: 'watch',
        syncId: loc.syncId,
        scope: loc.scope,
        sessionId: event.sessionId,
        phase: 'reserved',
      };
      await AsyncStorage.setItem(loc.key, JSON.stringify(reserved));
      await sendWatchCommand(reserved);
      return;
    }
    if (
      existing?.status !== 'watch' ||
      event.syncId !== existing.syncId ||
      !['recording', 'saved', 'failed', 'discarded'].includes(event.phase)
    )
      return;
    // Late progress/failure messages cannot undo a terminal success.
    if (existing.phase !== 'saved' && existing.phase !== 'discarded') {
      if (
        event.phase === 'saved' &&
        (existing.finishedAt == null || !existing.save)
      )
        return;
      existing.phase = event.phase;
      existing.workoutUuid = event.workoutUuid;
      await AsyncStorage.setItem(loc.key, JSON.stringify(existing));
    }
    await sendWatchCommand(existing, 'ack', event.phase);
    existing.acknowledgedPhase = event.phase;
    await AsyncStorage.setItem(loc.key, JSON.stringify(existing));
  });
}

export async function discardWatchWorkoutRecording(
  sessionId: string
): Promise<void> {
  await serialize(async () => {
    const loc = await location(sessionId);
    if (!loc) return;
    const record = await readRecord(loc.key);
    // A normal finish has already written its command before clearing the store.
    if (record?.status !== 'watch' || record.finishedAt != null) return;
    record.finishedAt = Date.now();
    record.save = false;
    await AsyncStorage.setItem(loc.key, JSON.stringify(record));
    await sendWatchCommand(record);
  });
}

export async function queueCompletedWorkoutExport(
  workout: FinishedWorkoutForHealth
): Promise<WorkoutHealthExportResult> {
  return serialize(async () => {
    const loc = await location(workout.sessionId);
    if (!loc) return 'skipped';
    if (
      workout.sourceServerConfigId &&
      workout.sourceServerConfigId !== loc.identity.serverConfigId
    )
      throw new Error('Workout belongs to a different server.');
    const enabled = (await loadHealthPreference<boolean>(PREFERENCE)) === true;
    const existing = await readRecord(loc.key);
    if (existing?.status === 'watch') {
      if (existing.finishedAt == null) {
        existing.finishedAt = workout.finishedAt;
        existing.save = enabled && workout.completedSetCount > 0;
        await AsyncStorage.setItem(loc.key, JSON.stringify(existing));
      }
      await sendWatchCommand(
        existing,
        existing.phase === 'saved' ? 'ack' : undefined
      );
      return existing.phase === 'saved'
        ? 'saved'
        : existing.phase === 'failed'
          ? 'watch-unavailable'
          : existing.phase === 'discarded'
            ? 'skipped'
            : 'watch-pending';
    }
    if (existing?.status === 'done') return 'saved';
    if (existing?.status === 'skipped') return 'skipped';
    if (
      !enabled ||
      workout.completedSetCount < 1 ||
      workout.activeEnergyKcal == null ||
      !Number.isFinite(workout.activeEnergyKcal) ||
      workout.activeEnergyKcal <= 0
    ) {
      // Close the session even when the user skips export. A delayed Watch
      // request must not acquire ownership after the phone has finished.
      await AsyncStorage.setItem(
        loc.key,
        JSON.stringify({ status: 'skipped', syncId: loc.syncId })
      );
      return 'skipped';
    }
    const pending: PendingExport =
      existing?.status === 'pending'
        ? {
            ...existing,
            workout: {
              ...existing.workout,
              activeEnergyKcal: workout.activeEnergyKcal,
            },
          }
        : { status: 'pending', workout, syncId: loc.syncId };
    await AsyncStorage.setItem(loc.key, JSON.stringify(pending));
    // Upgrades from the timestamp-only exporter may have Workout permission
    // without Active Energy. Ask only from this explicit foreground finish,
    // never from a background retry. Denied permission leaves the record pending.
    if (
      !hasWorkoutWritePermission() ||
      authorizationStatusFor('HKQuantityTypeIdentifierActiveEnergyBurned') !== 2
    ) {
      await requestAuthorization({
        toRead: [],
        toShare: [WORKOUT_TYPE, 'HKQuantityTypeIdentifierActiveEnergyBurned'],
      });
    }
    await exportPending(loc.key, pending);
    return 'saved';
  });
}

export async function retryPendingWorkoutExports(): Promise<void> {
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
      let record: ExportRecord;
      try {
        record = JSON.parse(raw) as ExportRecord;
      } catch {
        addLog(
          '[Workout Health export] Pending record is unreadable.',
          'ERROR'
        );
        continue;
      }
      if (record.status === 'done' || record.status === 'skipped') continue;
      const current = await activeIdentity();
      if (
        current?.serverConfigId !== identity.serverConfigId ||
        current.userId !== identity.userId
      )
        return;
      try {
        if (record.status === 'watch') {
          if (
            record.phase === 'saved' ||
            record.phase === 'discarded' ||
            record.phase === 'failed'
          ) {
            if (record.acknowledgedPhase !== record.phase) {
              await sendWatchCommand(record, 'ack', record.phase);
              record.acknowledgedPhase = record.phase;
              await AsyncStorage.setItem(key, JSON.stringify(record));
            }
          } else await sendWatchCommand(record);
        } else await exportPending(key, record);
      } catch (error) {
        addLog(
          `[Workout Health export] Retry failed: ${String(error)}`,
          'WARNING'
        );
      }
    }
  });
}
