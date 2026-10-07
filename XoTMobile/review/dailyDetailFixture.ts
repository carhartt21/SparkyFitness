/** Synthetic V45 read fixtures. Never used by the production entrypoint. */
import {
  activityPlanningResponseSchema,
  type ExerciseSessionResponse,
  type ActivityPlanningResponse,
} from '@workspace/shared';
export function dailyDetailSessions(date: string): ExerciseSessionResponse[] {
  const base = {
    type: 'individual' as const,
    exercise_id: null,
    entry_date: date,
    avg_heart_rate: null,
    exercise_snapshot: null,
    sets: [],
    activity_details: [],
    superset_group: null,
  };
  return [
    {
      ...base,
      id: 'a1111111-1111-4111-8111-111111111111',
      name: 'Walking',
      source: 'HealthKit',
      notes: 'Source: HealthKit, Activity Type: Walking',
      entry_time: '10:00',
      duration_minutes: 30,
      calories_burned: 125,
      distance: 2.4,
      category: 'Walking',
    },
    {
      ...base,
      id: 'a2222222-2222-4222-8222-222222222222',
      name: 'Abendtraining',
      source: 'manual',
      notes: null,
      entry_time: '20:00',
      duration_minutes: 45,
      calories_burned: 0,
      distance: null,
      category: 'Strength',
    },
    {
      ...base,
      id: 'a3333333-3333-4333-8333-333333333333',
      name: 'ActiveCalories',
      source: 'HealthKit',
      notes: 'Active calories logged from HealthKit',
      entry_time: null,
      duration_minutes: 0,
      calories_burned: 0,
      distance: null,
    },
  ];
}
export function dailyDetailPlanning(
  url: URL,
  date: string,
  workoutGoalReview = false
): ActivityPlanningResponse {
  const start = url.searchParams.get('start_date') ?? date,
    end = url.searchParams.get('end_date') ?? date;
  const onDay = date >= start && date <= end;
  const snapshot = activityPlanningResponseSchema.parse({
    start_date: start,
    end_date: end,
    timezone: 'Europe/Berlin',
    occurrences: onDay
      ? [
          {
            id: `workout:41:101:${date}`,
            date,
            source: 'workout',
            source_id: '41',
            assignment_id: 101,
            revision: 1,
            label: 'Mobility am Abend',
            plan_label: 'Wochenplan',
            activity_type: 'mobility',
            state: 'pending',
            reason: 'scheduled',
            recorded_at: null,
            evidence_ids: [],
            expected_sets: null,
            completed_sets: 0,
          },
        ]
      : [],
    records: onDay
      ? dailyDetailSessions(date)
          .slice(0, 2)
          .map((record) => ({
            id: record.id,
            date,
            label: record.name,
            activity_type: record.name === 'Walking' ? 'walking' : 'strength',
            entry_ids: [record.id],
            origin_assignment_ids: [],
            confirmed: true,
            linked_occurrence_id: null,
          }))
      : [],
    summary: [],
    workout_plans: [
      {
        id: 41,
        plan_name: 'Wochenplan',
        schedule_type: 'weekly',
        is_active: true,
        start_date: date,
        end_date: null,
        assignments: [
          {
            id: 101,
            dayOfWeek: new Date(`${date}T12:00:00`).getDay(),
            workoutPresetId: null,
            exerciseId: null,
            label: 'Mobility am Abend',
            activityType: 'mobility',
            plannedDurationMinutes: 15,
            plannedTime: '18:30',
            sets: [],
          },
        ],
      },
    ],
    note: '',
  });
  if (workoutGoalReview) {
    const occurrence = snapshot.occurrences[0];
    if (occurrence)
      Object.assign(occurrence, {
        label: 'Krafttraining',
        activity_type: 'strength',
        state: 'started',
        reason: 'partial_activity_targets',
        recorded_at: `${date}T20:35:00Z`,
        evidence_ids: ['a2222222-2222-4222-8222-222222222222'],
        target_progress: {
          duration_minutes: 35.3,
          target_duration_minutes: 45,
          distance_km: null,
          target_distance_km: null,
        },
      });
    Object.assign(snapshot.workout_plans[0].assignments[0], {
      label: 'Krafttraining',
      activityType: 'strength',
      plannedDurationMinutes: 45,
    });
    snapshot.summary = onDay
      ? [
          {
            activity_type: 'strength',
            scheduled: 1,
            completed: 0,
            started: 1,
            pending: 0,
            unknown: 0,
            excluded: 0,
          },
        ]
      : [];
  }
  return activityPlanningResponseSchema.parse(snapshot);
}
