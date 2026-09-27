import { z } from "zod";

const accountId = z.uuid();
export const engagementSettingsDatabaseSchema = z.object({
  user_id: accountId,
  revision: z.number().int().nonnegative(),
  remote_enabled: z.boolean(),
  quiet_start: z.string(),
  quiet_end: z.string(),
  hydration_enabled: z.boolean(),
  meal_capture_enabled: z.boolean(),
  meal_review_enabled: z.boolean(),
  movement_break_enabled: z.boolean(),
  mobility_enabled: z.boolean(),
  updated_at: z.date(),
});

export const engagementDeviceDatabaseSchema = z.object({
  user_id: accountId,
  installation_id: z.uuid(),
  platform: z.enum(["ios", "android"]),
  token_ciphertext: z.string(),
  token_iv: z.string(),
  token_tag: z.string(),
  enabled: z.boolean(),
  last_seen_at: z.date(),
});

export const engagementOccurrenceDatabaseSchema = z.object({
  id: z.uuid(),
  user_id: accountId,
  kind: z.enum([
    "hydration",
    "meal_capture",
    "meal_review",
    "movement_break",
    "mobility",
  ]),
  local_day: z.iso.date(),
  scheduled_at: z.date(),
  status: z.enum([
    "pending",
    "sending",
    "sent",
    "skipped",
    "cancelled",
    "failed",
  ]),
  delivery_owner: z.enum(["remote", "local"]),
  sent_at: z.date().nullable(),
  lease_until: z.date().nullable(),
  attempt_count: z.number().int(),
  created_at: z.date(),
});

export const engagementActionReceiptDatabaseSchema = z.object({
  user_id: accountId,
  operation_id: z.uuid(),
  occurrence_id: z.uuid(),
  request_fingerprint: z.string().length(64),
  result: z.record(z.string(), z.unknown()),
  created_at: z.date(),
});

export const engagementDeliveryDatabaseSchema = z.object({
  occurrence_id: z.uuid(),
  user_id: accountId,
  installation_id: z.uuid(),
  ticket_id: z.string().nullable(),
  status: z.enum(["claimed", "accepted", "delivered", "failed"]),
  error_code: z.string().nullable(),
  claimed_at: z.date(),
  checked_at: z.date().nullable(),
});

export const engagementChangeEventDatabaseSchema = z.object({
  sequence: z.number().int(),
  user_id: accountId,
  domain: z.string(),
  subject_id: z.string(),
  created_at: z.date(),
});
