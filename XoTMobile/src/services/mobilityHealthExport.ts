import {
  isRecordedMobilitySession,
  type MobilitySession,
} from '@workspace/shared';
import type { TFunction } from 'i18next';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import {
  getWorkoutHealthExportStatus,
  isWorkoutHealthRecordingEnabled,
  queueCompletedWorkoutExport,
  retryPendingWorkoutExports,
} from './workoutHealthExport';
import { requestWorkoutActiveEnergy } from './workoutEnergyPrompt';
import { queryClient } from '../hooks/queryClient';
import { latestMeasurementsOnOrBeforeQueryKey } from '../hooks/queryKeys';
import { apiFetch } from './api/apiClient';
import type { CheckInMeasurement } from '../types/measurements';
import { instantToDay } from '@workspace/shared';
import { getMobilityState } from './mobilityRoutineStore';
import { estimateMobilityActiveEnergy } from '../utils/mobilityEnergyEstimate';

/** Reuses the workout ledger and consent; it never creates a second diary entry. */
export async function exportMobilityToHealth(
  session: MobilitySession,
  identity: NutritionActionIdentity,
  t: TFunction
): Promise<'saved' | 'pending' | 'skipped' | 'disabled'> {
  const assertIdentity = async () => {
    const active = await getActiveNutritionIdentity();
    if (
      active?.serverConfigId !== identity.serverConfigId ||
      active?.userId !== identity.userId
    )
      throw new Error('Mobility account changed.');
  };
  await assertIdentity();
  if (
    !isRecordedMobilitySession(session) ||
    !session.endedAt ||
    Date.parse(session.endedAt) <= Date.parse(session.startedAt)
  )
    return 'skipped';
  if (!(await isWorkoutHealthRecordingEnabled())) return 'disabled';
  // Separate from Watch strength-session IDs while retaining the same outbox.
  const sessionId = `mobility:${session.id}`;
  const existing = await getWorkoutHealthExportStatus(sessionId);
  if (existing === 'saved' || existing === 'skipped') return existing;
  if (existing === 'pending') {
    await retryPendingWorkoutExports();
    await assertIdentity();
    return (await getWorkoutHealthExportStatus(sessionId)) === 'saved'
      ? 'saved'
      : 'pending';
  }
  const state = await getMobilityState(identity);
  const day = instantToDay(
    new Date(session.startedAt),
    state.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const queryKey = [
    ...latestMeasurementsOnOrBeforeQueryKey(day),
    identity.serverConfigId,
    identity.userId,
  ];
  // Bounded account-scoped lookup; an offline failure only removes the suggestion.
  let measurements: CheckInMeasurement | null | undefined;
  try {
    measurements = await queryClient.fetchQuery({
      queryKey,
      staleTime: 60_000,
      retry: false,
      queryFn: () =>
        apiFetch<CheckInMeasurement | null>({
          endpoint: `/api/measurements/check-in/latest-on-or-before-date?date=${encodeURIComponent(day)}`,
          serviceName: 'Measurements API',
          operation: 'load mobility estimate weight',
          expectedIdentity: identity,
          timeoutMs: 5000,
        }),
    });
  } catch {
    measurements = queryClient.getQueryData<CheckInMeasurement | null>(
      queryKey
    );
  }
  await assertIdentity();
  const weight =
    measurements?.weight == null ? undefined : Number(measurements.weight);
  const estimate = estimateMobilityActiveEnergy(session, weight);
  const activeEnergyKcal = await requestWorkoutActiveEnergy(t, {
    mobility: true,
    estimate,
  });
  await assertIdentity();
  // Skipping leaves the durable mobility history available for a later export.
  if (activeEnergyKcal === undefined) return 'skipped';
  const result = await queueCompletedWorkoutExport({
    sessionId,
    activityKind: 'mobility',
    startedAt: Date.parse(session.startedAt),
    finishedAt: Date.parse(session.endedAt),
    completedSetCount: session.outcomes.filter(
      (outcome) => outcome.result === 'completed'
    ).length,
    sourceServerConfigId: identity.serverConfigId,
    sourceUserId: identity.userId,
    activeEnergyKcal,
    energySource: estimate ? 'confirmed-estimate' : 'known',
  });
  return result === 'saved'
    ? (await getWorkoutHealthExportStatus(sessionId)) === 'saved'
      ? 'saved'
      : 'pending'
    : result === 'skipped'
      ? 'skipped'
      : 'pending';
}
