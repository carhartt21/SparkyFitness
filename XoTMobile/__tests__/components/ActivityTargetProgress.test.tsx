import React from 'react';
import { render } from '@testing-library/react-native';
import type { ActivityOccurrence } from '@workspace/shared';
import ActivityTargetProgress from '../../src/components/tracking/ActivityTargetProgress';

const occurrence: ActivityOccurrence = {
  id: 'workout:1:2:2026-10-07',
  date: '2026-10-07',
  source: 'workout',
  source_id: '1',
  assignment_id: 2,
  revision: 0,
  label: 'Strength training',
  plan_label: 'Weekly plan',
  activity_type: 'strength',
  state: 'started',
  reason: 'partial_activity_targets',
  recorded_at: '2026-10-07T20:35:00Z',
  evidence_ids: [],
  expected_sets: null,
  completed_sets: 0,
  target_progress: {
    duration_minutes: 35.3,
    target_duration_minutes: 45,
    distance_km: null,
    target_distance_km: null,
  },
};

it('shows the single-session duration against its actual target', () => {
  const view = render(<ActivityTargetProgress occurrence={occurrence} />);
  expect(view.getByText('35.3 of 45 min')).toBeTruthy();
});

it('does not invent metrics for older responses, missing evidence or untargeted values', () => {
  for (const row of [
    undefined,
    { ...occurrence, target_progress: undefined },
    {
      ...occurrence,
      state: 'pending' as const,
      target_progress: {
        ...occurrence.target_progress!,
        duration_minutes: null,
      },
    },
    {
      ...occurrence,
      target_progress: {
        ...occurrence.target_progress!,
        target_duration_minutes: null,
      },
    },
  ]) {
    expect(
      render(<ActivityTargetProgress occurrence={row} />).toJSON()
    ).toBeNull();
  }
});
it('explains an unrecorded required metric instead of treating it as zero or hiding the target', () => {
  const view = render(
    <ActivityTargetProgress
      occurrence={{
        ...occurrence,
        target_progress: {
          ...occurrence.target_progress!,
          duration_minutes: null,
          target_distance_km: 5,
        },
      }}
    />
  );
  expect(view.getByText('Time not recorded · target 45 min')).toBeTruthy();
  expect(view.getByText('Distance not recorded · target 5 km')).toBeTruthy();
});

it('shows distance separately and explains why an ambiguous match needs an owner decision', () => {
  const view = render(
    <ActivityTargetProgress
      occurrence={{
        ...occurrence,
        reason: 'ambiguous_activity_records',
        target_progress: {
          ...occurrence.target_progress!,
          distance_km: 3.2,
          target_distance_km: 5,
        },
      }}
    />
  );
  expect(view.getByText('3.2 of 5 km')).toBeTruthy();
  expect(
    view.getByText(
      'Several sessions match. Link the session that should count.'
    )
  ).toBeTruthy();
});
