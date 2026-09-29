import React from 'react';
import { render, renderHook } from '@testing-library/react-native';
import { useMarkedDayComponent } from '../../src/components/calendarMarkedDays';

const colors = {
  complete: '#00ff00',
  partial: '#ffff00',
  notStarted: '#888888',
};

function dayCell(
  Day: NonNullable<ReturnType<typeof useMarkedDayComponent>['Day']>,
  date: string
) {
  return render(
    <>
      {Day({
        date: new Date(`${date}T12:00:00`) as unknown as string,
        text: date.slice(-2),
        isSelected: false,
        isDisabled: false,
      } as never)}
    </>
  );
}

describe('calendar day progress marks', () => {
  const { result } = renderHook(() =>
    useMarkedDayComponent({
      textPrimary: '#fff',
      textMuted: '#999',
      accentPrimary: '#0f0',
      progressStates: {
        '2026-09-10': 'complete',
        '2026-09-11': 'partial',
        '2026-09-12': 'not_started',
        '2026-09-13': 'none',
        '2026-09-14': 'unknown',
      },
      progressColors: colors,
      progressLabel: (state) => `progress ${state}`,
    })
  );
  const Day = result.current.Day!;

  it('fills complete days and rings partial or not-started days', () => {
    expect(
      dayCell(Day, '2026-09-10').getByTestId('calendar-day-progress-complete')
        .props.style
    ).toMatchObject({ backgroundColor: colors.complete });
    expect(
      dayCell(Day, '2026-09-11').getByTestId('calendar-day-progress-partial')
        .props.style
    ).toMatchObject({ borderColor: colors.partial });
    expect(
      dayCell(Day, '2026-09-12').getByTestId(
        'calendar-day-progress-not_started'
      ).props.style
    ).toMatchObject({ borderColor: colors.notStarted });
  });

  it('leaves days with no tasks and unknown history blank', () => {
    for (const [date, state] of [
      ['2026-09-13', 'none'],
      ['2026-09-14', 'unknown'],
    ]) {
      const style = dayCell(Day, date).getByTestId(
        `calendar-day-progress-${state}`
      ).props.style;
      expect(style).not.toHaveProperty('backgroundColor');
      expect(style).not.toHaveProperty('borderWidth');
    }
  });

  it('gives each marked day an accessible description', () => {
    const cell = dayCell(Day, '2026-09-11');
    expect(cell.getByLabelText('11, progress partial')).toBeTruthy();
  });
});
