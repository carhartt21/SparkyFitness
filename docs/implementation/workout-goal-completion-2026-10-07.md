# Workout goal recognition and partial progress

Implemented on `fix/workout-goal-completion-20261007`, based on `848d18273`.
That base includes the separate intake-gauge spacing and scheduled-routine start
follow-ups. This batch is not merged or deployed.

**Release update:** included in the merged v47 source. See the
[v47 release record](v47-release-2026-10-07.md) for production, signed artifact
and upload verification; the sections below describe the original feature batch.

## Diagnosis

A bounded, owner-scoped production inspection for the reported day ran in a
read-only database transaction. The saved strength assignment requires **45
minutes**. Its two recorded lifting sessions contain **0.6 minutes** and **35.3
minutes** respectively, with confirmed sets and compatible strength categories.
Neither session carries an explicit plan assignment.

Remaining incomplete is correct against that saved target. The defect was the
automatic matcher: multiple compatible sessions below the target were treated
as ambiguous and left **Not recorded**, hiding the actual progress. This was
not a missing Diary write, a strength-category mismatch or a stale save cache.
The inspection changed no production records; private identifiers and raw
health data are not included here.

## Correction

- Several compatible shorter sessions now establish **Started / Begonnen**.
  Progress uses the best single session against all saved duration/distance
  targets. Rows within one session can be combined; separate sessions cannot.
- A single compatible session that meets every target still completes the goal
  automatically. Several qualifying sessions retain an explicit owner choice,
  with an explanation to use **Link activity**.
- Partial evidence does not reserve a session that can complete another goal.
  One session can complete only one automatic goal, and explicit assignment,
  link, skip and undo decisions keep their precedence.
- The optional shared `target_progress` response field reports known recorded
  duration/distance and their immutable saved targets. Older responses without
  it remain valid. Unknown values remain null rather than becoming zero.
- Phone Daily Progress and the weekly activity list show the comparison below
  the state, for example **35,3 von 45 min**. The Diary planned-row disclosure
  shows the same comparison above Details. Missing required metrics and
  ambiguous qualifying sessions have reviewed German explanations.

The existing card layout, wrapping secondary typography and shared buttons are
retained. No migration, goal-target edit, calorie credit, Diary mutation or Health
export was introduced. Coaching continues to use the same completion projection;
partial attendance does not become a completed workout outcome.

For the reported workout, the resulting state is Started rather than Complete.
If the owner intends a shorter saved session to fulfil that plan, the existing
explicit Link activity action records that decision without rewriting its
duration or calories.

## Verification

Server, phone and web `pnpm run validate` passed. The final focused tests passed:

| Package | Suites | Tests | Coverage                                                                         |
| ------- | -----: | ----: | -------------------------------------------------------------------------------- |
| Server  |      8 |   132 | Projection, service/routes/tools, Daily Progress, grouped workouts and coaching  |
| Phone   |      5 |    39 | Target copy, weekly UI, Diary scheduling, autosave invalidation and API identity |
| Web     |      2 |     6 | Shared-response compatibility in weekly activity and Daily Progress components   |

The regression reproduces a separate 0.6-minute attempt and a 35.3-minute lifting
session against a 45-minute target. It verifies Started, evidence from the
longer session, deterministic selection regardless of input order, input
immutability and automatic completion once one session meets the target.
Additional cases cover multiple complete candidates, assigned evidence, partial
record reservation, missing metrics and older response shapes.

Native `testWorkoutGoalProgress` passed in German 390-point dark/light and
430-point enlarged text. It opens Daily Progress, asserts an accessible
**Krafttraining: Begonnen** row and verifies the localized comparison fits
horizontally. The captures show the **weekly activity subsection** on that
screen, not the top Activity card. Visual inspection found no new comparison
text overlap. Initial native attempts used the wrong Home control identifier
and then queried a row state as standalone text; correcting those test selectors
resolved both failures without product changes.

[Dark comparison](evidence/workout-goal-completion-2026-10-07/390-de-dark-weekly-progress.png),
[light comparison](evidence/workout-goal-completion-2026-10-07/390-de-light-weekly-progress.png),
[enlarged comparison](evidence/workout-goal-completion-2026-10-07/430-de-large-weekly-progress.png)
and [verification receipt](evidence/workout-goal-completion-2026-10-07/results.json)
use isolated synthetic fixtures and current JavaScript in an existing iOS Debug
simulator binary. The receipt records the base revision plus hashes of tested
source files, because the final native run preceded this commit.

The documentation build, German overlay check, design detector and
`git diff --check` passed. The full backend suite was not run. Native fixtures
test rendering and navigation, not real server persistence; real matching is
covered by the focused server tests and the read-only diagnosis above.
Physical-phone, Android, paired Watch, signed archive, TestFlight and
Health/Fitness export checks were not performed. No production deployment was
started.
