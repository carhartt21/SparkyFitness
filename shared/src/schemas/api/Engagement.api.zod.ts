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
