import { plannedActivityLabel } from '../components/tracking/trackingLabels';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  resolveExerciseModality,
  type PresetSessionExerciseRequest,
} from '@workspace/shared';
import { useStartLiveWorkout } from './useStartLiveWorkout';
import { useWorkoutPresets } from './useWorkoutPresets';
import { getWorkoutPresetById } from '../services/api/workoutPresetsApi';
import { prepareActivityExercise } from '../services/api/workoutPlansApi';
import { fetchExerciseById } from '../services/api/exerciseApi';
import { isCardioModality, makeDefaultStartSet } from '../utils/workoutSession';
import type {
  WorkoutPlanTemplate,
  WorkoutPlanAssignment,
} from '../types/workoutPlans';

export function useStartWorkoutPlanAssignment(
  navigation: Parameters<typeof useStartLiveWorkout>[0],
  date: string
) {
  const { t } = useTranslation();
  const { startLiveWorkout } = useStartLiveWorkout(navigation);
  const { presets: allPresets } = useWorkoutPresets();

  const startAssignment = useCallback(
    async (
      targetPlan: WorkoutPlanTemplate,
      assignment: WorkoutPlanAssignment
    ) => {
      if (!targetPlan || assignment.activity_type === 'rest') return;
      if (assignment.activity_type) {
        const label =
          assignment.session_name ||
          plannedActivityLabel(t, assignment.activity_type);
        const result = await prepareActivityExercise(
          String(targetPlan.id),
          String(assignment.id),
          label
        );
        const exercise = await fetchExerciseById(result.exercise_id);
        navigation.navigate('ActivityAdd', {
          date,
          selectedExercise: exercise,
          skipDraftLoad: true,
          workoutPlanAssignmentId: Number(assignment.id),
          plannedDurationMinutes:
            assignment.planned_duration_minutes ?? undefined,
          plannedDistanceKm: assignment.planned_distance_km ?? undefined,
        });
        return;
      }

      const isSequential = targetPlan.schedule_type === 'sequential';
      const sessionAssignments = isSequential
        ? targetPlan.assignments?.filter(
            (a) => (a.session_index ?? 1) === (assignment.session_index ?? 1)
          ) || [assignment]
        : assignment.exercise_id
          ? targetPlan.assignments?.filter(
              (a) =>
                a.day_of_week === assignment.day_of_week &&
                a.exercise_id &&
                !a.activity_type
            ) || [assignment]
          : [assignment];

      const startExercises: PresetSessionExerciseRequest[] = [];

      for (let i = 0; i < sessionAssignments.length; i++) {
        const a = sessionAssignments[i]!;
        if (a.workout_preset_id) {
          let preset = allPresets.find(
            (p) => String(p.id) === String(a.workout_preset_id)
          );
          if (!preset) {
            try {
              preset = await getWorkoutPresetById(Number(a.workout_preset_id));
            } catch {
              // Ignore fetch error, fallback gracefully
            }
          }
          if (preset && preset.exercises) {
            preset.exercises.forEach((ex) => {
              const modality = resolveExerciseModality(
                ex.modality,
                ex.category
              );
              startExercises.push({
                exercise_id: ex.exercise_id,
                sort_order: startExercises.length,
                duration_minutes: 0,
                notes: null,
                superset_group: ex.superset_group ?? null,
                workout_plan_assignment_id: a.id ? Number(a.id) : null,
                sets:
                  ex.sets.length === 0
                    ? [makeDefaultStartSet(1, modality)]
                    : ex.sets.map((set, setIndex) => ({
                        set_number: setIndex + 1,
                        set_type: set.set_type ?? 'normal',
                        reps: set.reps ?? null,
                        weight: set.weight ?? null,
                        duration: set.duration ?? null,
                        distance: isCardioModality(modality)
                          ? (set.distance ?? null)
                          : null,
                        rest_time: isCardioModality(modality)
                          ? 0
                          : (set.rest_time ?? null),
                        notes: set.notes ?? null,
                        rpe: null,
                        completed_at: null,
                      })),
              });
            });
          }
        } else if (a.exercise_id) {
          const modality = resolveExerciseModality(a.modality, a.category);
          startExercises.push({
            exercise_id: a.exercise_id,
            sort_order: startExercises.length,
            duration_minutes: 0,
            notes: null,
            superset_group: null,
            workout_plan_assignment_id: a.id ? Number(a.id) : null,
            sets:
              a.sets.length === 0
                ? [makeDefaultStartSet(1, modality)]
                : a.sets.map((set, setIndex) => ({
                    set_number: setIndex + 1,
                    set_type: set.set_type ?? 'normal',
                    reps: set.reps ?? null,
                    weight: set.weight ?? null,
                    duration: set.duration ?? null,
                    distance: isCardioModality(modality)
                      ? (set.distance ?? null)
                      : null,
                    rest_time: isCardioModality(modality)
                      ? 0
                      : (set.rest_time ?? null),
                    notes: set.notes ?? null,
                    rpe: null,
                    completed_at: null,
                  })),
          });
        }
      }

      if (startExercises.length === 0)
        throw new Error(
          t('weeklyPlan.startFailed', {
            defaultValue: 'Could not open the planned session. Try again.',
          })
        );

      const sessionName =
        assignment.session_name ||
        targetPlan.sequence_position?.session_name ||
        assignment.workout_preset_name ||
        assignment.exercise_name ||
        targetPlan.plan_name;

      const singlePresetId =
        sessionAssignments.length === 1 &&
        sessionAssignments[0]?.workout_preset_id
          ? Number(sessionAssignments[0].workout_preset_id)
          : undefined;

      await startLiveWorkout({
        name: sessionName,
        exercises: startExercises,
        sourcePresetId: singlePresetId,
        workoutPlanAssignmentId: assignment.id
          ? Number(assignment.id)
          : undefined,
      });
    },
    [allPresets, startLiveWorkout, navigation, date, t]
  );

  return startAssignment;
}
