import { createCoachingClientV2 } from '@workspace/shared';
import { apiCall } from '@/api/api';
export const {
  loadCoachingSettings,
  loadCoachingConnections,
  loadCoachingRecaps,
  loadCoachingRecap,
  readCoachingRecap,
  deleteCoachingRecap,
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
} = createCoachingClientV2(
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
