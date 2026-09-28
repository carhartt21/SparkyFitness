import { render, screen } from '@testing-library/react';
import ProgressTrackX from '@/components/brand/ProgressTrackX';

describe('ProgressTrackX', () => {
  it('keeps known zero distinct from unknown', () => {
    const { rerender } = render(
      <ProgressTrackX
        progress={0}
        label="Workout sets"
        unknownLabel="No planned sets"
      />
    );
    expect(screen.getByRole('img', { name: 'Workout sets: 0%' })).toBeTruthy();
    expect(screen.getByText('0%')).toBeTruthy();

    rerender(
      <ProgressTrackX
        progress={null}
        label="Workout sets"
        unknownLabel="No planned sets"
      />
    );
    expect(
      screen.getByRole('img', { name: 'Workout sets: No planned sets' })
    ).toBeTruthy();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('renders the same full geometry at 100 percent', () => {
    const { container } = render(
      <ProgressTrackX
        progress={100}
        label="Workout sets"
        unknownLabel="No planned sets"
      />
    );
    expect(
      screen.getByRole('img', { name: 'Workout sets: 100%' })
    ).toBeTruthy();
    expect(container.querySelectorAll('svg path').length).toBeGreaterThan(10);
  });

  it('does not flash a stale percentage after an unavailable interval', () => {
    const props = { label: 'Workout sets', unknownLabel: 'No planned sets' };
    const { rerender } = render(<ProgressTrackX {...props} progress={57} />);
    rerender(<ProgressTrackX {...props} progress={null} />);
    expect(
      screen.getByRole('img', { name: 'Workout sets: No planned sets' })
    ).toBeTruthy();
    rerender(<ProgressTrackX {...props} progress={43} />);
    expect(screen.getByRole('img', { name: 'Workout sets: 0%' })).toBeTruthy();
  });
});
