import { z } from "zod";
import {
  createHabitRequestSchema,
  upsertMeasurementReminderRequestSchema,
} from "./DailyTracking.api.zod.ts";
import { engagementSettingsPatchV2Schema } from "./Engagement.api.zod.ts";
import { mobilityStepSchema, mobilityClockSchema } from "./Mobility.api.zod.ts";

export const coachingDomainSchema = z.enum([
  "nutrition",
  "activity",
  "recovery",
  "habits",
  "measurements",
]);
export const coachingRunKindSchema = z.enum(["daily", "weekly", "manual"]);
export const coachingRunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "expired",
]);
export const coachingProposalStatusSchema = z.enum([
  "staged",
  "pending",
  "accepted",
  "declined",
  "expired",
  "superseded",
]);
export const coachingActionStatusSchema = z.enum([
  "active",
  "completed",
  "skipped",
  "stopped",
  "expired",
]);
const day = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });
const id = z.uuid();
const text = z.string().trim().min(1).max(200);
const description = z.string().trim().max(2000);
const weekdays = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .max(7)
  .refine(
    (days) => new Set(days).size === days.length,
    "Weekdays must be unique.",
  );

export const coachingSettingsSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  enabled: z.boolean(),
  domains: z
    .array(coachingDomainSchema)
    .min(1)
    .max(5)
    .refine((domains) => new Set(domains).size === domains.length),
  morningTime: mobilityClockSchema,
  eveningTime: mobilityClockSchema,
  weeklyDay: z.number().int().min(0).max(6),
  weeklyTime: mobilityClockSchema,
  digestEnabled: z.boolean(),
  digestTime: mobilityClockSchema,
});
export const coachingSettingsPatchSchema = coachingSettingsSchema
  .omit({ revision: true })
  .partial()
  .extend({ expectedRevision: z.number().int().nonnegative() });
export const defaultCoachingSettings: z.infer<typeof coachingSettingsSchema> = {
  revision: 0,
  enabled: false,
  domains: [...coachingDomainSchema.options],
  morningTime: "08:00",
  eveningTime: "20:00",
  weeklyDay: 0,
  weeklyTime: "09:00",
  digestEnabled: true,
  digestTime: "20:00",
};

export const coachingGoalFieldSchema = z.enum([
  "calories",
  "protein",
  "carbs",
  "fat",
  "dietary_fiber",
  "saturated_fat",
  "sugars",
  "sodium",
  "water_goal_ml",
  "target_exercise_duration_minutes",
  "target_exercise_calories_burned",
  "caffeine_mg",
  "alcohol_g",
]);
export const coachingMetricSchema = z.enum([
  ...coachingGoalFieldSchema.options,
  "steps",
  "sleep_minutes",
  "weight",
  "habit_completion",
  "workout_completion",
  "meal_confirmation",
  "mobility_completion",
]);
export const coachingMetricUnits: Record<
  z.infer<typeof coachingMetricSchema>,
  string
> = {
  calories: "kcal",
  protein: "g",
  carbs: "g",
  fat: "g",
  dietary_fiber: "g",
  saturated_fat: "g",
  sugars: "g",
  sodium: "mg",
  water_goal_ml: "ml",
  target_exercise_duration_minutes: "min",
  target_exercise_calories_burned: "kcal",
  caffeine_mg: "mg",
  alcohol_g: "g",
  steps: "steps",
  sleep_minutes: "min",
  weight: "kg",
  habit_completion: "ratio",
  workout_completion: "ratio",
  meal_confirmation: "ratio",
  mobility_completion: "ratio",
};
const success = z
  .strictObject({
    metric: coachingMetricSchema,
    subjectId: z.string().max(100).nullable(),
    unit: z.string().trim().min(1).max(40),
    baseline: z.number().finite().nullable(),
    target: z.number().finite(),
    direction: z.enum(["minimum", "maximum", "exact"]),
    minimumCoverage: z.number().min(0).max(1),
    reviewDay: day,
  })
  .superRefine((value, ctx) => {
    if (value.unit !== coachingMetricUnits[value.metric])
      ctx.addIssue({
        code: "custom",
        path: ["unit"],
        message: "Use the canonical metric unit.",
      });
    if (
      value.metric.endsWith("_completion") ||
      value.metric === "meal_confirmation"
    ) {
      if (value.target < 0 || value.target > 1)
        ctx.addIssue({
          code: "custom",
          path: ["target"],
          message: "Adherence targets are ratios between zero and one.",
        });
    }
  });
const commitment = {
  title: text,
  description,
  dueDay: day,
  reminderTime: mobilityClockSchema.nullable(),
};

export const coachingMealAssignmentSchema = z.discriminatedUnion("item_type", [
  z.strictObject({
    item_type: z.literal("food"),
    day_of_week: z.number().int().min(0).max(6),
    meal_type_id: id,
    food_id: id,
    variant_id: id.nullable(),
    quantity: z.number().positive().max(100000),
    unit: z.string().trim().min(1).max(50),
  }),
  z.strictObject({
    item_type: z.literal("meal"),
    day_of_week: z.number().int().min(0).max(6),
    meal_type_id: id,
    meal_id: id,
    quantity: z.number().positive().max(1000),
    unit: z.string().trim().min(1).max(50),
  }),
]);
export const coachingMealPlanSchema = z
  .strictObject({
    plan_name: text,
    description,
    start_date: day,
    end_date: day.nullable(),
    is_active: z.boolean(),
    entry_mode: z.literal("prompt"),
    assignments: z.array(coachingMealAssignmentSchema).min(1).max(140),
  })
  .refine(
    (plan) => !plan.end_date || plan.end_date >= plan.start_date,
    "Invalid plan date range.",
  );

export const coachingWorkoutSetSchema = z.strictObject({
  set_number: z.number().int().min(1).max(100),
  set_type: z.enum(["working", "warmup", "dropset", "failure"]).nullable(),
  reps: z.number().int().min(0).max(1000).nullable(),
  weight: z.number().min(0).max(10000).nullable(),
  duration: z.number().min(0).max(86400).nullable(),
  rest_time: z.number().min(0).max(3600).nullable(),
  notes: z.string().max(500).nullable(),
});
export const coachingWorkoutAssignmentSchema = z
  .strictObject({
    day_of_week: z.number().int().min(0).max(6).nullable(),
    session_index: z.number().int().min(0).max(100).nullable(),
    session_name: text.nullable(),
    workout_preset_id: z.number().int().positive().nullable(),
    exercise_id: id.nullable(),
    sort_order: z.number().int().min(0).max(1000),
    sets: z.array(coachingWorkoutSetSchema).max(100),
  })
  .refine(
    (assignment) =>
      Boolean(assignment.workout_preset_id) !== Boolean(assignment.exercise_id),
    "Choose one exercise or preset.",
  );
export const coachingWorkoutPlanSchema = z
  .strictObject({
    plan_name: text,
    description,
    start_date: day,
    end_date: day.nullable(),
    is_active: z.boolean(),
    schedule_type: z.enum(["weekly", "sequential"]),
    entry_mode: z.literal("prompt"),
    assignments: z.array(coachingWorkoutAssignmentSchema).min(1).max(140),
  })
  .superRefine((plan, ctx) => {
    if (plan.end_date && plan.end_date < plan.start_date)
      ctx.addIssue({ code: "custom", message: "Invalid plan date range." });
    if (
      plan.assignments.some((assignment) =>
        plan.schedule_type === "weekly"
          ? assignment.day_of_week === null
          : assignment.session_index === null,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Assignments must match the schedule type.",
      });
  });
export const coachingMobilityDefinitionSchema = z.strictObject({
  name: text,
  steps: z.array(mobilityStepSchema).min(1).max(40),
  cue: z.enum(["off", "haptic", "sound", "both"]),
  schedule: z
    .strictObject({
      weekdays,
      time: mobilityClockSchema,
      startDay: day,
      endDay: day.nullable(),
      enabled: z.boolean(),
    })
    .nullable(),
});

export const coachingActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("task"), ...commitment }),
  z.strictObject({ kind: z.literal("objective"), ...commitment, success }),
  z.strictObject({
    kind: z.literal("habit"),
    habitId: id.nullable(),
    definition: createHabitRequestSchema.strict(),
  }),
  z.strictObject({
    kind: z.literal("measurement_reminder"),
    definition: upsertMeasurementReminderRequestSchema.strict(),
  }),
  z.strictObject({
    kind: z.literal("notification_settings"),
    changes: engagementSettingsPatchV2Schema
      .omit({ expected_revision: true })
      .strict()
      .refine((changes) => Object.keys(changes).length > 0),
  }),
  z.strictObject({
    kind: z.literal("goals"),
    effectiveDay: day,
    changes: z
      .array(
        z.strictObject({
          field: coachingGoalFieldSchema,
          before: z.number().finite().nullable(),
          after: z.number().finite().min(0).max(100000),
          unit: z.string().min(1).max(40),
        }),
      )
      .min(1)
      .max(13)
      .refine(
        (changes) =>
          new Set(changes.map((change) => change.field)).size ===
          changes.length,
      ),
  }),
  z.strictObject({
    kind: z.literal("meal_plan"),
    templateId: id.nullable(),
    effectiveDay: day,
    definition: coachingMealPlanSchema,
  }),
  z.strictObject({
    kind: z.literal("workout_plan"),
    templateId: z.number().int().positive().nullable(),
    effectiveDay: day,
    definition: coachingWorkoutPlanSchema,
  }),
  z.strictObject({
    kind: z.literal("mobility"),
    routineId: id.nullable(),
    scheduleId: id.nullable().default(null),
    definition: coachingMobilityDefinitionSchema,
  }),
]);

export const coachingEvidenceRowSchema = z.strictObject({
  id: z.string().min(1).max(200),
  domain: coachingDomainSchema,
  kind: z.string().min(1).max(80),
  day: day.nullable(),
  source: z.string().max(100),
  observedAt: timestamp.nullable(),
  confirmation: z.enum(["confirmed", "unconfirmed", "unknown"]),
  value: z.json(),
});
export const coachingEvidenceReferenceSchema = z.strictObject({
  rowIds: z.array(z.string().min(1).max(200)).min(1).max(100),
  from: day,
  to: day,
  coverage: z.number().min(0).max(1),
  freshness: z.enum(["current", "stale", "unknown"]),
  unit: z.string().max(40).nullable(),
  limitation: z.string().max(1000).nullable(),
});
export const coachingProposalInputSchema = z.strictObject({
  topic: z.string().trim().min(1).max(120),
  domain: coachingDomainSchema,
  title: text,
  rationale: description.min(1),
  impact: z.number().int().min(1).max(5),
  benefit: description.min(1),
  effort: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(coachingEvidenceReferenceSchema).min(1).max(20),
  success,
  action: coachingActionSchema,
  expiresDay: day,
});
export const coachingProposalSchema = coachingProposalInputSchema.extend({
  id,
  runId: id,
  agentId: id,
  snapshotId: id,
  revision: z.number().int().nonnegative(),
  status: coachingProposalStatusSchema,
  createdAt: timestamp,
  publishedAt: timestamp.nullable(),
  reviewedAt: timestamp.nullable(),
  reviewReason: description.nullable(),
  activationId: id.nullable(),
  acceptedAction: coachingActionSchema.nullable(),
});
export const coachingCommitmentSchema = z.strictObject({
  id,
  proposalId: id,
  status: coachingActionStatusSchema,
  revision: z.number().int().nonnegative(),
  action: coachingActionSchema,
  success,
  activatedAt: timestamp,
  updatedAt: timestamp,
  activationRefs: z.array(
    z.strictObject({ domain: z.string().max(80), id: z.string().max(100) }),
  ),
  outcome: z
    .strictObject({
      value: z.number().finite().nullable(),
      coverage: z.number().min(0).max(1),
      evaluatedAt: timestamp,
      interpretation: z.enum([
        "insufficient_data",
        "on_track",
        "below_target",
        "met",
      ]),
    })
    .nullable(),
});
export const coachingRunSchema = z.strictObject({
  id,
  agentId: id.nullable(),
  kind: coachingRunKindSchema,
  status: coachingRunStatusSchema,
  from: day,
  to: day,
  startedAt: timestamp.nullable(),
  finishedAt: timestamp.nullable(),
  leaseUntil: timestamp.nullable(),
  failureCode: z
    .enum([
      "configuration",
      "authentication",
      "quota",
      "connectivity",
      "timeout",
      "invalid_output",
      "cancelled",
      "internal",
    ])
    .nullable(),
});
export const coachingAgentSchema = z.strictObject({
  id,
  name: text,
  domains: z.array(coachingDomainSchema).min(1).max(5),
  enabled: z.boolean(),
  credentialKind: z.enum(["api_key", "oauth"]),
  hasCredential: z.boolean(),
  lastSeenAt: timestamp.nullable(),
  expiresAt: timestamp.nullable(),
});
export const coachingAgentCreateSchema = z.strictObject({
  name: text,
  domains: z.array(coachingDomainSchema).min(1).max(5),
  oauthClientId: z.string().min(1).max(500).optional(),
});
export const coachingRunClaimSchema = z.strictObject({ operationId: id });
export const coachingLeaseSchema = z.strictObject({
  runId: id,
  leaseToken: z.string().min(32).max(200),
});
export const coachingSubmitSchema = coachingLeaseSchema.extend({
  operationId: id,
  proposals: z.array(coachingProposalInputSchema).min(1).max(50),
});
export const coachingRunReportSchema = coachingLeaseSchema.extend({
  operationId: id,
  status: z.enum(["heartbeat", "succeeded", "failed"]),
  failureCode: coachingRunSchema.shape.failureCode.optional(),
});
export const coachingSnapshotPageSchema = z.strictObject({
  snapshotId: id,
  from: day,
  to: day,
  createdAt: timestamp,
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
  rows: z.array(coachingEvidenceRowSchema),
  warnings: z.array(z.string()),
});
export const coachingPreviewRequestSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(),
  action: coachingActionSchema.optional(),
});
export const coachingPreviewSchema = z.strictObject({
  proposalId: id,
  revision: z.number().int().nonnegative(),
  action: coachingActionSchema,
  previewToken: z.string().length(64),
  expiresAt: timestamp,
  effects: z.array(
    z.strictObject({
      label: z.string(),
      before: z.json(),
      after: z.json(),
      unit: z.string().nullable(),
    }),
  ),
  warnings: z.array(z.string()),
});
export const coachingReviewSchema = z.discriminatedUnion("decision", [
  z.strictObject({
    decision: z.literal("accept"),
    operationId: id,
    expectedRevision: z.number().int().nonnegative(),
    previewToken: z.string().length(64),
    action: coachingActionSchema,
    reason: description.optional(),
  }),
  z.strictObject({
    decision: z.literal("decline"),
    operationId: id,
    expectedRevision: z.number().int().nonnegative(),
    reason: description.optional(),
  }),
]);
export const coachingCommitmentPatchSchema = z.strictObject({
  operationId: id,
  expectedRevision: z.number().int().nonnegative(),
  status: z.enum(["completed", "skipped", "stopped"]),
  reason: description.optional(),
  effort: z.enum(["low", "medium", "high"]).optional(),
  feasibility: z.enum(["easy", "manageable", "difficult"]).optional(),
});
export const coachingEventSchema = z.strictObject({
  sequence: z.number().int().nonnegative(),
  proposalId: id.nullable(),
  actionId: id.nullable(),
  kind: z.string(),
  createdAt: timestamp,
  data: z.json(),
});
export const coachingContextSchema = z.strictObject({
  enabled: z.boolean(),
  timezone: z.string(),
  today: day,
  settings: coachingSettingsSchema,
  agent: coachingAgentSchema.nullable(),
  due: z
    .strictObject({
      kind: coachingRunKindSchema,
      slotKey: z.string(),
      from: day,
      to: day,
    })
    .nullable(),
  runs: z.array(coachingRunSchema),
  proposals: z.array(coachingProposalSchema),
  commitments: z.array(coachingCommitmentSchema),
  events: z.array(coachingEventSchema),
  nextEventCursor: z.number().int().nonnegative(),
  reconsiderTopics: z.array(z.string()),
  nextProposalOffset: z.number().int().nonnegative().nullable(),
  nextCommitmentOffset: z.number().int().nonnegative().nullable(),
});
export const coachingClaimResultSchema = z
  .strictObject({
    run: coachingRunSchema,
    leaseToken: z.string(),
    snapshotId: id,
  })
  .nullable();
export const coachingSubmitResultSchema = z.strictObject({
  proposalIds: z.array(id),
  suppressedCount: z.number().int().nonnegative(),
});
export const coachingReportResultSchema = z.strictObject({
  run: coachingRunSchema,
  publishedCount: z.number().int().nonnegative(),
});
export const coachingInboxSchema = z.strictObject({
  proposals: z.array(coachingProposalSchema),
  commitments: z.array(coachingCommitmentSchema),
  nextOffset: z.number().int().nonnegative().nullable(),
});
export const coachingRunnerOutputSchema = z.strictObject({
  proposals: z.array(coachingProposalInputSchema).max(200),
  summary: z.string().max(2000),
});

export type CoachingSettings = z.infer<typeof coachingSettingsSchema>;
export type CoachingSettingsPatch = z.infer<typeof coachingSettingsPatchSchema>;
export type CoachingDomain = z.infer<typeof coachingDomainSchema>;
export type CoachingAction = z.infer<typeof coachingActionSchema>;
export type CoachingProposalInput = z.infer<typeof coachingProposalInputSchema>;
export type CoachingProposal = z.infer<typeof coachingProposalSchema>;
export type CoachingCommitment = z.infer<typeof coachingCommitmentSchema>;
export type CoachingRun = z.infer<typeof coachingRunSchema>;
export type CoachingAgent = z.infer<typeof coachingAgentSchema>;
export type CoachingAgentCreate = z.infer<typeof coachingAgentCreateSchema>;
export type CoachingEvidenceRow = z.infer<typeof coachingEvidenceRowSchema>;
export type CoachingSnapshotPage = z.infer<typeof coachingSnapshotPageSchema>;
export type CoachingContext = z.infer<typeof coachingContextSchema>;
export type CoachingPreview = z.infer<typeof coachingPreviewSchema>;
export type CoachingReview = z.infer<typeof coachingReviewSchema>;
export type CoachingCommitmentPatch = z.infer<
  typeof coachingCommitmentPatchSchema
>;
export type CoachingSubmit = z.infer<typeof coachingSubmitSchema>;
export type CoachingRunReport = z.infer<typeof coachingRunReportSchema>;
export type CoachingGoalField = z.infer<typeof coachingGoalFieldSchema>;
export const coachingPlanningItemSchema = z.strictObject({
  kind: z.enum([
    "food",
    "variant",
    "meal",
    "meal_type",
    "meal_plan",
    "exercise",
    "workout_preset",
    "workout_plan",
    "habit",
    "measurement_reminder",
    "mobility_routine",
    "mobility_schedule",
  ]),
  id: z.string(),
  label: z.string(),
  domain: coachingDomainSchema,
  data: z.json(),
});
export const coachingPlanningContextSchema = z.strictObject({
  items: z.array(coachingPlanningItemSchema),
  offset: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
  total: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
});
export type CoachingPlanningItem = z.infer<typeof coachingPlanningItemSchema>;
export const coachingSettingsResponseSchema = z.strictObject({
  featureEnabled: z.boolean(),
  timezone: z.string(),
  settings: coachingSettingsSchema,
  reconsiderTopics: z.array(z.string()),
  agents: z.array(coachingAgentSchema),
});

export type CoachingFeedback = Pick<
  CoachingCommitmentPatch,
  "reason" | "effort" | "feasibility"
>;
