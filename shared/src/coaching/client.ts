import { z } from "zod";
import {
  coachingSettingsResponseSchema,
  coachingSettingsSchema,
  coachingInboxSchema,
  coachingPreviewSchema,
  coachingProposalSchema,
  coachingCommitmentSchema,
  coachingAgentSchema,
  coachingContextSchema,
  coachingPlanningContextSchema,
  coachingEvidenceRowSchema,
  type CoachingSettingsPatch,
  type CoachingReview,
  type CoachingCommitmentPatch,
  type CoachingAction,
  type CoachingAgentCreate,
} from "../schemas/api/Coaching.api.zod.ts";
import {
  plannedMealsSchema,
  plannedMealReceiptSchema,
  type PlannedMealConfirmation,
} from "../schemas/api/MealPlanning.api.zod.ts";
export interface CoachingRequest {
  path: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}
export function createCoachingClient(
  request: (input: CoachingRequest) => Promise<unknown>,
  uuid: () => string,
) {
  const read = (
    path: string,
    options?: { params?: CoachingRequest["params"] },
  ) => request({ path, method: "GET", params: options?.params });
  const mutation = (
    path: string,
    body: unknown,
    method: CoachingRequest["method"] = "POST",
  ) => request({ path, method, body });
  const loadCoachingSettings = async () =>
    coachingSettingsResponseSchema.parse(await read("/settings"));
  const saveCoachingSettings = async (body: CoachingSettingsPatch) =>
    coachingSettingsSchema.parse(await mutation("/settings", body, "PATCH"));
  const loadCoachingContext = async () =>
    coachingContextSchema.parse(await read("/context"));
  const loadCoachingInbox = async (
    offset: number,
    view?: "pending" | "active" | "history",
    domain?: string,
  ) =>
    coachingInboxSchema.parse(
      await read("/inbox", { params: { offset, limit: 50, view, domain } }),
    );
  const loadCoachingPlanning = async (
    kind: string,
    search: string,
    offset = 0,
  ) =>
    coachingPlanningContextSchema.parse(
      await read("/planning", { params: { kind, search, offset, limit: 50 } }),
    );
  const loadCoachingEvidence = async (id: string) =>
    z
      .array(coachingEvidenceRowSchema)
      .parse(await read(`/proposals/${id}/evidence`));
  const previewCoaching = async (
    id: string,
    revision: number,
    action: CoachingAction,
  ) =>
    coachingPreviewSchema.parse(
      await mutation(`/proposals/${id}/preview`, {
        expectedRevision: revision,
        action,
      }),
    );
  const reviewCoaching = async (id: string, body: CoachingReview) =>
    coachingProposalSchema.parse(
      await mutation(`/proposals/${id}/review`, body),
    );
  const updateCoachingAction = async (
    id: string,
    body: CoachingCommitmentPatch,
  ) =>
    coachingCommitmentSchema.parse(
      await mutation(`/actions/${id}`, body, "PATCH"),
    );
  const addCoachingAgent = async (body: CoachingAgentCreate) =>
    coachingAgentSchema.parse(await mutation("/agents", body));
  const issueCoachingKey = async (id: string) =>
    z
      .object({
        key: z.string(),
        agent: coachingAgentSchema,
        scope: z.literal("mcp-agent"),
      })
      .parse(await mutation(`/agents/${id}/key`, { expiresIn: 7776000 }));
  const revokeCoachingAgent = (id: string) =>
    mutation(`/agents/${id}/revoke`, {});
  const requestCoaching = (reconsiderTopics: string[] = []) =>
    mutation("/runs", { operationId: uuid(), reconsiderTopics });
  const deleteCoachingHistory = (id: string) =>
    mutation(`/proposals/${id}`, undefined, "DELETE");
  const loadPlannedMeals = async (day: string) =>
    plannedMealsSchema.parse(
      await read("/planned-meals", { params: { from: day, to: day } }),
    );
  const confirmCoachingMeal = async (
    id: string,
    body: PlannedMealConfirmation,
  ) =>
    plannedMealReceiptSchema.parse(
      await mutation(`/planned-meals/${id}/confirm`, body),
    );
  const skipCoachingMeal = (id: string) =>
    mutation(`/planned-meals/${id}/skip`, {});

  return {
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
  };
}
