import { z } from "zod";

export const engagementReminderKindSchema = z.enum([
  "hydration",
  "meal_capture",
  "meal_review",
  "movement_break",
  "mobility",
]);

export const engagementSettingsSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  remote_enabled: z.boolean(),
  quiet_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  quiet_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  hydration_enabled: z.boolean(),
  meal_capture_enabled: z.boolean(),
  meal_review_enabled: z.boolean(),
  movement_break_enabled: z.boolean(),
  mobility_enabled: z.boolean(),
});

export const engagementSettingsPatchSchema = engagementSettingsSchema
  .omit({ revision: true })
  .partial()
  .extend({ expected_revision: z.number().int().nonnegative() });

export const engagementDeviceSchema = z.strictObject({
  installation_id: z.uuid(),
  expo_push_token: z.string().regex(/^Expo(nent)?PushToken\[[^\]\s]{1,512}\]$/),
  platform: z.enum(["ios", "android"]),
});

export const engagementActionSchema = z.strictObject({
  operation_id: z.uuid(),
  occurrence_id: z.uuid(),
  action: z.enum(["snooze", "skip"]),
  snooze_minutes: z.number().int().min(5).max(120).optional(),
});

export type EngagementSettings = z.infer<typeof engagementSettingsSchema>;
export type EngagementSettingsPatch = z.infer<
  typeof engagementSettingsPatchSchema
>;
export type EngagementDevice = z.infer<typeof engagementDeviceSchema>;
export type EngagementAction = z.infer<typeof engagementActionSchema>;

/** Version 1 remains strict and unchanged for already installed clients. */
export const engagementReminderKindV2Schema = z.enum([
  ...engagementReminderKindSchema.options,
  "check_in",
  "habit",
  "weigh_in",
]);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const engagementSettingsV2Schema = engagementSettingsSchema.extend({
  schema_version: z.literal(2),
  schedule_initialized: z.boolean(),
  daily_limit: z.number().int().min(1).max(50).nullable(),
  hydration_interval_hours: z.number().int().min(1).max(12),
  hydration_start: clock,
  hydration_end: clock,
  meal_capture_start: clock,
  meal_capture_end: clock,
  meal_capture_time: clock,
  meal_review_time: clock,
  movement_break_time: clock,
});
export const engagementSettingsPatchV2Schema = engagementSettingsV2Schema
  .omit({ revision: true, schema_version: true, schedule_initialized: true })
  .partial()
  .extend({ expected_revision: z.number().int().nonnegative() });
export const engagementDeviceV2Schema = engagementDeviceSchema.extend({
  protocol_version: z.literal(2),
  reminder_kinds: z.array(engagementReminderKindV2Schema).min(1),
  delivery_owner: z.enum(["local", "remote"]),
  language: z.enum(["en", "de"]),
});
export const engagementStatusSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  daily_used: z.number().int().nonnegative(),
  remote_enabled: z.boolean(),
  daily_limit: z.number().int().nullable(),
  devices: z.array(
    z.strictObject({
      installation_id: z.uuid(),
      enabled: z.boolean(),
      delivery_owner: z.enum(["local", "remote"]),
      protocol_version: z.number().int(),
      last_seen_at: z.string(),
    }),
  ),
  occurrences: z.array(
    z.strictObject({
      id: z.uuid(),
      kind: engagementReminderKindV2Schema,
      subject_id: z.string(),
      scheduled_at: z.string(),
      status: z.string(),
      delivery_owner: z.enum(["local", "remote"]),
      deliveries: z.array(
        z.strictObject({
          installation_id: z.uuid(),
          status: z.string(),
          error_code: z.string().nullable(),
        }),
      ),
    }),
  ),
  diagnostics: z.array(
    z.strictObject({
      kind: engagementReminderKindV2Schema,
      reason: z.string(),
      next_at: z.string().nullable(),
    }),
  ),
});
export type EngagementSettingsV2 = z.infer<typeof engagementSettingsV2Schema>;
export type EngagementSettingsPatchV2 = z.infer<
  typeof engagementSettingsPatchV2Schema
>;
export type EngagementDeviceV2 = z.infer<typeof engagementDeviceV2Schema>;
export type EngagementReminderKindV2 = z.infer<
  typeof engagementReminderKindV2Schema
>;
export type EngagementStatus = z.infer<typeof engagementStatusSchema>;
