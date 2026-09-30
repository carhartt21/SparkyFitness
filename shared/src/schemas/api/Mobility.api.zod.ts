import { z } from "zod";

const timestamp = z.iso.datetime({ offset: true });
export const mobilityClockSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const stepFields = {
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(500),
  side: z.enum(["both", "left", "right"]),
  exerciseId: z.uuid().nullable().optional(),
  transitionSeconds: z.number().int().min(0).max(600),
};
export const mobilityTimedStepSchema = z.strictObject({
  ...stepFields,
  kind: z.literal("timed"),
  durationSeconds: z.number().int().min(5).max(3600),
});
export const mobilityRepetitionsStepSchema = z.strictObject({
  ...stepFields,
  kind: z.literal("repetitions"),
  repetitions: z.number().int().min(1).max(1000),
});
export const mobilityStepSchema = z.discriminatedUnion("kind", [
  mobilityTimedStepSchema,
  mobilityRepetitionsStepSchema,
]);
export const mobilityRoutineSchema = z
  .strictObject({
    id: z.uuid(),
    name: z.string().trim().min(1).max(120),
    steps: z.array(mobilityStepSchema).min(1).max(40),
    cue: z.enum(["off", "haptic", "sound", "both"]),
    reminderTime: mobilityClockSchema.nullable().default(null),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine(
    (value) =>
      new Set(value.steps.map((step) => step.id)).size === value.steps.length,
    { message: "Steps must have unique IDs.", path: ["steps"] },
  );
export const mobilityOutcomeSchema = z.strictObject({
  stepId: z.uuid(),
  result: z.enum(["completed", "skipped"]),
  recordedAt: timestamp,
});
export const mobilitySessionSchema = z
  .strictObject({
    id: z.uuid(),
    routine: mobilityRoutineSchema,
    planId: z.uuid().nullable().optional(),
    state: z.enum(["running", "paused", "finished", "cancelled"]),
    phase: z.enum(["step", "transition"]),
    stepIndex: z.number().int().nonnegative(),
    phaseStartedAt: timestamp.nullable(),
    elapsedSeconds: z.number().finite().nonnegative(),
    outcomes: z.array(mobilityOutcomeSchema).max(40),
    startedAt: timestamp,
    endedAt: timestamp.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.stepIndex >= value.routine.steps.length)
      ctx.addIssue({
        code: "custom",
        message: "Invalid step index.",
        path: ["stepIndex"],
      });
    const ids = new Set(value.routine.steps.map((step) => step.id));
    if (
      value.outcomes.some((outcome) => !ids.has(outcome.stepId)) ||
      new Set(value.outcomes.map((outcome) => outcome.stepId)).size !==
        value.outcomes.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid step outcomes.",
        path: ["outcomes"],
      });
    if (
      (value.state === "finished" || value.state === "cancelled") !==
      (value.endedAt !== null)
    )
      ctx.addIssue({
        code: "custom",
        message: "Session end must match its state.",
        path: ["endedAt"],
      });
  });
export const mobilityScheduleSchema = z
  .strictObject({
    id: z.uuid(),
    routineId: z.uuid(),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .refine(
        (days) => new Set(days).size === days.length,
        "Weekdays must be unique.",
      ),
    time: mobilityClockSchema,
    startDay: z.iso.date(),
    endDay: z.iso.date().nullable(),
    enabled: z.boolean(),
  })
  .refine(
    (value) => !value.endDay || value.endDay >= value.startDay,
    "Invalid date range.",
  );
export const mobilityPlanSchema = z.strictObject({
  id: z.uuid(),
  routine: mobilityRoutineSchema,
  scheduleId: z.uuid().nullable(),
  day: z.iso.date(),
  time: mobilityClockSchema,
  state: z.enum(["planned", "active", "completed", "skipped", "cancelled"]),
  activeSessionId: z.uuid().nullable(),
});
export const mobilityPlanResultSchema = z.strictObject({
  state: z.enum(["completed", "skipped"]),
  outcomes: z.array(mobilityOutcomeSchema).max(40).default([]),
  recordedAt: timestamp,
});
const versioned = <T extends z.ZodType>(data: T) =>
  z.strictObject({
    revision: z.number().int().nonnegative(),
    data,
    deleted: z.boolean().default(false),
  });
export const mobilityRoutineRecordSchema = versioned(mobilityRoutineSchema);
export const mobilityScheduleRecordSchema = versioned(mobilityScheduleSchema);
export const mobilityPlanRecordSchema = versioned(mobilityPlanSchema);
export const mobilitySessionRecordSchema = versioned(
  mobilitySessionSchema,
).extend({
  provenance: z.enum(["phone", "web", "mcp", "import"]),
});
export const mobilitySnapshotSchema = z.strictObject({
  routines: z.array(mobilityRoutineRecordSchema),
  schedules: z.array(mobilityScheduleRecordSchema),
  plans: z.array(mobilityPlanRecordSchema),
  sessions: z.array(mobilitySessionRecordSchema),
  timezone: z.string(),
});
export const mobilityMutationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("routine"),
    data: mobilityRoutineSchema,
    deleted: z.boolean().default(false),
  }),
  z.strictObject({
    kind: z.literal("schedule"),
    data: mobilityScheduleSchema,
    deleted: z.boolean().default(false),
  }),
  z.strictObject({
    kind: z.literal("plan"),
    data: mobilityPlanSchema,
    deleted: z.boolean().default(false),
  }),
  z.strictObject({
    kind: z.literal("session"),
    data: mobilitySessionSchema,
    deleted: z.boolean().default(false),
  }),
  z.strictObject({
    kind: z.literal("result"),
    planId: z.uuid(),
    data: mobilityPlanResultSchema,
  }),
]);
export const mobilityOperationSchema = z.strictObject({
  operationId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  mutation: mobilityMutationSchema,
});
export type MobilityRoutine = z.infer<typeof mobilityRoutineSchema>;
export type MobilityStep = z.infer<typeof mobilityStepSchema>;
export type MobilitySession = z.infer<typeof mobilitySessionSchema>;
export type MobilitySchedule = z.infer<typeof mobilityScheduleSchema>;
export type MobilityPlan = z.infer<typeof mobilityPlanSchema>;
export type MobilityOperation = z.infer<typeof mobilityOperationSchema>;
export type MobilitySnapshot = z.infer<typeof mobilitySnapshotSchema>;

export type MobilityPlanRecord = z.infer<typeof mobilityPlanRecordSchema>;
