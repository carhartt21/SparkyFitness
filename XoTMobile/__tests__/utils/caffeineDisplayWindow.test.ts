import {
  activeCaffeineAt,
  caffeineCurve,
  caffeineDisplayWindow,
} from '@workspace/shared';

describe('caffeine selected-day presentation', () => {
  it('keeps September residual in the model without displaying September on October 2', () => {
    const now = Date.parse('2026-10-02T13:00:00Z');
    const window = caffeineDisplayWindow(
      '2026-10-02T20:30:00Z',
      now,
      'Europe/Berlin'
    );
    const doses = [
      { at: '2026-09-30T20:26:00Z', mg: 150 },
      { at: '2026-10-02T12:30:00Z', mg: 32 },
    ];
    expect(window.start).toBe(Date.parse('2026-10-01T22:00:00Z'));
    expect(window.end).toBe(Date.parse('2026-10-02T22:00:00Z') - 1);
    const curve = caffeineCurve(doses, window.start, window.end, 5);
    expect(curve[0]?.mg).toBeGreaterThan(0);
    expect(
      curve.every((point) => point.t >= window.start && point.t <= window.end)
    ).toBe(true);
    expect(
      curve.find((point) => point.t === Date.parse(doses[1]!.at))?.mg
    ).toBeGreaterThan(32);
    expect(activeCaffeineAt(doses, window.reference, 5)).toBeGreaterThan(
      activeCaffeineAt([doses[1]!], now, 5)
    );
  });

  it.each([
    ['2026-03-29T20:30:00Z', 23],
    ['2026-10-25T21:30:00Z', 25],
  ])('respects the DST calendar day at %s', (bedtime, hours) => {
    const window = caffeineDisplayWindow(
      bedtime,
      Date.parse(bedtime),
      'Europe/Berlin'
    );
    expect(window.end + 1 - window.start).toBe(hours * 3600000);
  });

  it('uses the selected day end for history and never stretches toward the wall clock', () => {
    const window = caffeineDisplayWindow(
      '2025-09-30T20:30:00Z',
      Date.now(),
      'Europe/Berlin'
    );
    expect(window.isToday).toBe(false);
    expect(window.reference).toBe(window.end);
    expect(window.end + 1 - window.start).toBe(86400000);
  });
});
