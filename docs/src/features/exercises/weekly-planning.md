# Weekly training plans

A training plan schedules whole activities or saved workouts. It does not record that you completed them. You can put a 10 km run and a 45-minute strength session on Monday, soccer on Tuesday, and a rest day on Wednesday. These are examples, not default targets.

## Create and activate a plan

On mobile, open the Library's **Weekly training plan** entry. Exercise Review and Daily Progress also link to planned sessions. On web, open **Exercises → Workout Plans**.

1. Create a plan and give it a name and start date. An end date is optional.
2. Choose a weekday and add a session. Choose **one** activity type or saved workout preset per assignment. Add another session when you want both on the same day.
3. For an activity, optionally enter its name, duration in minutes, distance in km and time in 24-hour format (`HH:mm`). The available types are running, strength, cycling, walking, hiking, swimming, rowing, soccer, yoga, other and rest.
4. Mark a session optional if it should not be required for that day's Daily Progress. Rest has no duration or distance target.
5. Save and activate the plan. Check the selected day falls within its start/end dates and matches the assigned weekday.

The mobile editor focuses on activities and presets. Web retains the advanced exercise/set editor and sequential plans. Sequential plans advance through sessions rather than assigning each one to a weekday; edit those in the web UI.

## Record what actually happened

An activity's **Log activity** action opens the existing activity-entry form, with the planned duration and distance as suggestions. Adjust these to what you actually did, then save. Preparing this form does not itself add a diary entry or calories.

A preset's **Start workout** action opens a live workout with its planned sets. Complete sets as you perform them and finish the session once. Planned sets are not completed sets. Phone/Watch tracking uses the existing live-workout flow; [MCP logging](/features/exercises/mcp-training) does not start that flow.

Daily Progress uses saved activity records or completed workout sets linked to the assignment. Opening a session, activating a plan or passing its scheduled time is not completion. Optional sessions and rest do not become required tasks.

## Prompt and prefill modes

Activity plans use **prompt** mode: they offer a planned action instead of writing completed exercise entries. Older preset/exercise plans can retain **prefill** mode in the web editor. Prefilled entries are not evidence that you trained; do not use them as a substitute for a live session or an actual activity log.

Editing or deleting the plan does not delete previously logged workouts. Historical diary records remain separate from the plan template.

## If something is missing

| Symptom                                      | Check                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| No session for the selected day              | Active state, weekday, start/end dates and selected date. Several active plans may apply.                                      |
| Cannot save or start                         | Server connection and validation message. Mobile plan editing/start requires a connection.                                     |
| Legacy plan cannot be edited fully on mobile | Use the web advanced editor; mobile preserves existing sequential/advanced assignments.                                        |
| Assistant says an activity is “Unknown item” | The current MCP workout-plan formatter only describes legacy preset/exercise assignments. Inspect activity details in the app. |

For assistant-assisted planning, see [MCP-based training](/features/exercises/mcp-training). A planned time is not automatically a training push notification; see [Notifications](/features/settings/notifications) for the reminder kinds currently supported.
