import {
  getProgressionXReveal,
  normalizeProgress,
  progressionXGeometry,
  progressionXSegmentLengths,
  progressionXTotalLength,
} from '@workspace/shared';

const totalVisible = (progress: number | null) =>
  getProgressionXReveal(progress).reduce((sum, segment) => sum + segment, 0);

describe('one-value progression X', () => {
  it('keeps unknown distinct from the neutral starting point', () => {
    expect(normalizeProgress(undefined)).toBeNull();
    expect(normalizeProgress(Number.NaN)).toBeNull();
    expect(normalizeProgress(0)).toBe(0);
    expect(getProgressionXReveal(null)).toEqual(getProgressionXReveal(0));
    expect(totalVisible(0)).toBe(0);
  });

  it('clamps out-of-range inputs and reveals measured arc length', () => {
    expect(normalizeProgress(-10)).toBe(0);
    expect(normalizeProgress(140)).toBe(100);
    expect(totalVisible(5)).toBeCloseTo(progressionXTotalLength * 0.05, 5);
    expect(totalVisible(43)).toBeCloseTo(progressionXTotalLength * 0.43, 5);
    expect(totalVisible(57)).toBeCloseTo(progressionXTotalLength * 0.57, 5);
    expect(totalVisible(99)).toBeCloseTo(progressionXTotalLength * 0.99, 5);
    expect(totalVisible(100)).toBeCloseTo(progressionXTotalLength, 5);
    getProgressionXReveal(100).forEach((length, index) =>
      expect(length).toBeCloseTo(progressionXSegmentLengths[index] ?? 0, 8)
    );
  });

  it('allows a real correction without retaining the previous high-water mark', () => {
    expect(totalVisible(57)).toBeGreaterThan(totalVisible(43));
    expect(totalVisible(43)).toBeLessThan(totalVisible(57));
    expect(totalVisible(99)).toBeLessThan(totalVisible(100));
  });

  it('keeps early progress warm and the full silhouette fixed', () => {
    expect(getProgressionXReveal(5).slice(1)).toEqual([0, 0, 0, 0]);
    expect(progressionXGeometry.segments).toHaveLength(5);
    expect(
      progressionXGeometry.segments.every(
        (segment) => segment.path && segment.guide
      )
    ).toBe(true);
    expect(
      progressionXGeometry.segments.find((segment) => segment.id === 'sweep')
        ?.kind
    ).toBe('fill');
    expect(
      progressionXGeometry.segments.find(
        (segment) => segment.id === 'upper-right'
      )
    ).toHaveProperty('taperPath');
  });
});

describe('canonical colour route', () => {
  const segments = progressionXGeometry.segments;
  const numbers = (guide: string) => guide.match(/-?\d+(?:\.\d+)?/g) ?? [];
  const endOf = (guide: string) => numbers(guide).slice(-2).join(' ');
  const startOf = (guide: string) => numbers(guide).slice(0, 2).join(' ');

  it('begins warm and ends green at the pointed tip of the sweep', () => {
    expect(segments[0]?.gradient.from.toUpperCase()).toBe('#FF123C');
    const last = segments[segments.length - 1];
    expect(last?.id).toBe('sweep');
    expect(endOf(last?.guide ?? '')).toBe('214 103');
    expect(last?.gradient).toMatchObject({ x2: 214, y2: 103, to: '#22F978' });
  });

  it('hands each colour on to the next segment', () => {
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index]?.gradient.from).toBe(
        segments[index - 1]?.gradient.to
      );
    }
  });

  it('continues the reveal where the previous stroke ends', () => {
    expect(startOf(segments[1]?.guide ?? '')).toBe(
      endOf(segments[0]?.guide ?? '')
    );
    expect(startOf(segments[4]?.guide ?? '')).toBe(
      endOf(segments[3]?.guide ?? '')
    );
  });
});
