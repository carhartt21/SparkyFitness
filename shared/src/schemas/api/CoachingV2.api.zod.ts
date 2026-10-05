import { z } from "zod";
import {
  coachingSettingsSchema,
  defaultCoachingSettings,
  coachingAgentSchema,
  coachingAgentCreateSchema,
  coachingRunSchema,
  coachingContextSchema,
  coachingSettingsResponseSchema,
  coachingRunReportSchema,
  coachingEvidenceRowSchema,
} from "./Coaching.api.zod.ts";
import { mobilityClockSchema } from "./Mobility.api.zod.ts";

export const coachingCadenceSchema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);
export const coachingRunKindV2Schema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "manual",
]);
export const coachingContextPermissionSchema = z.enum([
  "supplement_adherence",
  "notification_history",
]);
const permissions = z
  .array(coachingContextPermissionSchema)
  .max(2)
  .refine((values) => new Set(values).size === values.length);
export const coachingSettingsV2Schema = coachingSettingsSchema.extend({
  protocolVersion: z.literal(2),
  reviewTime: mobilityClockSchema,
  cadences: z
    .array(coachingCadenceSchema)
    .min(1)
    .max(4)
    .refine((values) => new Set(values).size === values.length),
  contextPermissions: permissions,
});
export const defaultCoachingSettingsV2: z.infer<
  typeof coachingSettingsV2Schema
> = {
  ...defaultCoachingSettings,
  protocolVersion: 2,
  reviewTime: "08:00",
  cadences: ["daily", "weekly", "monthly", "yearly"],
  contextPermissions: [],
};
export const coachingSettingsPatchV2Schema = coachingSettingsV2Schema
  .omit({ revision: true })
  .partial()
  .extend({ expectedRevision: z.number().int().nonnegative() });
export const coachingAgentV2Schema = coachingAgentSchema.extend({
  protocolVersion: z.union([z.literal(1), z.literal(2)]),
  contextPermissions: permissions,
  processedEventCursor: z.number().int().nonnegative(),
});
export const coachingAgentCreateV2Schema = coachingAgentCreateSchema.extend({
  protocolVersion: z.literal(2),
  contextPermissions: permissions,
});
export const coachingRunV2Schema = coachingRunSchema.extend({
  kind: coachingRunKindV2Schema,
});
export const coachingContextV2Schema = coachingContextSchema.extend({
  protocolVersion: z.literal(2),
  settings: coachingSettingsV2Schema,
  agent: coachingAgentV2Schema.nullable(),
  runs: z.array(coachingRunV2Schema),
  due: z
    .strictObject({
      kind: coachingRunKindV2Schema,
      slotKey: z.string(),
      from: z.iso.date(),
      to: z.iso.date(),
    })
    .nullable(),
  processedEventCursor: z.number().int().nonnegative(),
});
export const coachingSettingsResponseV2Schema =
  coachingSettingsResponseSchema.extend({
    settings: coachingSettingsV2Schema,
    agents: z.array(coachingAgentV2Schema),
  });
export const coachingRecapInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(4000),
  observations: z
    .array(
      z.strictObject({
        text: z.string().trim().min(1).max(1000),
        rowIds: z.array(z.string().min(1).max(200)).min(1).max(20),
      }),
    )
    .max(12),
  limitations: z.array(z.string().trim().min(1).max(1000)).max(12),
});
export const coachingRecapSchema = coachingRecapInputSchema.extend({
  id: z.uuid(),
  kind: coachingRunKindV2Schema,
  from: z.iso.date(),
  to: z.iso.date(),
  createdAt: z.iso.datetime({ offset: true }),
  readAt: z.iso.datetime({ offset: true }).nullable(),
  proposalIds: z.array(z.uuid()),
  evidence: z.array(coachingEvidenceRowSchema).max(240),
});
export const coachingRecapListSchema = z.strictObject({
  recaps: z.array(coachingRecapSchema.omit({ evidence: true })),
  nextOffset: z.number().int().nonnegative().nullable(),
  unreadCount: z.number().int().nonnegative(),
});
export const coachingRunReportV2Schema = coachingRunReportSchema
  .extend({
    recap: coachingRecapInputSchema.optional(),
    processedEventCursor: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.status === "succeeded" &&
      (!value.recap || value.processedEventCursor === undefined)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "A successful review needs a recap and the processed feedback cursor.",
      });
  });
export const coachingClaimResultV2Schema = z
  .strictObject({
    run: coachingRunV2Schema,
    leaseToken: z.string(),
    snapshotId: z.uuid(),
    feedbackCursor: z.number().int().nonnegative(),
    feedbackThrough: z.number().int().nonnegative(),
    instructions: z.string(),
  })
  .nullable();
export const coachingReportResultV2Schema = z.strictObject({
  run: coachingRunV2Schema,
  publishedCount: z.number().int().nonnegative(),
  recapId: z.uuid().nullable(),
});
export type CoachingSettingsV2 = z.infer<typeof coachingSettingsV2Schema>;
export type CoachingSettingsPatchV2 = z.infer<
  typeof coachingSettingsPatchV2Schema
>;
export type CoachingAgentCreateV2 = z.infer<typeof coachingAgentCreateV2Schema>;
export type CoachingContextPermission = z.infer<
  typeof coachingContextPermissionSchema
>;
export type CoachingRecap = z.infer<typeof coachingRecapSchema>;
export type CoachingRunReportV2 = z.infer<typeof coachingRunReportV2Schema>;
export const coachingConnectionsSchema = z.strictObject({
  connections: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      client_id: z.string(),
      scopes: z.array(z.string()),
      created_at: z.string(),
    }),
  ),
});
