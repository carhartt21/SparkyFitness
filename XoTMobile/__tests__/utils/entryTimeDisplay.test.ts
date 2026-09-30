import { initializeI18n } from '../../src/localization/i18n';
import {
  formatTimeLabel,
  is12HourTimeFormat,
} from '../../src/utils/entryTimeDisplay';

describe('entry time display uses a 24-hour clock', () => {
  beforeAll(async () => {
    await initializeI18n('en');
  });

  test("HH:mm (24-hour) renders '15:38' regardless of locale AM/PM default", () => {
    expect(formatTimeLabel('15:38', 'HH:mm')).toBe('15:38');
    expect(formatTimeLabel('09:05:00', 'HH:mm')).toBe('09:05');
  });

  test('legacy 12-hour account values still display 24-hour time', () => {
    expect(formatTimeLabel('15:38', 'h:mm A')).toBe('15:38');
    expect(formatTimeLabel('09:05', 'h:mm a')).toBe('09:05');
  });

  test('no preference still uses 24 hours in an English locale', () => {
    expect(formatTimeLabel('15:38')).toBe('15:38');
  });

  test('null/empty/invalid returns null', () => {
    expect(formatTimeLabel(null, 'HH:mm')).toBeNull();
    expect(formatTimeLabel('', 'HH:mm')).toBeNull();
    expect(formatTimeLabel('not-a-time', 'HH:mm')).toBeNull();
  });

  test('pickers never show an AM/PM column', () => {
    expect(is12HourTimeFormat('HH:mm')).toBe(false);
    expect(is12HourTimeFormat('h:mm A')).toBe(false);
    expect(is12HourTimeFormat('h:mm a')).toBe(false);
    expect(is12HourTimeFormat()).toBe(false);
  });
});
