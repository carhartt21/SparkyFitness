import { createCoachingClient } from '@workspace/shared';
import { apiCall } from '@/api/api';
export const {
  loadCoachingSettings,
  saveCoachingSettings,
  loadCoachingContext,
  loadCoachingInbox,
  loadCoachingPlanning,
  loadCoachingEvidence,
  previewCoaching,
  reviewCoaching,
  updateCoachingAction,
  addCoachingAgent,
  issueCoachingKey,
  revokeCoachingAgent,
  requestCoaching,
  deleteCoachingHistory,
  loadPlannedMeals,
  confirmCoachingMeal,
  skipCoachingMeal,
} = createCoachingClient(
  ({ path, method, body, params }) =>
    apiCall('/v2/coaching' + path, {
      method,
      body,
      params,
      omitRequestBodyFromLogs: true,
      omitResponseBodyFromLogs: true,
    }),
  () => crypto.randomUUID()
);
