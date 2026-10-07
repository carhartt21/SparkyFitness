# Deferred task completion — 7 October 2026

Branch: `feat/deferred-task-completion-20261007`, based on the reviewed phone
refinement at `ce4e8f4e4`. The scope is X on Track's earlier conversation tasks,
current Inbox and X on Track section, plus its linked weekly-activity acceptance
task. Unrelated projects and speculative upstream roadmap items are excluded.

## Reconciled implementation tasks

| Earlier task                               | Current evidence and disposition                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Daily Progress action buttons              | `ProgressItemAction` and `useProgressActions` route boolean/count habits, meal state cycling and domain-specific actions; future days remain guarded. Completed in Todoist.                                                                                                                            |
| Dedicated daily Meals screen               | `DailyMealsScreen` uses actual entries, existing bulk operations, templates and logging. Completed in Todoist.                                                                                                                                                                                         |
| Unified hydration screens                  | `WaterLogScreen` and inline `HydrationHistory` show the shared source ledger and existing logging flows. Completed in Todoist.                                                                                                                                                                         |
| Diary polish                               | Recorded clocks, meal icon, shared action material and the latest Meals/Training layout are implemented. Completed in Todoist.                                                                                                                                                                         |
| Intake card layout                         | Superseded by the owner's latest explicit compact gauge plus macro/water rails, not the older stacked-card suggestion. Completed in Todoist.                                                                                                                                                           |
| Hevy import parent and functionality child | Read-only checks confirm the owner's CSV workouts, nonempty children and authenticated historical diary visibility. Original workout dates explain absence on the import day. No reimport or record change. Both tasks and the later import investigation completed in Todoist.                        |
| BLS artwork                                | Released mapping covers all 7,140 BLS codes using representative artwork and deliberate neutral fallbacks. Production export hashes were checked in v45 evidence. Completed in Todoist.                                                                                                                |
| Weekly/monthly recaps                      | Protocol-2 calendar reviews and recaps exist; the owner reported a successful monthly run. Unattended platform write rejection remains its separate operational gate. Completed in Todoist.                                                                                                            |
| Supplements in the medication system       | Explicit owner classification, separate copy/forms, retained intake snapshots and existing schedule tools are implemented. The new [guide](../src/features/supplements.md) documents optional assistant timing review, evidence limits, approved writes and duplicate avoidance. Completed in Todoist. |

Eleven Todoist implementation tasks are reconciled. Completion here is scoped
to their implementation or read-only investigation, not device or unattended
coaching acceptance. The Inbox is empty at the end of the initial audit.

## Completed deferred Watch change

The `ContentView` body now pages through **Daily Goals → Nutrition → Water →
Food quick logging → Workout → Entry → Trend**. Stable enum/tag identities,
active-workout initial selection, complication destinations and entry-to-trend
navigation remain unchanged. No session command or synchronization code changed.

The independent Impeccable finish reviewer returned **ship** for this narrow
source-level navigation refinement. Existing screen typography/material remains
the visual authority. Compilation, synthetic assertions and four 42mm German
captures verify incumbent rendering; they do not verify actual swiping or pairing.
The [Watch evidence](evidence/deferred-tasks-2026-10-07/results.json) includes all
four captures. Its source hash is the combined Watch Swift inputs plus the
isolated harness and matches the current compilation inputs; it is not the
hash of `ContentView.swift` alone. CUA could not obtain
a Simulator window (`cgWindowNotFound`); this was not a permission rejection.

## Mobility assistant correction

The shared argument normalizer removed every `null` for non-coaching tools.
Mobility schemas use meaningful nullable fields, including schedule `endDay`
and plan `scheduleId`/`activeSessionId`; removing them can turn a valid mutation
into a validation failure. In-app chat also duplicated the blanket cleanup.

`xot_update_mobility` now retains these fields. Chat delegates to the same
name-aware normalizer; legacy placeholder behavior remains compatible. Tool
guidance names UUIDs, routine timestamps and an unlinked step's `exerciseId:null`.
Known service conflicts/not-found/validation failures return stable `Error
[CODE]` results with corrective suggestions; unexpected failures still use the
adapter's sanitized failure/logging path. The schema, owner-only service,
operation receipts and active-phone-session guard remain authoritative.

The isolated persistence check executes a valid five-minute assistant routine
twice with the same operation ID and proves one stored row, revision 1 and the
expected step data. Unit regressions cover null preservation through both tool
surfaces, actionable domain errors and no false success on unexpected errors.

The original October screenshot does not include invocation arguments. No
retained log establishes that its three failed calls had this exact cause.
Its Todoist task therefore stays open for a fresh assistant/device reproduction
once this correction is in the tested release. No live routine was created.

## Review harness maintenance

The phone OCR smoke check expected the removed “1,400 remaining” value and
contiguous “600 kcal”. The current gauge separates intake, “of”, target and unit
onto distinct lines. The check now requires both actual fixture numbers (600
and 2,000) and the calorie heading/unit. It does not weaken the interaction gate.
The launch-action test also used the superseded mixed-German activity label;
it now matches the current reviewed German label.

The passing launch captures also exposed **ten “Neintes” labels** on phone
meal, workout, activity, food and cycle forms/details. They are corrected to
“Notizen” through `localization-overrides/de/mobile.json` and the normal generated
catalog pipeline. The copy audit now rejects that known malformed label, which
ordinary English-fragment detection missed. No provider or user-entered name is
translated. A narrow native activity-form capture checks the visible corrected
label without logging an activity.

## Checks and limits

- Server: 12 focused suites, **169 tests passed**; validate wrapper passed.
- Isolated PostgreSQL: **19 notification/mobility persistence and RLS tests
  passed**, including the assistant retry boundary. The opt-in test accepts the
  explicitly configured visual-sample port while retaining loopback host and
  disposable database-name guards. Only synthetic test users were written and
  removed; no production write or migration ran.
- Phone: **9 focused suites, 45 tests passed**; a separate localization/Watch-copy
  run passed **8 suites, 123 tests**. `watchLocales` overlaps between those runs,
  so these are separate receipts rather than a deduplicated total. The validate
  wrapper passed after the German catalog correction.
- German overlay/copy-audit scripts: **11 tests passed**.
- Watch: native compilation, **19 synthetic assertions**, four German captures.
- Documentation: VitePress build passed.
- Native launch-icon rerun: **passed** on the dedicated 390-point German dark
  iOS 26.2 simulator. Actual SpringBoard actions opened scanning, food entry
  (cold launch), activity entry and measurements. Five named captures and
  [results](evidence/deferred-tasks-2026-10-07/launch-results.json) record the
  isolated destinations. The earlier run failed on the superseded German test
  label; the corrected rerun passed. Development-client and simulator idle/AX
  warnings were present, not hidden. Authentication/permission/reconnect gates
  on a physical phone remain unverified.
- Native Notes-copy check: **passed** on the same German dark simulator. The
  [corrected capture](evidence/deferred-tasks-2026-10-07/activity-notes-de-corrected.png)
  shows “Notizen”; [results](evidence/deferred-tasks-2026-10-07/notes-results.json)
  record the isolated run. Initial harness failures were an obsolete submenu
  selector and querying grouped form labels as individual accessibility children.
  The final test uses actual form navigation plus native OCR of visible copy,
  asserting “Notizen” and excluding “Neintes”. No activity was saved. The older
  launch-action activity capture predates this copy correction.

Full backend tests were not run, per the existing instruction. No signed release
archive, upload, deployment, physical iPhone/Watch, Android, Health/Fitness export,
notification receipt or hardware offline/reconnect acceptance was performed.
The paired iPhone is currently unavailable to `devicectl`; pairing alone is
not a physical-device verification result.

Local branch audit confirms the old v40-only commits are patch-equivalent to
main. The older weekly-activity branch's current implementation is present in
the integrated activity/coaching paths; its outstanding Todoist task is the
acceptance matrix, not an instruction to merge that stale branch again. The
latest phone refinement plus this completion branch remain separate from main.
GitHub CLI is not authenticated here, so no new live PR-state assertion is made.

Three Todoist acceptance tasks remain open with current descriptions: physical
iPhone release acceptance, the fresh mobility assistant reproduction, and the
authenticated web/native activity/coaching matrix. Browser access works, but the
isolated local demo asks for agreement to license/evaluation terms. The browser
tool requires action-time confirmation; that answer is pending. Do not bypass
the notice or mark this matrix complete on the basis of unit tests.
