import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import WorkoutPlanFormScreen from '../../src/screens/WorkoutPlanFormScreen';
import type { WorkoutPlanTemplate } from '../../src/types/workoutPlans';

type Props = React.ComponentProps<typeof WorkoutPlanFormScreen>;
const mockMutateAsync = jest.fn();
const goBack = jest.fn();
const plan: WorkoutPlanTemplate = {
  id: '10',
  user_id: 'synthetic-owner',
  plan_name: 'Synthetic week',
  start_date: '2026-10-02',
  is_active: true,
  schedule_type: 'weekly',
  entry_mode: 'prompt',
  assignments: [
    {
      id: '77',
      template_id: '10',
      day_of_week: 1,
      sort_order: 0,
      activity_type: 'running',
      planned_distance_km: 10,
      sets: [],
    },
  ],
};

jest.mock('../../src/hooks', () => ({
  useServerConnection: () => ({ isConnected: true }),
}));
jest.mock('../../src/hooks/useWorkoutPlans', () => ({
  useWorkoutPlans: () => ({
    save: { mutateAsync: mockMutateAsync, isPending: false },
  }),
}));
jest.mock('../../src/hooks/useWorkoutPresets', () => ({
  useWorkoutPresets: () => ({ presets: [] }),
}));
jest.mock('../../src/components/FormScreenChrome', () => {
  const { View, Pressable, Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      onSave,
      children,
    }: {
      onSave: () => void;
      children: React.ReactNode;
    }) => (
      <View>
        <Pressable testID="save-plan" onPress={onSave}>
          <Text>Save</Text>
        </Pressable>
        {children}
      </View>
    ),
  };
});
jest.mock('../../src/components/BottomSheetPicker', () => () => null);

function show(initial: WorkoutPlanTemplate = plan) {
  return render(
    <WorkoutPlanFormScreen
      navigation={{ goBack } as Props['navigation']}
      route={{ params: { plan: initial } } as Props['route']}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMutateAsync.mockResolvedValue({ id: '10' });
});

it('preserves decimal-comma distance while typing and saves its actual number', async () => {
  const screen = show();
  const distance = screen.getByLabelText('Distance (km, optional)');
  fireEvent.changeText(distance, '10,5');
  expect(distance.props.value).toBe('10,5');
  fireEvent.press(screen.getByTestId('save-plan'));
  await waitFor(() => expect(goBack).toHaveBeenCalledTimes(1));
  expect(mockMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        assignments: [expect.objectContaining({ planned_distance_km: 10.5 })],
      }),
    })
  );
});

it('retains input after a failed save and retries once without duplicate submission', async () => {
  const screen = show();
  let rejectSave: (error: Error) => void = () => undefined;
  mockMutateAsync.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectSave = reject;
      })
  );
  fireEvent.changeText(screen.getByTestId('weekly-plan-name'), 'Retained week');
  fireEvent.press(screen.getByTestId('save-plan'));
  fireEvent.press(screen.getByTestId('save-plan'));
  expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  await act(async () => rejectSave(new Error('Synthetic temporary failure')));
  expect(goBack).not.toHaveBeenCalled();
  expect(screen.getByTestId('weekly-plan-name').props.value).toBe(
    'Retained week'
  );
  fireEvent.press(screen.getByTestId('save-plan'));
  await waitFor(() => expect(goBack).toHaveBeenCalledTimes(1));
  expect(mockMutateAsync).toHaveBeenCalledTimes(2);
});

it('rejects impossible dates and invalid numeric drafts without writing', () => {
  const screen = show({ ...plan, start_date: '2026-02-30' });
  fireEvent.press(screen.getByTestId('save-plan'));
  expect(mockMutateAsync).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Start date'), '2026-10-02');
  fireEvent.changeText(
    screen.getByLabelText('Distance (km, optional)'),
    'nonsense'
  );
  fireEvent.press(screen.getByTestId('save-plan'));
  expect(mockMutateAsync).not.toHaveBeenCalled();
});

it('moves a legacy prefill plan to prompt when adding a whole activity', async () => {
  const screen = show({ ...plan, entry_mode: 'prefill' });
  fireEvent.press(screen.getByTestId('save-plan'));
  await waitFor(() => expect(goBack).toHaveBeenCalledTimes(1));
  expect(mockMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ entry_mode: 'prompt' }),
    })
  );
});
