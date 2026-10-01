---
title: Notification and Engagement Tools
description: OAuth notification settings and reminder actions, plus legacy engagement queries.
---

# Notification and engagement tools

Notification configuration and coaching summaries are separate surfaces. A contextual nudge returns text; it does not schedule a push. For user setup, see [Notifications and reminders](/features/settings/notifications).

## OAuth notification tools

These tools are registered by `XoTServer/routes/chatgptMcpRoutes.ts` at `/mcp/chatgpt`, not by the API-key registry at `/mcp`. The endpoint requires active owner consent and `mcp:read`; writes additionally require `mcp:write`.

### `xot_get_notification_settings`

Input: `{}`. Returns account settings, `revision`, `schema_version: 2`, initialization state, reminder flags, quiet hours, daily limit and schedule fields. It does not list local scheduled intake requests or delivery occurrences.

### `xot_update_notification_settings`

Input follows `engagementSettingsPatchV2Schema` in `shared/src/schemas/api/Engagement.api.zod.ts`: a strict partial patch with required `expected_revision`.

| Field group    | Accepted fields / values                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ownership      | `remote_enabled` boolean. Initial activation needs a freshly registered phone and the mobile ownership handoff; MCP cannot register/grant permission.                                                                                       |
| Optional kinds | `hydration_enabled`, `meal_capture_enabled`, `meal_review_enabled`, `movement_break_enabled`, `mobility_enabled` booleans. Check-in, habit and weigh-in enablement/times come from daily tracking definitions/preferences, not these flags. |
| Policy         | `daily_limit`: integer 1–50 or `null` for no quota; `quiet_start`, `quiet_end`: 24-hour `HH:mm`.                                                                                                                                            |
| Hydration      | `hydration_interval_hours`: integer 1–12; `hydration_start`, `hydration_end`: `HH:mm`.                                                                                                                                                      |
| Meals/movement | `meal_capture_start`, `meal_capture_end`, `meal_capture_time`, `meal_review_time`, `movement_break_time`: `HH:mm`.                                                                                                                          |

Read first; copy the returned revision into the patch. For example, **only if the current read returned revision 7**:

```json
{
  "expected_revision": 7,
  "quiet_start": "22:00",
  "quiet_end": "08:00",
  "daily_limit": 5,
  "hydration_interval_hours": 3,
  "hydration_start": "09:00",
  "hydration_end": "20:00"
}
```

Do not write `revision`, `schema_version` or `schedule_initialized`. Windows need start before end. A conflict means reread and reconcile against newer settings; retrying a stale full snapshot can overwrite another client's intended changes. A successful patch returns fresh v2 settings. It invalidates pending slots for replanning; it is not proof of a push on the device.

### `xot_act_on_reminder`

Input follows `engagementActionSchema`:

```json
{
  "operation_id": "11111111-1111-4111-8111-111111111111",
  "occurrence_id": "22222222-2222-4222-8222-222222222222",
  "action": "snooze",
  "snooze_minutes": 15
}
```

IDs above are illustrative. Use an actual owner occurrence and a newly generated operation UUID; retain the same `operation_id` for retries of that request. `action` is `snooze` or `skip`; snooze minutes, when supplied, are 5–120. Policy and current subject state can prevent another slot. Neither action records food, water, exercise or medication intake.

There is currently no OAuth MCP delivery-status/list-occurrences tool. Mobile/web use owner-only `GET /api/v2/engagement/status`; the existing reminder payload provides an occurrence ID to native actions. Do not claim a title or a settings read supplies that ID.

## Legacy engagement queries

These tools belong to the full registry/in-app coaching category. They are **not** in the reviewed API-key/OAuth read-tool allowlist. All take a strict empty object `{}` and use the authenticated owner and account timezone; none accepts `user_id` or a mock identity.

| Tool                          | Current implementation                                                                                                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sparky_check_engagement`     | Returns rule-based trigger text from last logged exercise, recent recorded weights and count of logged days in the week. Its “missed workout” and “plateau” labels are heuristics, not evidence of a skipped planned session or a medical conclusion. |
| `sparky_get_logging_streak`   | Counts consecutive distinct logged dates, allowing a sequence to begin yesterday if today has no record. Returns `current_streak` and `last_logged`; zero/null for no history.                                                                        |
| `sparky_get_contextual_nudge` | Returns a rule-selected message from today's food/exercise/check-in entry counts, plus those counts. It is not an automatic notification and does not know all Daily Progress subjects.                                                               |

These functions are implemented; previous “coming soon” wording and `MOCK_USER_ID` documentation were stale. Keep assistant conclusions separate from the raw counts and user-declared context.

For planner, ownership, push receipts and deployment checks see [Assistant access and notification delivery](/developer/engagement-delivery).
