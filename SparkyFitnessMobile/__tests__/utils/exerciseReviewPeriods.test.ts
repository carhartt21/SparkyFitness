import { exerciseReviewDates } from '../../src/utils/exerciseReviewPeriods';

describe('exerciseReviewDates', () => {
  it('compares the unfinished Monday-based week with the same elapsed prior weekdays', () => {
    expect(exerciseReviewDates('2026-09-25', 'week')).toEqual({
      startDate: '2026-09-21',
      endDate: '2026-09-25',
      previousStartDate: '2026-09-14',
      previousEndDate: '2026-09-18',
    });
    expect(exerciseReviewDates('2026-09-25', 'week', 1)).toEqual({
      startDate: '2026-09-14',
      endDate: '2026-09-20',
      previousStartDate: '2026-09-07',
      previousEndDate: '2026-09-13',
    });
  });

  it('uses calendar months and caps the comparison at the shorter prior month', () => {
    expect(exerciseReviewDates('2026-03-01', 'month')).toEqual({
      startDate: '2026-03-01',
      endDate: '2026-03-01',
      previousStartDate: '2026-02-01',
      previousEndDate: '2026-02-01',
    });
    expect(exerciseReviewDates('2026-03-30', 'month')).toEqual({
      startDate: '2026-03-01',
      endDate: '2026-03-30',
      previousStartDate: '2026-02-01',
      previousEndDate: '2026-02-28',
    });
    expect(exerciseReviewDates('2026-03-30', 'month', 1)).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      previousStartDate: '2026-01-01',
      previousEndDate: '2026-01-31',
    });
  });

  it('uses calendar years without overshooting a shorter prior year', () => {
    expect(exerciseReviewDates('2024-12-31', 'year')).toEqual({
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      previousStartDate: '2023-01-01',
      previousEndDate: '2023-12-31',
    });
    expect(exerciseReviewDates('2026-09-25', 'year', 1)).toEqual({
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      previousStartDate: '2024-01-01',
      previousEndDate: '2024-12-31',
    });
  });
});
