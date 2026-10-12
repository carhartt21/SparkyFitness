import {
  dateToTimeString,
  timeStringToDate,
  withLocalTime,
} from '../../src/utils/timePicker';

test('a time wheel preserves the selected calendar day in dated editors', () => {
  const original = new Date(2026, 8, 30, 23, 59);
  const changed = withLocalTime(original, '00:01');
  expect([
    changed.getFullYear(),
    changed.getMonth(),
    changed.getDate(),
  ]).toEqual([2026, 8, 30]);
  expect(dateToTimeString(changed)).toBe('00:01');
  expect(dateToTimeString(original)).toBe('23:59');
  expect(dateToTimeString(timeStringToDate('23:59'))).toBe('23:59');
});
