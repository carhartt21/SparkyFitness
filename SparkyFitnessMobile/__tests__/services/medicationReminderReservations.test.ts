import { medicationReminderTimes } from '../../src/services/medicationReminderReservations';

const request = (data: Record<string, unknown>) =>
  ({ content: { data } }) as never;

it('reserves base and repeat dose requests without exposing medication details', () => {
  const base = {
    medicationId: 'med-A',
    scheduleId: 'schedule-A',
    entryDate: '2026-09-23',
    baseKey: 'med_2026-09-23_med-A_schedule-A_12:00',
  };
  const times = medicationReminderTimes([
    request({ ...base, key: base.baseKey }),
    request({ ...base, key: `${base.baseKey}_10` }),
    request({ ...base, key: `${base.baseKey}_20` }),
    request({ ...base, key: base.baseKey }),
    request({ ...base, key: `${base.baseKey}_45` }),
    request({ ...base, scheduleId: null }),
    request({ ...base, entryDate: '2026-02-30' }),
    request({ unrelated: true }),
  ]);
  expect(times).toEqual([
    new Date(2026, 8, 23, 12, 0).getTime(),
    new Date(2026, 8, 23, 12, 10).getTime(),
    new Date(2026, 8, 23, 12, 20).getTime(),
  ]);
});

it('reads an older base request with no separate baseKey and crosses midnight for repeats', () => {
  const key = 'med_2026-09-23_med-A_schedule-A_23:50';
  expect(
    medicationReminderTimes([
      request({
        medicationId: 'med-A',
        scheduleId: 'schedule-A',
        entryDate: '2026-09-23',
        key,
      }),
      request({
        medicationId: 'med-A',
        scheduleId: 'schedule-A',
        entryDate: '2026-09-23',
        key: `${key}_20`,
        baseKey: key,
      }),
    ])
  ).toEqual([
    new Date(2026, 8, 23, 23, 50).getTime(),
    new Date(2026, 8, 24, 0, 10).getTime(),
  ]);
});
