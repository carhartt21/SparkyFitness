import { renderHook } from '@testing-library/react-native';
import type { DailyProgressItem } from '@workspace/shared';
import {
  nextProgressTasks,
  useProgressActions,
} from '../../src/hooks/useProgressActions';
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('../../src/hooks/useMealTypes', () => ({
  useMealTypes: () => ({
    mealTypes: [{ id: 'meal-id', name: 'Custom snack', user_id: 'owner' }],
  }),
}));
const task = (
  domain: DailyProgressItem['domain'],
  state: DailyProgressItem['state'] = 'pending'
): DailyProgressItem => ({
  id: domain,
  domain,
  label: domain,
  reference_id: 'meal-id',
  recorded_at: null,
  state,
  reason: 'synthetic',
});
it('previews unresolved tasks only, bounded and stable, with check-in last', () => {
  const items = [
    task('checkin'),
    task('meal'),
    task('habit', 'complete'),
    task('goal', 'excluded'),
    task('workout', 'started'),
    task('activity'),
  ];
  expect(nextProgressTasks(items, 5).map((item) => item.domain)).toEqual([
    'meal',
    'workout',
    'activity',
    'checkin',
  ]);
  expect(nextProgressTasks(items, 1).map((item) => item.domain)).toEqual([
    'meal',
  ]);
});
it('retains calendar date, subject IDs and literal meal labels in task navigation', () => {
  const hydration = jest.fn();
  const { result } = renderHook(() =>
    useProgressActions('2026-09-29', hydration)
  );
  result.current.openItem(task('meal'));
  expect(mockNavigate).toHaveBeenCalledWith('MealTypeDetail', {
    date: '2026-09-29',
    mealTypeId: 'meal-id',
    mealLabel: 'Custom snack',
  });
  result.current.openItem({ ...task('goal'), label: 'hydration' });
  expect(hydration).toHaveBeenCalledTimes(1);
});

it('routes projected activities to their dated existing destinations', () => {
  const { result } = renderHook(() =>
    useProgressActions('2026-10-02', jest.fn())
  );
  result.current.openItem({ ...task('activity'), id: 'mobility:plan' });
  expect(mockNavigate).toHaveBeenCalledWith('GuidedMobility');
  result.current.openItem({ ...task('activity'), id: 'workout:plan' });
  expect(mockNavigate).toHaveBeenCalledWith('ExerciseReview', {
    date: '2026-10-02',
  });
});
