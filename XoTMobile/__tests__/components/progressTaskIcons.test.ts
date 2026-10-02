import type { DailyProgressItem } from '@workspace/shared';
import { progressTaskIcon } from '../../src/components/tracking/progressTaskIcons';

const task = (patch: Partial<DailyProgressItem>): DailyProgressItem => ({
  id: 'synthetic-task',
  date: '2026-09-26',
  domain: 'habit',
  label: 'Literal personal name',
  applicable: true,
  state: 'pending',
  reference_id: 'habit-id',
  recorded_at: null,
  reason: 'not_recorded',
  ...patch,
});

it('resolves the configured habit icon by ID regardless of the task name', () => {
  const habits = [
    { id: 'habit-id', icon: 'book' },
    { id: 'different-habit', icon: 'exercise-weights' },
  ];
  expect(progressTaskIcon(task({ label: 'Klimmzüge' }), habits)).toBe('book');
  expect(
    progressTaskIcon(task({ reference_id: 'different-habit' }), habits)
  ).toBe('exercise-weights');
  expect(progressTaskIcon(task({}), [{ id: 'habit-id', icon: 'moon' }])).toBe(
    'moon'
  );
});

it('keeps a safe generic habit icon while metadata is missing or unknown', () => {
  expect(progressTaskIcon(task({ label: 'Reading' }), [])).toBe('habit');
  expect(
    progressTaskIcon(task({}), [{ id: 'habit-id', icon: 'unknown' }])
  ).toBe('habit');
});

it('distinguishes objective and planned training categories', () => {
  expect(
    progressTaskIcon(task({ domain: 'goal', label: 'hydration' }), [])
  ).toBe('water');
  expect(
    progressTaskIcon(task({ domain: 'workout', activity_type: 'strength' }), [])
  ).toBe('exercise-weights');
  expect(
    progressTaskIcon(task({ domain: 'workout', activity_type: 'soccer' }), [])
  ).toBe('exercise-soccer');
  expect(progressTaskIcon(task({ domain: 'meal' }), [])).toBe('food');
});
