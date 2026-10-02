# Exercise library and saved workouts

The exercise library holds reusable definitions; the diary holds records of what you performed. A workout preset stores a sequence of exercises and planned sets. A weekly plan assigns whole activities, presets or advanced exercises to days. These objects have different purposes.

Use the existing library manager to inspect/edit definitions and saved presets. Choose an exercise modality that matches its data: weight/reps, reps only, duration or duration/distance. Preserve exercise IDs when updating a preset so historical snapshots and references remain identifiable.

Deleting a definition normally preserves saved diary history as snapshots while removing its library/template references. A separately offered **delete with history** action is destructive and removes logs; read the confirmation carefully. Deleting a weekly plan does not delete completed workout history.

For assistant preset edits, fetch the full preset before replacing its exercise list. Supplying a replacement list through MCP removes anything omitted; see [Exercise tool contracts](/developer/mcp/exercise).

Use [Weekly planning](/features/exercises/weekly-planning) for whole-session schedules and [Interval/WOD workouts](/features/exercises/interval-wod-workouts) for existing format-specific tracking.
