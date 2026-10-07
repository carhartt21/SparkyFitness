import type { ExerciseSessionResponse } from '@workspace/shared';
import { createInstance } from 'i18next';
import en from '../../src/localization/locales/en/translation.json';
import de from '../../src/localization/locales/de/translation.json';
import {
  isDailyEnergyAggregate,
  workoutRecordedTime,
  workoutDisplayName,
} from '../../src/utils/workoutPresentation';
const session = (values: Partial<ExerciseSessionResponse> = {}) =>
  ({
    type: 'individual',
    id: 'test',
    name: 'Running',
    source: 'Apple Health',
    notes: 'Source: Apple Health, Activity Type: Running',
    duration_minutes: 30,
    ...values,
  }) as ExerciseSessionResponse;
it('translates a canonical import while preserving authored and Hevy names', async () => {
  const i18n = createInstance();
  await i18n.init({
    lng: 'de',
    resources: { en: { translation: en }, de: { translation: de } },
  });
  expect(workoutDisplayName(session(), 'Running', i18n.t)).toBe('Laufen');
  expect(
    workoutDisplayName(session({ source: 'manual' }), 'Running', i18n.t)
  ).toBe('Running');
  expect(
    workoutDisplayName(
      session({ source: 'Hevy', notes: 'My workout' }),
      'Running',
      i18n.t
    )
  ).toBe('Running');
  expect(workoutDisplayName(session(), 'Morning run with Alex', i18n.t)).toBe(
    'Morning run with Alex'
  );
});
it('shows a real midnight or raw source clock without displaying a sync time', () => {
  expect(
    workoutRecordedTime(session({ entry_time: '00:00:00' }), 'Europe/Berlin')
  ).toBe('00:00');
  expect(
    workoutRecordedTime(
      session({
        entry_time: null,
        activity_details: [
          {
            id: 'raw',
            exercise_entry_id: 'test',
            provider_name: 'Apple Health',
            detail_type: 'Workout_raw_data',
            detail_data: JSON.stringify({ startTime: '2026-10-03T22:15:00Z' }),
          },
        ],
      }),
      'Europe/Berlin'
    )
  ).toBe('00:15');
  expect(
    workoutRecordedTime(session({ entry_time: null }), 'Europe/Berlin')
  ).toBeNull();
});
it('excludes daily energy aggregates without hiding zero-energy actual workouts', () => {
  expect(
    isDailyEnergyAggregate(
      session({ name: 'ActiveCalories', duration_minutes: 0 })
    )
  ).toBe(true);
  expect(
    isDailyEnergyAggregate(
      session({ name: 'Running', duration_minutes: 30, calories_burned: 0 })
    )
  ).toBe(false);
  expect(
    isDailyEnergyAggregate(
      session({ name: 'ActiveCalories', source: 'manual', duration_minutes: 0 })
    )
  ).toBe(false);
});
