---
title: Health Check-in Management Tool
description: Tool for logging and tracking various health metrics including biometrics, mood, sleep, and fasting.
---

# Health Check-in Management Tool (`sparky_manage_checkin`)

The `sparky_manage_checkin` tool is a primary interface for logging and tracking various health metrics. It allows users and AI agents to record biometrics (weight, steps, measurements), custom health metrics, mood, sleep, and fasting windows.

**Tool Name:** `sparky_manage_checkin`

**Description:** Primary tool for health tracking. Use this to log your WEIGHT, daily step count, height, body measurements (waist, neck, hips), mood, sleep duration/quality, and fasting windows. Supports providing health details across multiple turns.

## Actions

The `sparky_manage_checkin` tool supports the following actions:

### `log_biometrics`
- **Description:** Logs or updates various biometric measurements for a given date.
- **Parameters:**
    - `entry_date` (string, YYYY-MM-DD): The date of the record.
    - `weight` (number, optional): Weight value.
    - `weight_unit` (enum: "kg", "lbs", "lb", "g", optional): Unit for weight (defaults to kg).
    - `steps` (number, optional): Daily step count.
    - `height` (number, optional): Height value.
    - `height_unit` (enum: "cm", "in", "inch", "ft", optional): Unit for height.
    - `neck` (number, optional): Neck measurement.
    - `waist` (number, optional): Waist measurement.
    - `hips` (number, optional): Hips measurement.
    - `measurements_unit` (enum: "cm", "in", "inch", optional): Unit for body measurements.
    - `body_fat` (number, optional): Body fat percentage.

### `log_custom_metric`
- **Description:** Logs a value for a user-defined custom health category.
- **Parameters:**
    - `category_name` (string): Name of the custom category (e.g., "Blood Pressure").
    - `value` (string or number): The value to record.
    - `unit` (string, optional): Unit for the recorded value.
    - `notes` (string, optional): Optional notes for the entry.
    - `entry_date` (string, YYYY-MM-DD): The date of the record.

### `list_categories`
- **Description:** Lists all user-defined custom health categories.
- **Parameters:** None.

### `create_category`
- **Description:** Creates a new custom health category for logging.
- **Parameters:**
    - `category_name` (string): Name of the custom category.
    - `unit` (string, optional): Unit for the new category.

### `log_mood`
- **Description:** Logs the user's mood for a specific date.
- **Parameters:**
    - `mood_value` (number): Mood score (typically 1-10).
    - `notes` (string, optional): Optional notes about the mood.
    - `entry_date` (string, YYYY-MM-DD): The date of the record.

### `log_fasting`
- **Description:** Logs a fasting window.
- **Parameters:**
    - `start_time` (string, ISO 8601): Start timestamp of the fasting window.
    - `end_time` (string, ISO 8601, optional): End timestamp of the fasting window.
    - `fasting_status` (enum: "ACTIVE", "COMPLETED", "CANCELLED", optional): Current status of the fast.
    - `fasting_type` (string, optional): Type of fasting (e.g., "Intermittent").

### `log_sleep`
- **Description:** Logs sleep details for a given date.
- **Parameters:**
    - `entry_date` (string, YYYY-MM-DD): The date of the sleep entry.
    - `duration_seconds` (number, optional): Total sleep duration in seconds.
    - `sleep_score` (number, optional): Sleep quality score (0-100).
    - `bedtime` (string, ISO 8601, optional): Bedtime timestamp.
    - `wake_time` (string, ISO 8601, optional): Wake up timestamp.
    - `source` (string, optional): Source of data (e.g., "manual", "Garmin", "Fitbit").

### `list_checkin_diary`
- **Description:** Retrieves all logged health check-in entries (biometrics, mood, sleep, custom metrics) for a specific date.
- **Parameters:**
    - `entry_date` (string, YYYY-MM-DD, optional): The date to retrieve the diary for. Defaults to today.

## Read-only measurement reminder status

`sparky_get_measurement_reminder_status` is a separate pure-read tool published for MCP read-only API keys and OAuth connections with `mcp:read`. It accepts an optional `date` (`YYYY-MM-DD`, `today`, or `yesterday`); the default uses the authenticated account's timezone. It reads only that owner's configured measurement reminders and saved measurements on that calendar day.

Each reminder retains its configuration and `due` state and adds:

| Field | Meaning |
| --- | --- |
| `measurement_recorded` | A saved value exists on the requested day, including zero. |
| `value` | Numeric kg for weight; unchanged stored text for a custom measurement. Null when absent. |
| `unit` | `kg` for weight or the custom category's configured measurement unit. Null when absent. |
| `measurement_id` | ID of the saved row, or null. |
| `recorded_at` | Last update timestamp of the selected saved row, or null. |
| `source` | Stored source for a custom measurement, or null when provenance is unavailable. Weight has no stored provider source. |

For example, a saved weigh-in yields these fields (illustrative data):

```json
{
  "measurement_key": "weight",
  "due": true,
  "measurement_recorded": true,
  "measurement_id": "11111111-1111-4111-8111-111111111111",
  "value": 78.3,
  "unit": "kg",
  "recorded_at": "2026-10-01T07:05:00.000Z",
  "source": null
}
```

When several custom entries exist on the day, the latest updated entry is selected with deterministic tie-breaking; its value, timestamp and source come from the same row. Missing values are never filled from another day. The tool does not log measurements, expose a delegated profile, or return measurements without a configured reminder. The MCP-only response contract is `measurementReminderMcpStatusResponseSchema` in `shared/src/schemas/api/DailyTracking.api.zod.ts`; the reminder configuration REST response and Daily Progress completion projection are unchanged.
