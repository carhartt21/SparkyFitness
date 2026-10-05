import {
  diaryTimestamp,
  sortDiaryTimeline,
  wellnessTimestamp,
} from '../../src/utils/diaryTimeline';

describe('diary chronology', () => {
  it('interleaves kinds earliest to latest and separates missing times without mutating sources', () => {
    const events = [
      {
        id: 'food:late',
        timestamp: diaryTimestamp('2026-10-05', '20:30', 'Europe/Berlin'),
      },
      { id: 'workout:untimed', timestamp: null },
      {
        id: 'water:early',
        timestamp: diaryTimestamp(
          '2026-10-05',
          '2026-10-05T05:00:00Z',
          'Europe/Berlin'
        ),
      },
      {
        id: 'intake:midday',
        timestamp: diaryTimestamp('2026-10-05', '12:00:01', 'Europe/Berlin'),
      },
      {
        id: 'mobility:evening',
        timestamp: diaryTimestamp(
          '2026-10-05',
          '2026-10-05T16:00:00Z',
          'Europe/Berlin'
        ),
      },
    ];
    expect(sortDiaryTimeline(events).map((item) => item.id)).toEqual([
      'water:early',
      'intake:midday',
      'mobility:evening',
      'food:late',
      'workout:untimed',
    ]);
    expect(events[0].id).toBe('food:late');
  });
  it('has deterministic identities for same-time and untimed events', () => {
    expect(
      sortDiaryTimeline([
        { id: 'b', timestamp: 3 },
        { id: 'a', timestamp: 3 },
        { id: 'z', timestamp: null },
        { id: 'x', timestamp: null },
      ]).map((item) => item.id)
    ).toEqual(['a', 'b', 'x', 'z']);
  });
  it('preserves order of repeated DST hours represented by real instants', () => {
    expect(
      diaryTimestamp('2026-10-25', '2026-10-25T02:30:00+02:00', 'Europe/Berlin')
    ).toBeLessThan(
      diaryTimestamp(
        '2026-10-25',
        '2026-10-25T02:10:00+01:00',
        'Europe/Berlin'
      )!
    );
  });
  it.each([
    undefined,
    null,
    '',
    '24:01',
    '12:99',
    '12:30:60',
    'invalid',
    '2026-10-05',
  ])('does not invent a time for %s', (time) => {
    expect(diaryTimestamp('2026-10-05', time, 'Europe/Berlin')).toBeNull();
  });
  it('does not turn the recording time of backfilled wellness into occurrence time', () => {
    expect(
      wellnessTimestamp('2026-10-04', '2026-10-05T10:00:00Z', 'Europe/Berlin')
    ).toBeNull();
    expect(
      wellnessTimestamp('2026-10-05', '2026-10-05T10:00:00Z', 'Europe/Berlin')
    ).not.toBeNull();
  });
});
