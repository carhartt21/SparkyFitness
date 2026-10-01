---
title: Exercise Management Tool
description: Tool for tracking fitness activities and managing workouts.
---

# Exercise Management Tool (`sparky_manage_exercise`)

`sparky_manage_exercise` searches exercise definitions, records actual activity, manages saved workout presets and reads history. Its retained `sparky_` name is a compatibility identifier. A name-based log can create a missing exercise definition; prefer an existing ID to avoid unintended duplicates.

**Tool Name:** `sparky_manage_exercise`

It is available to full API keys at `/mcp`, or OAuth at `/mcp/chatgpt` with `mcp:write`. Read-only connections use dedicated query tools instead: mixed-action management tools are not published even for their read actions. Send a flat object with an explicit `action`, not nested action arguments. The source contracts are `XoTServer/ai/tools/schemas/exercise.ts` and `exerciseTools.ts`.

For a user workflow see [MCP-based training](/features/exercises/mcp-training). None of these actions starts a live phone/Watch session. Weekly-plan authoring and mobility use separate surfaces described below.

## Actions

The `sparky_manage_exercise` tool supports the following actions:

### `search_exercises`

- **Description:** Searches for existing exercise definitions.
- **Parameters:**
  - `searchTerm` (string): Name or part of exercise name.
  - `muscleGroup` (string, optional): Muscle group to filter by (e.g., "Chest", "Biceps").
  - `equipment` (string, optional): Equipment to filter by (e.g., "Dumbbell", "None").
  - `limit`, `offset` (integers, optional): Pagination; inspect the current published schema for bounds.

### `create_exercise`

- **Description:** Creates a new exercise definition.
- **Parameters:**
  - `name` (string): Full name for a new exercise.
  - `category` (string, optional): Category (e.g., "Strength", "Cardio").
  - `calories_per_hour` (number, optional): Estimated calories burned per hour.
  - `description` (string, optional): Description of the exercise.
  - `modality` (optional): `weight_reps`, `reps_only`, `duration` or `duration_distance`.

### `log_exercise`

- **Description:** Logs an exercise performed by the user, including sets and reps if applicable.
- **Parameters:**
  - `exercise_id` (string, optional): UUID of the exercise.
  - `exercise_name` (string, optional): Name of the exercise to log (alternative to ID).
  - `entry_date` (string, YYYY-MM-DD): The date the exercise was performed.
  - `entry_time` (string, optional): Account-local 24-hour entry time.
  - `duration_minutes` (number, optional): Duration of the exercise in minutes.
  - `calories_burned` (number, optional): Calories burned during the exercise.
  - `notes` (string, optional): Any additional notes for the exercise.
  - `distance` (number, optional): Activity distance in the account's distance unit; this differs from per-set distance in km.
  - `avg_heart_rate` (integer, optional): bpm.
  - `steps` (integer, optional): Recorded steps.
  - `sets` (array of objects, optional): Details for multiple sets (e.g., for strength training).
    - Set fields: `reps`, `weight` (kg), `duration` (seconds), `distance` (km), `rest_time` (seconds), `set_type` ("Working Set", "Warmup", "Drop Set", "Failure"), `rpe` (0–10), `notes`. Sets may also be supplied as a JSON string. Each weight-reduction segment is a separate drop-set row.

Only record values the user actually supplied or confirmed. Do not turn planned sets or an unknown energy value into a fabricated completed result. A logging timeout can occur after persistence; reread before resending to avoid duplicates.

### `list_exercise_diary`

- **Description:** Retrieves all logged exercise entries for a specific date, representing the user's exercise history.
- **Parameters:**
  - `entry_date` (string, YYYY-MM-DD): The date to retrieve the exercise diary for.

### `get_workout_presets`

- **Description:** Retrieves a list of available workout presets/routines.
- **Parameters:** None.

### `get_workout_preset`

- **Description:** Returns one preset in full: every exercise's ID, its sets, and its superset group. Call this before `update_workout_preset` so the replacement list includes every exercise that should remain.
- **Parameters:**
  - `preset_id` (number, optional): Numeric ID of the workout preset.
  - `preset_name` (string, optional): Name of a preset you own or that is family-shared. Public presets outside those scopes must use `preset_id`.

### `log_workout_preset`

- **Description:** Logs a predefined workout preset to the user's exercise diary.
  It does not start a live session or establish that every planned set was actually performed. Use only for a workout the user confirms they performed, and inspect the resulting diary.
- **Parameters:**
  - `preset_id` (number, optional): Numeric ID of the workout preset.
  - `preset_name` (string, optional): Name of a preset you own or that is family-shared. Public presets outside those scopes must use `preset_id`.
  - `entry_date` (string, YYYY-MM-DD): The date the preset was performed.

### `create_workout_preset`

- Required: `name`, `exercises` (array or JSON string of `{exercise_id, sets?, superset_group?}`).
- Optional: `description`, `is_public`.
- Planned preset sets use the set fields above except `rpe`. Matching positive `superset_group` values group exercises together; exercise IDs come from the library, not invented names.

### `update_exercise_entry`

- Required: `entry_id` (UUID).
- Optional: `entry_date`, `entry_time`, `duration_minutes`, `calories_burned`, `notes`, `distance`, `avg_heart_rate`, `steps`, `sets`.
- Only provided scalar fields change. Supplying `sets` replaces the complete set list; read the current diary entry first.

### `get_exercise_details` and `get_exercise_progress`

- Details accepts `exercise_id` or `exercise_name`.
- Progress accepts the same identity plus optional `start_date`, `end_date`, `limit`, `offset` in the management tool. Dedicated reviewed `sparky_get_exercise_progress` requires explicit range dates.

### `update_workout_preset`

- **Description:** Updates a preset. Only the provided fields change. `exercises`, when provided, replaces the entire exercise list. Requires `confirmed=true`; without it the tool returns a prompt and does not change anything.
- **Parameters:**
  - `preset_id` (number): Numeric ID of the workout preset to update.
  - `confirmed` (boolean): Must be `true` to apply the update.
  - `name` (string, optional): New name.
  - `description` (string, optional): New description.
  - `is_public` (boolean, optional): Whether the preset is shared publicly.
  - `exercises` (array or JSON string, optional): Replacement list of `{exercise_id, sets?, superset_group?}`.

### `delete_workout_preset`

- **Description:** Permanently deletes a workout preset. Requires `confirmed=true`; without it the tool returns a prompt and does not delete.
- **Parameters:**
  - `preset_id` (number): Numeric ID of the workout preset to delete.
  - `confirmed` (boolean): Must be `true` to delete.

### `delete_exercise_entry`

- **Description:** Deletes a specific exercise entry from the user's diary.
- **Parameters:**
  - `entry_id` (string): UUID of the exercise entry to delete.

## Weekly plan templates

Full-key `sparky_manage_workout_plans` accepts only `list_workout_plans`, `get_workout_plan` (`plan_id`) and `delete_workout_plan` (`plan_id`). Plan IDs are positive integers. It is not published on the reviewed OAuth/read-only surface; deletion is an immediate mutation, without a `confirmed` field in this contract.

The current formatter only renders preset/exercise names and set counts. Activity-first assignments can appear as “Unknown item” and lose planned duration/distance/time in this text view. Use the app or existing REST contract to inspect them. General plan create/update is an app operation, not an available MCP action. See [Weekly planning](/features/exercises/weekly-planning) and [API reference](/developer/api-reference#activity-first-weekly-workout-plans).

## Mobility

`xot_get_mobility` accepts optional account-local `from`/`to` dates (maximum 93 days) and returns revisioned routines, schedules, plans and sessions. Reads do not create plans.

`xot_update_mobility` uses `Mobility.api.zod.ts`: `{operationId, expectedRevision, mutation}`. New records use revision 0; existing records use their current snapshot revision. Mutation kinds are `routine`, `schedule`, `plan`, `session`, `result`; ingress/state validation limits what a non-phone caller may do. Manual completion uses a `result` for an existing plan, with confirmed outcomes only. It cannot override an active phone session.

Retain `operationId` for the same retry; reread/reconcile conflicts before issuing a changed operation with a new ID. Missing outcomes remain unknown. These records never generate exercise calories or Apple Health workouts.
