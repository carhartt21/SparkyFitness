# MCP server and connected assistants

An MCP connection lets an external assistant call X on Track's existing data tools. Use it to read recorded food, exercise and daily tracking, or explicitly authorize supported writes. The assistant receives the data returned by its tools; a successful connection is not proof that every feature in the app has an MCP tool.

For practical workflows, start with [MCP-based training](/features/exercises/mcp-training) and [MCP notification updates](/features/settings/notifications#mcp-notification-updates).

## Choose the connection

| Connection            | Endpoint       | Access                                                                                                                                                  |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCP read-only API key | `/mcp`         | Reviewed query tools only. This key cannot authenticate normal protected REST routes.                                                                   |
| Full API key          | `/mcp`         | Full registry, including mixed read/write management tools. Use only when the integration needs this access.                                            |
| Account OAuth         | `/mcp/chatgpt` | Reviewed reads with `mcp:read`; selected food, exercise, water, mobility and notification writes with `mcp:write`. Requires server OAuth configuration. |

Both use Streamable HTTP. The server exposes POST endpoints; opening the URL in a browser is not a connection test. Tool names beginning with `sparky_` remain compatibility identifiers. X on Track is the product name; do not rename a tool when configuring a client.

## Connect with OAuth

In an OAuth-capable MCP client's connection settings, enter `https://<your-host>/mcp/chatgpt`. Start authorization, sign in to X on Track, and review the requested read/write scopes. OAuth uses the account authorization flow, not an application API key pasted into a Bearer header.

Client menus and supported scopes vary. Use that client's current connection instructions and inspect its returned tool list after authorization. If an authorization link expires, start a new flow instead of reusing the old browser URL. After a server update, refresh/reconnect the client and start a fresh conversation if its tool schemas remain cached.

Review and disconnect assistants in **web Settings → Connected assistants**. Revocation blocks subsequent requests even if a signed access token has not expired. Supported writes can apply immediately when called; there is no general second approval inbox inside X on Track. Individual tools can require confirmation, such as preset updates/deletes.

If the endpoint returns `mcp_oauth_not_configured`, the administrator must configure OAuth and its proxy routes. See [Assistant access and notification delivery](/developer/engagement-delivery).

## Connect with an API key

Create a key in **web Settings → API Key Management**. Prefer **MCP read-only** for inspection. Send it as `Authorization: Bearer <API_KEY>` to `https://<your-host>/mcp`, using your client's supported secure credential mechanism. Never put a live key into a committed configuration, prompt or diagnostic screenshot.

A remote-capable client's configuration has this general shape; replace the placeholder locally and follow the client's credential-storage conventions:

```json
{
  "mcpServers": {
    "x-on-track": {
      "url": "https://<your-host>/mcp",
      "headers": {
        "Authorization": "Bearer <API_KEY>"
      }
    }
  }
}
```

Local development can use `http://localhost:8080/mcp` through Vite or `http://localhost:3010/mcp` directly. These local addresses are not reachable from a hosted assistant or phone merely because they work in the Mac's browser. Use a trusted HTTPS server URL for remote connections. An API key and an OAuth token belong to their respective endpoints; they are not interchangeable.

## Available workflows

| Workflow                                | Current surface                                                                                                | Important boundary                                                                                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Food search, diary and nutrition        | Reviewed `sparky_*` food reads; `sparky_manage_food` with write access                                         | Preserve provider identity, units and saved snapshots. Quick Add logs a newly created/imported food without adding it to the library; it does not hide an existing saved food. |
| Exercise history and presets            | Reviewed exercise reads; `sparky_manage_exercise` with write access                                            | `log_workout_preset` records diary entries; it does not start a live phone/Watch workout.                                                                                      |
| Weekly training plans                   | Full-key `sparky_manage_workout_plans` lists/inspects/deletes templates                                        | Create/update in the app; current text output does not fully describe activity-first assignments.                                                                              |
| Mobility                                | `xot_get_mobility`, write-capable `xot_update_mobility`                                                        | Revisioned plans/results, not exercise calories or Apple Health workouts.                                                                                                      |
| Notifications                           | OAuth `xot_get_notification_settings`, write-capable `xot_update_notification_settings`, `xot_act_on_reminder` | Phone activation/permission first; account settings do not configure local intake follow-ups.                                                                                  |
| Coaching, reports and legacy management | Full API-key registry and configured in-app Trackbot tools                                                     | These are not all published by the reviewed OAuth/read-only surface. Inspect tools rather than assuming availability.                                                          |

The full registry's management actions and schemas are described in the [developer tool guides](/developer/mcp/exercise). A tool's presence depends on the endpoint, permission and registry/profile selection. A read action nested inside a write-capable management tool is not exposed to read-only credentials.

## Daily tracking reads

Reviewed tools include:

- `sparky_get_daily_checkin` and `sparky_list_daily_checkins`: draft/completed/skipped state and answers with versioned meanings. A missing day is unrecorded.
- `sparky_list_health_context_periods`: user-declared injury, illness and vacation context, not diagnoses.
- `sparky_list_habits` and `sparky_get_habit_history`: recorded values; an explicit zero is a record, whereas an omitted day is unknown.
- `sparky_get_measurement_reminder_status`: configured reminders plus actual saved value/unit, ID, timestamp and available source for the requested day. Weight is numeric kg; custom values retain stored text/unit. Absent values are null, and older readings are not substituted. Weight provider provenance is unavailable.
- `sparky_get_meal_tracking_status`: explicit meal states.
- `sparky_get_daily_progress` and `sparky_get_daily_status_context`: versioned applicable tasks and reasons, not a health score. The current MCP projection uses the legacy progress version; use the app for the expanded activity/hydration objectives.
- `sparky_list_supplements`, `sparky_get_supplement`, `sparky_list_supplement_entries`: items classified as supplements; medications are excluded.

Use the apps for daily check-in completion, explicit meal-state changes and the current daily-tracking configuration. Do not mistake a legacy biometrics/mood log for completion of the versioned daily check-in questionnaire.

Daily-tracking range tools allow up to 92 days on the full registry and 31 days on reviewed connections. Reviewed exercise-diary ranges allow seven days; other reads have their own paging limits. For an actual weigh-in, read `value` and `unit` from the measurement tool rather than treating a Daily Progress completion timestamp as the weight.

## Verify reads and writes

Ask the assistant to show the date range, units, record identifiers and missing-data limits behind its answer. Tool summaries are observations, not confirmed health conclusions or evidence that incomplete food logging is a deficit.

Before replacing a preset, read its full exercise list; replacements must retain every exercise that should remain. After a write, reread the relevant diary/settings/record and inspect the app. If a logging request times out, check whether it succeeded before retrying: not every write has an idempotency key.

## Privacy and administration

Normal tools operate as the authenticated owner with owner-scoped database access. External assistant/provider processing follows that client's settings; self-hosting X on Track does not prevent data you deliberately send to a third-party assistant from leaving your infrastructure.

Admin debugging tools are separate and off by default. They require an admin full-access API key plus the system toggle or `DEV_TOOLS_ENABLED=true`; they use elevated database access. Keep them disabled outside active debugging. Read-only API keys and account OAuth do not expose those tools.
