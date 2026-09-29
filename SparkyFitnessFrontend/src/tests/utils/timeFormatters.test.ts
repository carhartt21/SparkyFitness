import {
  formatTimeWithPreference,
  formatTimeOfDayString,
} from '@/utils/timeFormatters';

const MIDNIGHT = new Date('2024-01-15T00:00:00');
const NOON = new Date('2024-01-15T12:00:00');
const MORNING = new Date('2024-01-15T08:30:00');
const AFTERNOON = new Date('2024-01-15T14:45:00');
const EVENING = new Date('2024-01-15T19:15:00');

describe('formatTimeWithPreference always displays 24-hour time', () => {
  it.each([
    [MIDNIGHT, '00:00'],
    [NOON, '12:00'],
    [MORNING, '08:30'],
    [AFTERNOON, '14:45'],
    [EVENING, '19:15'],
  ])('renders %s as %s', (date, expected) => {
    for (const storedPreference of ['HH:mm', 'h:mm A', 'h:mm a']) {
      expect(formatTimeWithPreference(date, storedPreference)).toBe(expected);
    }
  });

  it('omits seconds and AM/PM even for a legacy preference', () => {
    expect(
      formatTimeWithPreference(new Date('2024-01-15T23:59:30'), 'h:mm A')
    ).toBe('23:59');
  });

  it('returns empty string for invalid dates', () => {
    expect(formatTimeWithPreference(new Date('invalid'), 'HH:mm')).toBe('');
  });
});

describe('formatTimeOfDayString always displays 24-hour time', () => {
  it.each(['HH:mm', 'h:mm A', 'h:mm a'])(
    'formats schedules with the legacy %s preference',
    (storedPreference) => {
      expect(formatTimeOfDayString('08:30:00', storedPreference)).toBe('08:30');
      expect(formatTimeOfDayString('14:00', storedPreference)).toBe('14:00');
    }
  );

  it('returns empty string for invalid schedule times', () => {
    expect(formatTimeOfDayString('ab:cd', 'HH:mm')).toBe('');
    expect(formatTimeOfDayString('', 'HH:mm')).toBe('');
    expect(formatTimeOfDayString('24:00', 'HH:mm')).toBe('');
    expect(formatTimeOfDayString('09:90', 'HH:mm')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Recording-zone rendering (issue #2033)
// ---------------------------------------------------------------------------
import { formatTimeInZone, sleepEntryZone } from '@/utils/timeFormatters';

describe('formatTimeInZone', () => {
  // DST-unambiguous instant: mid-June (Tokyo has no DST anyway; New York is
  // solidly in EDT).
  const INSTANT = '2024-06-15T15:45:00Z';

  it('renders in a named IANA zone', () => {
    // 15:45 UTC = 00:45 next day in Tokyo (+9)
    expect(
      formatTimeInZone(INSTANT, { kind: 'tz', tz: 'Asia/Tokyo' }, 'HH:mm')
    ).toBe('00:45');
  });

  it('renders with a fixed UTC offset, honoring the 24h preference', () => {
    expect(
      formatTimeInZone(INSTANT, { kind: 'offset', minutes: -240 }, 'HH:mm')
    ).toBe('11:45');
  });

  it('ignores an old 12-hour preference', () => {
    expect(
      formatTimeInZone(INSTANT, { kind: 'offset', minutes: -240 }, 'h:mm A')
    ).toBe('11:45');
  });

  it('returns empty string for an unparseable instant', () => {
    expect(
      formatTimeInZone('garbage', { kind: 'tz', tz: 'Asia/Tokyo' }, 'HH:mm')
    ).toBe('');
  });

  it('does not inherit the PreferencesContext literal-date-string bug for …T00:0…Z instants', () => {
    // PreferencesContext.isLiteralDateString treats any "…T00:0…Z" instant as
    // a bare calendar date and renders 00:00. This path must project it.
    // 00:05 UTC = 20:05 previous day in EDT (-4).
    expect(
      formatTimeInZone(
        '2024-06-15T00:05:00Z',
        { kind: 'tz', tz: 'America/New_York' },
        'HH:mm'
      )
    ).toBe('20:05');
  });
});

describe('sleepEntryZone', () => {
  it('prefers the entry IANA zone', () => {
    expect(
      sleepEntryZone(
        { record_timezone: 'Asia/Tokyo', record_utc_offset_minutes: -300 },
        'UTC'
      )
    ).toEqual({ kind: 'tz', tz: 'Asia/Tokyo' });
  });

  it('falls back to the entry offset for an invalid or missing zone', () => {
    expect(
      sleepEntryZone(
        { record_timezone: 'Not/AZone', record_utc_offset_minutes: -300 },
        'UTC'
      )
    ).toEqual({ kind: 'offset', minutes: -300 });
    expect(
      sleepEntryZone(
        { record_timezone: null, record_utc_offset_minutes: 0 },
        'UTC'
      )
    ).toEqual({ kind: 'offset', minutes: 0 });
  });

  it('falls back to the profile timezone for zone-less entries', () => {
    expect(sleepEntryZone({}, 'America/Chicago')).toEqual({
      kind: 'tz',
      tz: 'America/Chicago',
    });
    expect(
      sleepEntryZone(
        { record_timezone: null, record_utc_offset_minutes: null },
        'America/Chicago'
      )
    ).toEqual({ kind: 'tz', tz: 'America/Chicago' });
  });
});
