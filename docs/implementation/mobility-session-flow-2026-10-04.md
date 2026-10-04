# Mobility session flow — 2026-10-04

Branch: `feat/mobility-session-flow-20261004`, based on `c83f87f57`.
Implementation and local validation only; this record does not establish a published
build or physical Apple Health/Fitness acceptance.

## Result and use

Open **More → Guided mobility / Mehr → Geführte Mobilität**. Timed steps marked
**Both sides / Beide Seiten** have a halfway cue and an end cue. Choose **Sound**
or **Both** for audio. New routines default to sound plus haptics; existing explicit
Off/Haptic settings remain respected. The halfway chime is distinct from the end
chime, and the runner indicates the second half. Simultaneous whole-body movements
can ignore the side-switch suggestion: the existing `side: both` field does not
encode whether a sequential side switch is required.

Confirm or skip a step to start the next exercise’s setup countdown. It lasts at
least five seconds, or the longer configured transition. The next timer starts
when this countdown ends while the runner is visible and foregrounded. **Start
now / Jetzt starten** bypasses the rest of setup time. Pause holds the countdown;
resume continues it. Countdown expiry never records exercise completion. The
runner uses the existing keep-screen-awake preference while focused and running.

Terminal sessions containing explicitly confirmed movement appear in phone and
web diaries on the account-local day they started. Skipped/unrecorded steps remain
separate. Running, paused and all-skipped sessions are not represented as completed
workouts. A diary row opens the existing mobility history screen. Recent phone
history is immediately available offline; the existing day-scoped API adds older
synced sessions. This is a display projection, not a second exercise log or calorie
credit in X on Track.

On iPhone, enable workout recording under **Sync**, including workout and active
energy write permissions. Finishing a recorded session offers an editable calorie
confirmation. A later **Export to Apple Health** action is available in expanded
session history. Skip preserves the diary session and leaves export available for
later. Android has no new Health Connect export.

## Calorie estimate and limits

The owner explicitly selected **Confirm an estimate**. When a recorded weight is
available on or before the session’s account-local start day, confirmed timed
steps can offer a light-stretching estimate. The prompt identifies the weight,
time basis, assumption and that the value is not measured. Nothing is exported
until the owner confirms a positive value. It can be edited or skipped.

The baseline is **2.3 MET for mild stretching**, code 02101 in the
[2024 Adult Compendium of Physical Activities](https://pacompendium.com/wp-content/uploads/2024/03/1_2024-adult-compendium_1_2024.pdf).
We subtract 1 MET resting energy and use the conventional
[3.5 ml/kg/min MET basis](https://pacompendium.com/corrected-mets/):
`active kcal = (2.3 - 1) × 3.5 × weight kg ÷ 200 × estimated timed minutes`.
This is an approximation for light mobility, not sensor telemetry or an
individualized physiological model.

Time is bounded by each confirmed timed step’s prescribed duration and the
available interval between outcomes, subtracting the preceding setup duration.
Skipped steps, transitions and repetition-only steps add no estimate. Long pauses
cannot increase the estimate beyond prescribed timed work, but historical session
snapshots do not contain per-step pause telemetry. Early finishes, restarts or
manually bypassed transitions can make this conservative time approximation less
precise. Review the suggestion before confirming it. There is no guessed weight
or repetition cadence. Missing weight, no usable timed work or a value rounded to
zero leaves the existing known-calorie/skip path available. A bounded five-second,
account-scoped measurement lookup reuses the existing query cache; offline failure
can reuse an existing scoped weight suggestion or omit it.

Apple Health export uses the **elapsed session span**, including pauses and
transitions, because the current native export API does not provide a separate
active-duration override. It is not labelled measured active time. Confirmed
estimated energy is marked user-entered with `XOnTrackEnergySource:
confirmed-estimate`; known entries use `known`. X on Track does not infer Watch
recording for these sessions.

## Implementation boundaries

- `mobilityCueAt` detects threshold crossings once, retains position through
  pause/resume, rearms after a restart and avoids replaying missed cues on remount.
  Halfway and end signals reuse bundled audio. Enabled mobility audio plays in
  silent mode and mixes with music. Cues require the foreground visible screen;
  background audio is not implemented.
- The existing local runner/store persists transitions and outcomes. The guarded
  `continue-if-ready` action cannot reset an already-started next timer. No second
  outbox, timer scheduler, schema migration or native target was created.
- Shared `isRecordedMobilitySession` / `recordedMobilitySessionsOn` keep phone/web
  diary rules consistent. Account/time-zone keys, generation guards, revision
  precedence and pending explicit deletions prevent stale-account or deleted rows.
- `exportMobilityToHealth` saves nothing itself. It reuses the existing workout
  consent, durable account-scoped export ledger, pending retry, HealthKit sync
  identifier and query-before-save path, using `mobility:<session UUID>` and the
  flexibility activity type. Account checks cover the confirmation and HealthKit
  query/permission windows. Strength/Watch writer ownership stays intact.
- Own writeback metadata remains excluded from Health imports. Instant MCP/manual
  plan results never automatically create a Health workout. Skipping or export
  failure does not undo saved movement. Routines and old zero-transition records
  are not migrated; the five-second minimum is interpreted at runtime.
- English source copy and reviewed German overrides cover all additions. Existing
  storage keys, bundle IDs, entitlements and historical snapshots are unchanged.

## Validation

- Mobile focused cue/store/runner/diary/Health/strength regression tests passed.
  The calorie confirmation tests cover editable estimates, explicit confirmation,
  skip, missing weight and changed accounts; calculation tests separate active
  from resting energy and omit unperformed/repetition work.
- Full mobile suite: **557 suites / 7,801 tests passed**. Final runner suite after adding save-error recovery: **3 tests passed**
  (halfway/automatic transition, paused/disabled cues, visible failure/explicit retry).
- Full web suite: **175 suites / 1,498 tests passed**.
- Mobile, web and server `pnpm run validate` passed. Mobile includes the strict
  English-fallback/German-key audits, lint, typecheck, native locales, Watch mark,
  widget assets, Knip and formatting.
- Server focused mobility routes and shared diary projection: six tests passed.
  The complete backend test suite was not run; no server behavior changed.
- Docs `pnpm run build` passed (existing chunk-size warning).
- Normal production iOS Metro/Hermes export passed. No release archive, physical
  installation, TestFlight upload or deployment was performed.
- Isolated German simulator flow passed at 390×844 in dark/light and 430×932 with
  accessibility text: resume, halfway state, confirm, transition, automatic next
  timer, finish, saved history and diary navigation. An existing development app
  was used with the current JS review bundle and an XCTest harness. This was not
  a rebuild of all native app targets. Fixture data is synthetic and in-memory;
  Apple Health export is disabled in this fixture.

Screenshots: [halfway](evidence/mobility-session-flow-2026-10-04/390-de-dark-mobility-halfway.png),
[transition](evidence/mobility-session-flow-2026-10-04/390-de-light-mobility-transition.png),
[diary](evidence/mobility-session-flow-2026-10-04/390-de-dark-mobility-diary.png),
[large-text transition](evidence/mobility-session-flow-2026-10-04/430-de-large-mobility-transition.png).
The [final dark-mode diary confirmation](evidence/mobility-session-flow-2026-10-04/390-de-dark-mobility-diary-final.png)
uses the fixed review date and updated spacing/time-zone display. A previous
confirmation crossed midnight: the shared diary store advanced today, while the
fixture session correctly remained on its start day. The review fixture is now
fixed-date to avoid that test-clock dependency. No production date behavior was
changed for this fixture correction.
A bounded design scan found no flagged new surface patterns.

## Before release

Run the updated [physical-device checklist](physical-device-tests.md): audible
halfway/end cues with music and silent mode, Off/Haptic choice, pause/relaunch,
VoiceOver, actual permission denial/retry, editable estimate confirmation and a
single positive-energy flexibility workout in Apple Health/Fitness. Check paired
Watch behavior and that Health re-import does not duplicate a diary session.
Foreground-only cues and elapsed-span Health duration are deliberate limits.
