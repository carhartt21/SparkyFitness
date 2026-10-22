import { selectedCalendarDay } from '../../src/utils/calendarSelection';
it('preserves calendar strings and local day near midnight without UTC conversion', () => {
  expect(selectedCalendarDay('2030-03-31')).toBe('2030-03-31');
  expect(selectedCalendarDay(new Date(2030, 2, 31, 0, 15))).toBe('2030-03-31');
  expect(selectedCalendarDay(new Date(2030, 2, 31, 23, 45))).toBe('2030-03-31');
  expect(selectedCalendarDay('2030-02-30')).toBeNull();
  expect(selectedCalendarDay(new Date('invalid'))).toBeNull();
  expect(selectedCalendarDay(null)).toBeNull();
});
