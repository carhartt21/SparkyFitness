# MCP-based training

Use an MCP-connected assistant to inspect recorded training, draft a week, and maintain saved workout presets or mobility routines. Keep three steps separate: **plan**, **perform**, and **record**. An assistant's proposed session is not a completed workout.

Start with the [MCP connection guide](/features/mcp-server). The names beginning with `sparky_` below are retained API identifiers, not the app's display name. Use the exact names returned by your connection's tool list.

## What your connection can do

| Task                                                              | Current tool/action                                                                                                                                                  | Availability                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read recent training, daily totals, exercise details and progress | `sparky_get_recent_exercise_entries`, `sparky_get_exercise_diary`, `sparky_get_daily_exercise_totals`, `sparky_get_exercise_details`, `sparky_get_exercise_progress` | Reviewed read tools on API-key and OAuth connections.                                                                                                                                                           |
| Read declared health context and daily check-in                   | `sparky_list_health_context_periods`, `sparky_get_daily_checkin`                                                                                                     | Read tools; missing records do not mean a poor day or inactivity.                                                                                                                                               |
| Inspect/create/edit workout presets                               | `sparky_manage_exercise` with `get_workout_presets`, `get_workout_preset`, `create_workout_preset`, `update_workout_preset`                                          | Full API key, or OAuth with `mcp:write`. Even its read actions are absent from a read-only connection because the tool mixes reads and writes.                                                                  |
| List/inspect/delete weekly plan templates                         | `sparky_manage_workout_plans`                                                                                                                                        | Full API-key connection only. Current actions are `list_workout_plans`, `get_workout_plan`, `delete_workout_plan`; creation/update is in the app. Activity fields are not fully represented in its text output. |
| Read/edit mobility routines, schedules and dated plans            | `xot_get_mobility`, `xot_update_mobility`                                                                                                                            | Read on both endpoints; writes need full API access or OAuth `mcp:write`.                                                                                                                                       |
| Record an activity you actually performed                         | `sparky_manage_exercise` → `log_exercise`                                                                                                                            | Full API key or OAuth `mcp:write`; writes the diary, not a live phone/Watch session.                                                                                                                            |

The server does not expose general weekly-plan creation/update through MCP in the current release. It also does not remotely start a live workout, control a Watch session, or guarantee an Apple Health export for an MCP diary write. Use the mobile tracking and Health sync flows for those tasks.

## Review the evidence first

Give the assistant an explicit date range and ask it to name the records used. A useful German prompt is:

> Lies meine tatsächlich protokollierten Trainingseinheiten der letzten sieben Tage und meinen selbst angegebenen Gesundheitskontext. Unterscheide geplante Einheiten, abgeschlossene Einheiten und fehlende Daten. Ändere noch nichts.

Read-only/OAuth diary queries are bounded to seven days; other reviewed ranges are generally limited to 31 days. Exercise progress/statistics require explicit start and end dates. Paginate when a response is truncated. Dates refer to the account timezone; specify the day instead of relying on an older conversation's “today”.

Missing logging is unknown. Recorded nutrition or weight trends do not establish a diagnosis, recovery state, or causal relationship. Ask the assistant to distinguish observations from suggestions.

## Draft a week, then save it in the app

> Entwirf einen Wochenplan mit ganzen Trainingseinheiten: Montag 10 km Lauf und 45 Minuten Krafttraining, Dienstag Fußball. Verwende vorhandene Trainingsvorlagen, wenn sie passen. Kennzeichne optionale Einheiten und Ruhetage. Zeige den Entwurf, ohne Einträge als erledigt zu speichern.

Review duration, distance, dates and optional sessions. Enter the approved draft through [Weekly training plans](/features/exercises/weekly-planning). When the assistant needs a saved preset, a write-capable connection can fetch it through `get_workout_preset` before suggesting changes.

For a preset edit:

> Lies zuerst die vollständige Vorlage. Zeige mir genau, welche Übungen, Sätze und Pausen du ändern möchtest. Behalte alle anderen Übungen und Supersatzgruppen bei. Speichere erst nach meiner Zustimmung und lies die Vorlage anschließend erneut.

`update_workout_preset` and `delete_workout_preset` require `confirmed: true`. Supplying `exercises` replaces the **entire** exercise list, not just the changed rows. Each weight reduction of a drop set remains a separate drop-set row. Other supported diary writes can take effect immediately after tool execution; consent to write is not a draft/approval inbox in the app.

## Mobility planning and results

`xot_get_mobility` returns routines, recurring schedules, dated plans and recorded sessions with revisions. It is a read-only snapshot; merely inspecting dates does not create occurrences. Its maximum range is 93 days.

> Lies meine Mobilitätsroutinen und geplanten Termine. Schlage eine passende Routine für Dienstag um 18:00 Uhr vor. Zeige die Änderung, bevor du sie speicherst. Markiere keine Übungen als abgeschlossen.

For an approved change, `xot_update_mobility` uses the record's `expectedRevision` (`0` for a new record) and a UUID `operationId`. Keep the same operation ID when retrying the same request. After a revision conflict, reread the snapshot and reconcile the change before submitting a new operation. Do not overwrite a running phone session.

New routines and steps need UUID IDs; routines also require ISO `createdAt` and
`updatedAt` timestamps. A custom step without a linked saved exercise uses
`exerciseId: null`, not an invented exercise ID. Preserve nullable fields such as
a schedule's `endDay` and a plan's `scheduleId`/`activeSessionId`. Domain failures
return `Error [CONFLICT]`, `Error [NOT_FOUND]` or `Error [VALIDATION]` with a
corrective suggestion. An error is not a saved routine; read again before
retrying an uncertain request. The in-app assistant and MCP share the same
argument normalization and retain these meaningful nulls.

A manual completion uses a `result` mutation for the existing plan, with only the step outcomes you actually confirmed. Omitted outcomes stay unknown. Mobility completion does not create exercise calories or an Apple Health workout.

## Record and verify

For completed training, tell the assistant the actual date, exercise, duration, sets and units. Do not copy planned values into history merely because a scheduled session was due. `log_workout_preset` writes preset entries to the diary; it is **not** “start workout”.

After a write, ask for a fresh read of the preset, mobility snapshot or exercise diary and check the app. Exercise/food logging tools do not all have operation-ID deduplication. If a call times out, inspect the diary before retrying so an uncertain successful write is not duplicated.

See [Exercise tool contracts](/developer/mcp/exercise) for payload fields and [Notifications](/features/settings/notifications#mcp-notification-updates) for changing reminder settings through OAuth.

Completed phone mobility sessions with confirmed movement now appear in the diary on their account-local start day. On iPhone, workout recording under Sync enables an optional Apple Health/Fitness export as flexibility training. Confirm or edit the labelled light-stretching calorie estimate, enter known active calories, or skip; session history offers a later export/retry. Estimates require a recorded weight and confirmed timed steps. Export uses the elapsed session time, including pauses and transitions. A manual MCP plan result does not automatically create a Health workout or calorie credit.
