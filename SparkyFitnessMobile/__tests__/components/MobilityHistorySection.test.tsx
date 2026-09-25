import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import MobilityHistorySection from '../../src/components/MobilityHistorySection';
import type { MobilitySession } from '../../src/services/mobilityRoutineStore';

jest.mock('../../src/localization', () => ({ getAppLocale: () => 'en-US' }));

const stamp = '2026-09-25T09:00:00.000Z';
const session: MobilitySession = {
  id: '00000000-0000-4000-8000-000000000001',
  routine: {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Desk reset',
    cue: 'off',
    reminderTime: null,
    createdAt: stamp,
    updatedAt: stamp,
    steps: [
      {
        id: '00000000-0000-4000-8000-000000000003',
        name: 'Shoulder circles',
        instructions: '',
        side: 'both',
        kind: 'timed',
        durationSeconds: 30,
        transitionSeconds: 0,
      },
      {
        id: '00000000-0000-4000-8000-000000000004',
        name: 'Side reach',
        instructions: '',
        side: 'left',
        kind: 'repetitions',
        repetitions: 8,
        transitionSeconds: 0,
      },
    ],
  },
  state: 'cancelled',
  phase: 'step',
  stepIndex: 1,
  phaseStartedAt: null,
  elapsedSeconds: 0,
  outcomes: [
    {
      stepId: '00000000-0000-4000-8000-000000000003',
      result: 'completed',
      recordedAt: stamp,
    },
  ],
  startedAt: stamp,
  endedAt: stamp,
};

it('shows only confirmed outcomes and makes saved sessions removable', () => {
  const onDelete = jest.fn();
  const screen = render(
    <MobilityHistorySection
      history={[session]}
      deleting={false}
      onDelete={onDelete}
    />
  );

  expect(screen.getByText('Ended early')).toBeTruthy();
  expect(screen.getByText('1 completed · 0 skipped')).toBeTruthy();
  expect(screen.queryByText('Shoulder circles')).toBeNull();
  fireEvent.press(screen.getByLabelText(/Review Desk reset on/));
  expect(screen.getByText('Shoulder circles')).toBeTruthy();
  expect(screen.getByText('1 step not recorded')).toBeTruthy();
  expect(screen.queryByText('Side reach')).toBeNull();
  fireEvent.press(screen.getByText('Delete session'));
  expect(onDelete).toHaveBeenCalledWith(session);
});

it('reveals older sessions on demand and explains an empty history', () => {
  const onDelete = jest.fn();
  const history = Array.from({ length: 6 }, (_, index) => ({
    ...session,
    id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
    routine: { ...session.routine, name: `Routine ${index + 1}` },
  }));
  const screen = render(
    <MobilityHistorySection
      history={history}
      deleting={false}
      onDelete={onDelete}
    />
  );
  expect(screen.queryByText('Routine 6')).toBeNull();
  fireEvent.press(screen.getByText('Show older sessions'));
  expect(screen.getByText('Routine 6')).toBeTruthy();
  screen.rerender(
    <MobilityHistorySection history={[]} deleting={false} onDelete={onDelete} />
  );
  expect(
    screen.getByText('Your finished and ended sessions will appear here.')
  ).toBeTruthy();
});
