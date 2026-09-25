import { getClient } from '../db/poolManager.js';
import { log } from '../config/logging.js';
import { getExerciseById } from './exercise.js';
import {
  addDays,
  compareDays,
  dayOfWeek,
  localDateToDay,
  setsDurationMinutes,
} from '@workspace/shared';

async function createExerciseEntriesFromTemplate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templateId: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userId: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  today: any
) {
  const { default: exerciseService } =
    await import('../services/exerciseService.js');
  log(
    'info',
    `createExerciseEntriesFromTemplate called for templateId: ${templateId}, userId: ${userId}`
  );
  const client = await getClient(userId); // User-specific operation
  try {
    // Fetch the workout plan template with its assignments
    const templateResult = await client.query(
      `SELECT
          wpt.id,
          wpt.user_id,
          wpt.plan_name,
          wpt.description,
          wpt.start_date,
          wpt.end_date,
          wpt.is_active,
          COALESCE(
              (
                  SELECT json_agg(
                      json_build_object(
                          'id', wpta.id,
                          'day_of_week', wpta.day_of_week,
                          'workout_preset_id', wpta.workout_preset_id,
                          'exercise_id', wpta.exercise_id
                      )
                  )
                  FROM workout_plan_template_assignments wpta
                  WHERE wpta.template_id = wpt.id
              ),
              '[]'::json
          ) as assignments
       FROM workout_plan_templates wpt
       WHERE wpt.id = $1 AND wpt.user_id = $2`,
      [templateId, userId]
    );
    const template = templateResult.rows[0];
    log(
      'info',
      'createExerciseEntriesFromTemplate - Fetched template:',
      template
    );
    if (
      !template ||
      !template.assignments ||
      template.assignments.length === 0
    ) {
      log(
        'info',
        `No assignments found for workout plan template ${templateId} or template not found.`
      );
      return;
    }
    // start_date/end_date come from pg as Date objects; extract the YYYY-MM-DD string
    const startDay =
      typeof template.start_date === 'string'
        ? template.start_date.slice(0, 10)
        : localDateToDay(template.start_date);
    // If end_date is not provided, default to one year from start_date
    const endDay = template.end_date
      ? typeof template.end_date === 'string'
        ? template.end_date.slice(0, 10)
        : localDateToDay(template.end_date)
      : addDays(startDay, 365);
    log(
      'info',
      `createExerciseEntriesFromTemplate - Plan start_date: ${startDay}, end_date: ${endDay}`
    );
    // Start from today if template start_date is in the past
    let currentDay = compareDays(startDay, today) < 0 ? today : startDay;
    while (compareDays(currentDay, endDay) <= 0) {
      const entryDate = currentDay;
      const currentDayOfWeek = dayOfWeek(entryDate);
      for (const assignment of template.assignments) {
        if (assignment.day_of_week === currentDayOfWeek) {
          const processExercise = async (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            exerciseId: any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sets: any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            notes: any
          ) => {
            const exerciseDetails = await getExerciseById(exerciseId, userId);
            log(
              'info',
              `createExerciseEntriesFromTemplate - Fetched exerciseDetails for ${exerciseId}:`,
              exerciseDetails
            );
            const durationMinutes = setsDurationMinutes(sets, {
              fallbackMinutes: 30,
            });
            const caloriesPerHour = exerciseDetails.calories_per_hour || 0;
            const caloriesBurned = (caloriesPerHour / 60) * durationMinutes;
            log(
              'info',
              `createExerciseEntriesFromTemplate - Assignment day_of_week (${assignment.day_of_week}) matches currentDayOfWeek (${currentDayOfWeek}) for date ${entryDate}. Creating exercise entry.`
            );
            await exerciseService.createExerciseEntry(userId, userId, {
              exercise_id: exerciseId,
              duration_minutes: durationMinutes,
              calories_burned: caloriesBurned,
              entry_date: entryDate,
              notes: notes,
              sets: sets,
              workout_plan_assignment_id: assignment.id,
            });
          };
          if (assignment.exercise_id) {
            const setsResult = await client.query(
              'SELECT * FROM workout_plan_assignment_sets WHERE assignment_id = $1',
              [assignment.id]
            );
            const sets = setsResult.rows;
            await processExercise(assignment.exercise_id, sets, null);
          } else if (assignment.workout_preset_id) {
            log(
              'info',
              `createExerciseEntriesFromTemplate - Found workout_preset_id ${assignment.workout_preset_id} for date ${entryDate}. Grouping in diary.`
            );
            await exerciseService.logWorkoutPresetGrouped(
              userId,
              userId,
              assignment.workout_preset_id,
              entryDate,
              {
                source: 'Workout Plan',
                workoutPlanAssignmentId: assignment.id,
              }
            );
          }
        }
      }
      log('info', `Finished processing assignments for date ${entryDate}.`);
      currentDay = addDays(currentDay, 1);
    }
  } catch (error) {
    log(
      'error',
      // @ts-expect-error TS(2571): Object is of type 'unknown'.
      `Error creating exercise entries from template ${templateId} for user ${userId}: ${error.message}`,
      error
    );
    throw error;
  } finally {
    client.release();
  }
}

async function deleteExerciseEntriesByTemplateId(
  templateId: string | number,
  userId: string,
  today: string
) {
  const client = await getClient(userId); // User-specific operation
  try {
    await client.query('BEGIN');
    // A scheduled row becomes diary history as soon as any set is completed.
    // Delete only untouched rows; deleting a preset parent first would cascade
    // through completed child entries in a partially recorded workout.
    const entryResult = (await client.query(
      `DELETE FROM exercise_entries e
       WHERE e.user_id = $1
         AND e.entry_date >= $3
         AND e.workout_plan_assignment_id IN (
           SELECT id FROM workout_plan_template_assignments
           WHERE template_id = $2
         )
         AND NOT EXISTS (
           SELECT 1 FROM exercise_entry_sets s
           WHERE s.exercise_entry_id = e.id
             AND s.completed_at IS NOT NULL
         )
       RETURNING e.id, e.exercise_preset_entry_id`,
      [userId, templateId, today]
    )) as {
      rows: { id: string; exercise_preset_entry_id: string | null }[];
      rowCount: number | null;
    };
    const affectedPresetIds = [
      ...new Set(
        entryResult.rows
          .map((row) => row.exercise_preset_entry_id)
          .filter((id): id is string => id !== null)
      ),
    ];
    const presetResult = affectedPresetIds.length
      ? await client.query(
          `DELETE FROM exercise_preset_entries p
           WHERE p.user_id = $1
             AND p.source = 'Workout Plan'
             AND p.id = ANY($2::uuid[])
             AND NOT EXISTS (
               SELECT 1 FROM exercise_entries e
               WHERE e.exercise_preset_entry_id = p.id
             )`,
          [userId, affectedPresetIds]
        )
      : { rowCount: 0 };
    await client.query('COMMIT');
    log(
      'info',
      `Deleted ${entryResult.rowCount} uncompleted exercise entries and ${presetResult.rowCount} empty preset entries for workout plan template ${templateId} and user ${userId}.`
    );
    return (entryResult.rowCount ?? 0) + (presetResult.rowCount ?? 0);
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : String(error);
    log(
      'error',
      `Error deleting exercise entries for template ${templateId} for user ${userId}: ${message}`,
      error
    );
    throw error;
  } finally {
    client.release();
  }
}
export { createExerciseEntriesFromTemplate };
export { deleteExerciseEntriesByTemplateId };
export default {
  createExerciseEntriesFromTemplate,
  deleteExerciseEntriesByTemplateId,
};
