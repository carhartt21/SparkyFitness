# Start a routine from a scheduled workout

Implemented on `feat/scheduled-workout-routine-start-20261007`, based on
`787557609` (the separate intake-gauge optical correction). Neither follow-up is
merged to main or released by this batch.

## Behavior

Every due, non-rest assignment in the phone's weekly Training screen now has a
full-width primary **Routine starten / Start routine** action with the existing
play icon and shared translucent button material. Activity-type assignments
retain **Aktivität erfassen / Log activity** below as an outline action. Both
actions remain contained and separated at ordinary and enlarged text sizes.
They are disabled offline and while a request is pending; a synchronous lock
prevents duplicate starts, and only the action being processed shows a spinner.

Preset and individual-exercise plans reuse their direct live-start flow. An
activity-only assignment opens the existing routine picker with a translated
planned-session label. `WorkoutPlanRoutineTarget` carries the assignment ID and
session name through preset selection, preview and first-exercise selection for
an empty workout. `useStartLiveWorkout` applies that context once when creating
the session. The server already maps the assignment ID to its child entries.
Selecting a routine does not replace the plan's activity type or saved preset.

The existing active-workout conflict prompt, single-flight creation, current-time
recording, source preset, format/timer settings, cache invalidation and phone–Watch
store flow remain in use. Planned sets are created uncompleted. Start is not
completion or calorie credit. The planned-context preview offers live start;
past logging remains the separate activity action on the plan. Ordinary library
previews keep their existing past-logging action.

English source keys and reviewed German overlay values cover both new strings.
No API, database, scheduler, Health export or native asset contract changed.

## Verification

- Mobile `pnpm run validate` passed, including German overlay/copy, TypeScript,
  lint, i18n, shared button theme, native assets and formatting checks.
- Five focused Jest suites passed, 59 tests: `WorkoutPlansScreen`,
  `PresetSearchScreen`, `WorkoutPresetDetailScreen`, `useStartLiveWorkout`, and
  `useStartWorkoutPlanAssignment`. They cover separate action routing, offline
  and pending guards, retained plan context through selection/preview, linked
  session creation, uncompleted sets and the existing conflict/start behavior.
- Native `testScheduledRoutineSelection` passed in German 390-point dark/light
  and 430-point enlarged text. It checks 44-point touch targets, contained widths,
  vertical separation and the actual plan → routine picker navigation. The first
  native attempt reached the picker but queried its existing TouchableOpacity
  row as a button; the corrected descendant selector passed in all three cases.
- Visual inspection found no new text/button overlap in those captures.
- Documentation build and `git diff --check` passed.

[Dark actions](evidence/scheduled-workout-routine-start-2026-10-07/390-de-dark-actions.png),
[light actions](evidence/scheduled-workout-routine-start-2026-10-07/390-de-light-actions.png),
[enlarged actions](evidence/scheduled-workout-routine-start-2026-10-07/430-de-large-actions.png),
[picker](evidence/scheduled-workout-routine-start-2026-10-07/390-de-dark-picker.png)
and [results](evidence/scheduled-workout-routine-start-2026-10-07/results.json)
use isolated synthetic fixtures and current JavaScript in an existing iOS Debug
simulator binary. Native fixtures contain no saved presets; actual preset start
payloads and the API boundary are verified by Jest rather than native persistence.
Physical-device, Android, signed archive, TestFlight, Health/Fitness export and
paired Watch checks were not performed. No production deployment was started.
