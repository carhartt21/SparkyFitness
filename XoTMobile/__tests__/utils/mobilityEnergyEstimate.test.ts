import { estimateMobilityActiveEnergy } from '../../src/utils/mobilityEnergyEstimate';
import { mobilitySession } from '../helpers/mobilityFixtures';

test('estimates net active calories from confirmed timed exercises, not total session time', () => {
  const session = mobilitySession();
  session.routine.steps[0] = {
    ...session.routine.steps[0]!,
    kind: 'timed',
    durationSeconds: 600,
  };
  session.endedAt = '2026-10-04T10:00:00Z';
  session.outcomes[0]!.recordedAt = session.endedAt;
  expect(estimateMobilityActiveEnergy(session, 80)).toEqual({
    activeKcal: 18,
    weightKg: 80,
    timedSeconds: 600,
  });
});
test('bounds early completion by time available and excludes transitions and skipped/repetition steps', () => {
  const session = mobilitySession();
  const first = session.routine.steps[0]!;
  session.routine.steps = [
    { ...first, kind: 'timed', durationSeconds: 600 },
    { ...first, id: 'second', kind: 'timed', durationSeconds: 600 },
    { ...first, id: 'third', kind: 'repetitions', repetitions: 10 },
  ];
  session.outcomes = [
    { stepId: first.id, result: 'skipped', recordedAt: '2026-10-04T09:01:00Z' },
    {
      stepId: 'second',
      result: 'completed',
      recordedAt: '2026-10-04T09:01:35Z',
    },
    {
      stepId: 'third',
      result: 'completed',
      recordedAt: '2026-10-04T09:03:00Z',
    },
  ];
  session.endedAt = '2026-10-04T09:03:00Z';
  expect(estimateMobilityActiveEnergy(session, 80)).toEqual({
    activeKcal: 1,
    weightKg: 80,
    timedSeconds: 30,
  });
});
test('cannot suggest energy without known weight, confirmed timed movement or a real time range', () => {
  const session = mobilitySession();
  for (const weight of [undefined, null, 0, -1, NaN, Infinity])
    expect(estimateMobilityActiveEnergy(session, weight)).toBeUndefined();
  expect(
    estimateMobilityActiveEnergy({ ...session, outcomes: [] }, 80)
  ).toBeUndefined();
  expect(
    estimateMobilityActiveEnergy({ ...session, endedAt: session.startedAt }, 80)
  ).toBeUndefined();
  session.routine.steps = [
    { ...session.routine.steps[0]!, kind: 'repetitions', repetitions: 10 },
  ];
  expect(estimateMobilityActiveEnergy(session, 80)).toBeUndefined();
});
