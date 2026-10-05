import {
  coachingChangeField,
  coachingSelectedWeekdays,
  coachingToggleWeekday,
  coachingFieldLabels,
  coachingFieldOptions,
  coachingGoalFieldSchema,
  coachingMetricSchema,
  coachingMetricUnits,
  coachingMealAssignmentSchema,
  coachingWorkoutPlanSchema,
  mobilityStepSchema,
  coachingActionSchema,
  coachingSettingsV2Schema,
  defaultCoachingSettingsV2,
  coachingRunReportV2Schema,
  cloudCoachingTaskPrompt,
  coachingCadenceSchema,
  coachingContextPermissionSchema,
  createCoachingClientV2,
} from '@workspace/shared';
import { createCoachingReviewFixture } from '../review/coachingFixture';
import en from '../src/localization/locales/en/translation.json';
import de from '../src/localization/locales/de/translation.json';

describe('shared owner review editor contracts', () => {
  it('edits everyday and selected-day schedules without creating an empty schedule', () => {
    expect(coachingSelectedWeekdays(null)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(coachingToggleWeekday(null, 0)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(coachingToggleWeekday([1], 1)).toEqual([1]);
    expect(coachingToggleWeekday([5, 1], 3)).toEqual([1, 3, 5]);
  });
  it('loads the existing habit type when changing a reference so historical logs stay valid', () => {
    const habit = coachingChangeField(
      {
        kind: 'habit',
        habitId: null,
        definition: {
          name: 'New habit',
          habit_type: 'completion',
          target: null,
          step: null,
          days: null,
        },
      },
      'habitId',
      '00000000-0000-4000-8000-000000000001',
      {
        name: 'Existing count habit',
        habit_type: 'count',
        target: 3,
        unit: 'count',
        days: [1, 3],
        reminder_time: null,
        active: true,
      }
    );
    expect(coachingActionSchema.safeParse(habit).success).toBe(true);
    expect(habit.definition).toMatchObject({
      name: 'Existing count habit',
      habit_type: 'count',
      target: 3,
      days: [1, 3],
    });
  });
  it('translates every bounded field and metric in English and reviewed German', () => {
    for (const catalog of [en.coaching, de.coaching]) {
      const fields = catalog.fields as Record<string, string>;
      const options = catalog.options as Record<string, string>;
      for (const key of Object.keys(coachingFieldLabels))
        expect(fields[key]).toEqual(expect.any(String));
      for (const key of [
        ...coachingMetricSchema.options,
        ...coachingGoalFieldSchema.options,
        ...Object.values(coachingFieldOptions).flat(),
      ])
        expect(options[key]).toEqual(expect.any(String));
    }
  });
  it('switches meal types, schedule types and mobility step types without retaining conflicting fields', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const meal = coachingChangeField(
      {
        item_type: 'food',
        day_of_week: 1,
        meal_type_id: id,
        food_id: id,
        variant_id: null,
        quantity: 100,
        unit: 'g',
      },
      'item_type',
      'meal'
    );
    expect(
      coachingMealAssignmentSchema.safeParse({ ...meal, meal_id: id }).success
    ).toBe(true);
    expect(meal).not.toHaveProperty('food_id');
    const plan = coachingChangeField(
      {
        plan_name: 'Synthetic',
        description: '',
        start_date: '2026-10-01',
        end_date: null,
        is_active: true,
        entry_mode: 'prompt',
        schedule_type: 'weekly',
        assignments: [
          {
            day_of_week: 1,
            session_index: null,
            session_name: null,
            workout_preset_id: null,
            exercise_id: id,
            sort_order: 0,
            sets: [],
          },
        ],
      },
      'schedule_type',
      'sequential'
    );
    expect(coachingWorkoutPlanSchema.safeParse(plan).success).toBe(true);
    const step = coachingChangeField(
      {
        id,
        kind: 'timed',
        name: 'Synthetic',
        instructions: '',
        side: 'both',
        transitionSeconds: 0,
        durationSeconds: 30,
      },
      'kind',
      'repetitions'
    );
    expect(mobilityStepSchema.safeParse(step).success).toBe(true);
    expect(step).not.toHaveProperty('durationSeconds');
    expect(
      coachingChangeField({ metric: 'protein', unit: 'g' }, 'metric', 'steps')
        .unit
    ).toBe(coachingMetricUnits.steps);
  });
});

describe('calendar review owner contracts', () => {
  it('uses the real client contract for the native recap list, detail and read transition', async () => {
    const respond = createCoachingReviewFixture();
    const api = createCoachingClientV2(
      async ({ path, method }) =>
        respond(
          new URL(`/api/v2/coaching${path}`, 'https://ui-review.invalid'),
          method
        ),
      () => '00000000-0000-4000-8000-000000000092'
    );
    const page = await api.loadCoachingRecaps();
    expect(page.unreadCount).toBe(1);
    expect(page.recaps[0]).not.toHaveProperty('evidence');
    const detail = await api.loadCoachingRecap(page.recaps[0]!.id);
    expect(detail.evidence).toEqual([]);
    await api.readCoachingRecap(detail.id);
    expect((await api.loadCoachingRecaps()).unreadCount).toBe(0);
  });
  it('rejects empty schedules, invalid 24-hour times and duplicate independent permissions', () => {
    expect(
      coachingSettingsV2Schema.safeParse({
        ...defaultCoachingSettingsV2,
        cadences: [],
      }).success
    ).toBe(false);
    expect(
      coachingSettingsV2Schema.safeParse({
        ...defaultCoachingSettingsV2,
        reviewTime: '8 PM',
      }).success
    ).toBe(false);
    expect(
      coachingSettingsV2Schema.safeParse({
        ...defaultCoachingSettingsV2,
        contextPermissions: ['notification_history', 'notification_history'],
      }).success
    ).toBe(false);
  });
  it('requires a recap and feedback acknowledgment for successful cloud reports', () => {
    expect(
      coachingRunReportV2Schema.safeParse({
        operationId: '00000000-0000-4000-8000-000000000001',
        runId: '00000000-0000-4000-8000-000000000001',
        leaseToken: 'synthetic',
        status: 'succeeded',
      }).success
    ).toBe(false);
  });
  it('provides reviewed German copy for all new controls and a safe copy-ready task', () => {
    for (const cadence of coachingCadenceSchema.options)
      expect(de.coaching.options[cadence]).toBeTruthy();
    for (const permission of coachingContextPermissionSchema.options)
      expect(de.coachingLoop[permission]).toBeTruthy();
    expect(de.coaching.tabs.recaps).toBe('Rückblicke');
    expect(cloudCoachingTaskPrompt('08:00', 'Europe/Berlin', 'de')).toContain(
      '08:00 (Europe/Berlin)'
    );
  });
});
