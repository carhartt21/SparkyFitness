import type { ExerciseReviewResponse } from '@workspace/shared';
import { apiFetch } from './apiClient';

export function fetchExerciseReview(
  startDate: string,
  endDate: string,
  previousStartDate: string,
  previousEndDate: string
): Promise<ExerciseReviewResponse> {
  const params = new URLSearchParams({
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
  });
  return apiFetch<ExerciseReviewResponse>({
    endpoint: `/api/exercise-stats/review?${params.toString()}`,
    serviceName: 'Exercise review API',
    operation: 'fetch exercise review',
  });
}
