import { act, renderHook } from '@testing-library/react-native';
import { useStartWorkoutPlanAssignment } from '../../src/hooks/useStartWorkoutPlanAssignment';
import { useStartLiveWorkout } from '../../src/hooks/useStartLiveWorkout';
import { prepareActivityExercise } from '../../src/services/api/workoutPlansApi';
import { fetchExerciseById } from '../../src/services/api/exerciseApi';
import type {
  WorkoutPlanTemplate,
  WorkoutPlanAssignment,
} from '../../src/types/workoutPlans';

jest.mock('../../src/hooks/useStartLiveWorkout', () => ({
  useStartLiveWorkout: jest.fn(),
}));
jest.mock('../../src/hooks/useWorkoutPresets', () => ({
  useWorkoutPresets: () => ({ presets: [] }),
}));
jest.mock('../../src/services/api/workoutPlansApi', () => ({
  prepareActivityExercise: jest.fn(),
}));
jest.mock('../../src/services/api/exerciseApi', () => ({
  fetchExerciseById: jest.fn(),
}));

const navigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  isFocused: jest.fn(() => true),
} as unknown as Parameters<typeof useStartWorkoutPlanAssignment>[0];
const startLiveWorkout = jest.fn();
const assignment: WorkoutPlanAssignment = {
  id: '102',
  template_id: '41',
  day_of_week: 3,
  sort_order: 0,
  activity_type: 'strength',
  session_name: 'Evening strength',
  planned_duration_minutes: 45,
  sets: [],
};
const plan: WorkoutPlanTemplate = {
  id: '41',
  user_id: 'owner',
  plan_name: 'Week',
  start_date: '2026-10-01',
  is_active: true,
  schedule_type: 'weekly',
  assignments: [assignment],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useStartLiveWorkout)
    .mockReturnValue({ startLiveWorkout, isStarting: false });
  jest
    .mocked(prepareActivityExercise)
    .mockResolvedValue({ exercise_id: 'exercise-1' });
  jest.mocked(fetchExerciseById).mockResolvedValue({
    id: 'exercise-1',
    name: 'Evening strength',
  } as Awaited<ReturnType<typeof fetchExerciseById>>);
});

it('opens routine selection for an activity plan without creating an exercise or changing the plan', async () => {
  const { result } = renderHook(() =>
    useStartWorkoutPlanAssignment(navigation, '2026-10-07')
  );
  await act(() => result.current(plan, assignment, 'routine'));
  expect(navigation.navigate).toHaveBeenCalledWith('PresetSearch', {
    plannedWorkout: { assignmentId: 102, name: 'Evening strength' },
  });
  expect(prepareActivityExercise).not.toHaveBeenCalled();
  expect(startLiveWorkout).not.toHaveBeenCalled();
});

it('retains dated activity logging with planned targets as an explicit separate action', async () => {
  const { result } = renderHook(() =>
    useStartWorkoutPlanAssignment(navigation, '2026-10-07')
  );
  await act(() => result.current(plan, assignment, 'activity'));
  expect(prepareActivityExercise).toHaveBeenCalledWith(
    '41',
    '102',
    'Evening strength'
  );
  expect(navigation.navigate).toHaveBeenCalledWith(
    'ActivityAdd',
    expect.objectContaining({
      date: '2026-10-07',
      workoutPlanAssignmentId: 102,
      plannedDurationMinutes: 45,
    })
  );
  expect(startLiveWorkout).not.toHaveBeenCalled();
});

it('offers neither live start nor logging for a rest day', async () => {
  const { result } = renderHook(() =>
    useStartWorkoutPlanAssignment(navigation, '2026-10-07')
  );
  await act(() =>
    result.current(plan, { ...assignment, activity_type: 'rest' }, 'routine')
  );
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(startLiveWorkout).not.toHaveBeenCalled();
});

it('directly starts scheduled individual-exercise routines with their assignment and incomplete sets', async () => {
  const exercise: WorkoutPlanAssignment = {
    ...assignment,
    activity_type: null,
    exercise_id: 'exercise-1',
    category: 'Strength',
    sets: [{ set_number: 1, reps: 10, weight: 40 }],
  };
  const { result } = renderHook(() =>
    useStartWorkoutPlanAssignment(navigation, '2026-10-07')
  );
  await act(() =>
    result.current({ ...plan, assignments: [exercise] }, exercise, 'routine')
  );
  expect(startLiveWorkout).toHaveBeenCalledWith(
    expect.objectContaining({
      workoutPlanAssignmentId: 102,
      exercises: [
        expect.objectContaining({
          workout_plan_assignment_id: 102,
          sets: [
            expect.objectContaining({
              reps: 10,
              weight: 40,
              completed_at: null,
            }),
          ],
        }),
      ],
    })
  );
  expect(navigation.navigate).not.toHaveBeenCalled();
});
