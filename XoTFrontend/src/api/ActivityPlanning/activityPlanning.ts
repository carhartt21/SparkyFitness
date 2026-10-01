import {
  activityPlanningResponseSchema,
  type ActivityResolutionRequest,
} from '@workspace/shared';
import { apiCall } from '@/api/api';
export const getActivityPlanning = async (from: string, to: string) =>
  activityPlanningResponseSchema.parse(
    await apiCall(`/v2/activity-planning?start_date=${from}&end_date=${to}`, {
      method: 'GET',
    })
  );
export const resolveActivityPlanning = async (
  body: ActivityResolutionRequest
) =>
  activityPlanningResponseSchema.parse(
    await apiCall('/v2/activity-planning', { method: 'PUT', body })
  );
