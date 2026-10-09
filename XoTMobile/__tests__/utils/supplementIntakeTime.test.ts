import { supplementIntakeTimestamp } from '../../src/utils/supplementIntakeTime';
const now = new Date('2026-10-09T12:49:30Z');
it('records the selected account day and quarter-hour time in UTC', () => {
  expect(
    supplementIntakeTimestamp('2026-10-08', '20:15', 'Europe/Berlin', now)
  ).toBe('2026-10-08T18:15:00.000Z');
});
it('rejects future intake, invalid clocks and nonexistent daylight-saving times', () => {
  expect(
    supplementIntakeTimestamp('2026-10-09', '15:00', 'Europe/Berlin', now)
  ).toBeNull();
  expect(
    supplementIntakeTimestamp('2026-10-08', '25:00', 'Europe/Berlin', now)
  ).toBeNull();
  expect(
    supplementIntakeTimestamp('2026-03-29', '02:30', 'Europe/Berlin', now)
  ).toBeNull();
});
