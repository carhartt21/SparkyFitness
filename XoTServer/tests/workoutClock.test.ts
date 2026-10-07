import { describe, it, expect } from 'vitest';
import { importedWorkoutClock } from '@workspace/shared';
describe('workout source wall clock', () => {
  it('uses source timezone across DST and date boundaries', () => {
    expect(
      importedWorkoutClock(
        { timestamp: '2026-10-03T22:15:00Z', record_timezone: 'Europe/Berlin' },
        'UTC'
      )
    ).toBe('00:15');
    expect(
      importedWorkoutClock(
        { startTime: '2026-01-03T22:15:00Z', record_timezone: 'Europe/Berlin' },
        'UTC'
      )
    ).toBe('23:15');
    expect(
      importedWorkoutClock(
        { startTime: '2026-10-03T22:15:00Z', record_utc_offset_minutes: 0 },
        'Europe/Berlin'
      )
    ).toBe('22:15');
  });
  it('never uses date-only or synchronization timestamps', () => {
    expect(
      importedWorkoutClock(
        { timestamp: '2026-10-03', created_at: '2026-10-04T10:15:00Z' },
        'Europe/Berlin'
      )
    ).toBeNull();
    expect(
      importedWorkoutClock(
        { timestamp: 'bad', startTime: '2026-10-03T08:30:00Z' },
        'Europe/Berlin'
      )
    ).toBe('10:30');
    expect(
      importedWorkoutClock(
        { timestamp: '2026-10-03T08:30:00' },
        'Europe/Berlin'
      )
    ).toBeNull();
  });
});
