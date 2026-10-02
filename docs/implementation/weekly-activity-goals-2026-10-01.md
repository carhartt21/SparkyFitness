# Weekly activity plans and daily tasks

Branch: `feat/weekly-activity-goals-20261001`, based on `origin/main` at
`53c7092ef`. The pending coaching branch and existing dirty worktrees are retained.

## Outcome and scope

Connect existing weekly Workout Plans and dated Mobility plans to a single
account-local activity overview, explicit daily tasks and weekly completion
counts. Cover running, walking, cycling, strength, soccer, mobility and stretching.
Keep the existing plan editors, exercise logging and phone mobility runner as the
authoring/execution paths. Activity categories describe evidence, not training
quality or a health score. The overview does not generate a training prescription.

## Implementation plan

### 1. Contracts and completion rules

- Add shared strict Activity Planning response, occurrence and resolution schemas,
  exported from `@workspace/shared`; canonical dates stay `YYYY-MM-DD`.
- Each weekly assignment has a stable identity comprising template, assignment
  and local day. Mobility keeps its existing dated plan identity.
- Return planned, started, complete and excluded states, a machine-readable reason,
  source references, saved resolution revision and actual recorded evidence IDs.
- Expand the existing sport classifier to soccer, mobility and stretching, keeping
  uncertain classification separate from provider-declared sport.
- Add snapshot labels and expected set counts to future workout versions. Capture
  a current-day baseline for existing plans; never reconstruct earlier prescriptions.
- For workout completion, require confirmed sets covering the saved prescription,
  or an owner-selected recorded activity on the same day. Prefilled pending rows,
  elapsed timers and a similar activity name cannot imply completion. Partial sets
  remain started. Removed recordings invalidate their completion evidence.
- Mobility completion requires explicit completed step outcomes for the planned
  routine; partial or cancelled sessions remain incomplete. Skipped/cancelled plans
  are excluded. Reuse its existing revision-checked write operations.
- Weekly counts show scheduled, completed, started, pending, unknown and excluded occurrences
  by activity type. They do not imply full-account exercise-volume totals.

### 2. Persistence, permissions and concurrency

- Add one owner-only `activity_plan_resolutions` table for workout skip/link/undo,
  with revision-checked updates and one linked diary entry per occurrence. An entry
  cannot satisfy two occurrences; original plan-linked entries cannot be reassigned.
- Links must reference an owned, confirmed, same-day diary record; no writes to
  calories, duration, sets, provider provenance or HealthKit follow a link.
- Keep original assignments in immutable snapshots so plan/library edits and
  deletion preserve historical evidence. New reads perform no materialization.
- Serialize resolution changes per owner with an advisory transaction lock; check
  current occurrence/evidence and revision inside the transaction. An identical
  immediate retry returns the same revision; stale/conflicting requests return 409.
- Fix the workout-version owner foreign key to Better Auth's public `user` table,
  using an idempotent migration compatible with the pending coaching correction.
- Complete the migration checklist: timestamped SQL, owner RLS and grants, normal
  isolated server boot, shared table schema/export, security/sharing/table docs,
  server route/schema tests, web/mobile consumers and package validation. Leave
  `db_schema_backup.sql` to CI.

### 3. Server and MCP

- Add owner-only `/api/v2/activity-planning` GET for bounded calendar ranges and
  PUT for workout resolutions, with shared Zod validation and OpenAPI annotations.
- Keep repository queries, projection logic and HTTP handling separate. Bound
  reads to 42 calendar days and use repeatable-read snapshots.
- Add opt-in activity tasks to Daily Progress. Existing clients receive the v1
  projection unless they request `include_activity=true`; new clients use v2.
  Calendar reconstruction preserves existing unknown-history rules.
- Add dedicated pure-read MCP tools for activity planning and workout-plan detail;
  expose them to read-only keys and OAuth without granting mixed-action tools.
  Return JSON with dates, source IDs, reasons and the actual prescription.
- Add exercise minute/calorie targets to the goal snapshot. Keep existing goal
  fields and their canonical units. No agent writes/automatic plan activation.
- Make activity Daily Progress opt-in for the existing MCP status tools as well,
  preserving their default output and exposing the option in tool descriptions.

### 4. Web and mobile

- Extend the existing Workout Plans surface with a week navigator, per-activity
  counts and dated activity rows. Provide recorded-activity linking, skip and undo
  inline; surface conflicts, loading, empty and unavailable states explicitly.
- Include activity task labels/states in the existing Daily Progress components.
  Provide the same weekly overview and resolution controls on the phone's Daily
  Progress screen. Link to Diary for workouts and the existing Mobility destination
  for guided routines; an overview action never starts or records movement itself.
- Follow existing GlowCard, native controls, typography, theme and spacing. Preserve
  saved Dashboard layouts. Narrow widths wrap names/actions without overflow.
- Ship English and reviewed German copy, locale-aware dates/numbers, accessible
  controls and reliable retry/disabled states. Inspect both themes and German text
  expansion at desktop/phone sizes; record physical-device limits accurately.
- Put queries under the existing Daily Progress cache family and invalidate it
  after exercise/preset/plan/mobility changes in both clients. Keep account keys
  separate and exclude delegated contexts from this owner-only overview.

### 5. Verification and delivery

- Projection tests: recurrence, timezone/date boundaries, rest days, multiple slots,
  partial/full sets, pending prefills, legacy snapshots, changed/deleted plans,
  mobility outcomes, weekly counts and all requested activity types.
- Resolution tests: owner isolation, same-day/confirmed-record checks, exclusive
  links, skip/undo, stale revisions, identical retries and removed evidence.
- Route/MCP tests: range validation, delegated denial, read-only exposure, stable
  legacy Daily Progress and goal-unit fields. Run real isolated PostgreSQL tests,
  migration boot/restart and RLS checks; use synthetic data only.
- Web/mobile tests: week navigation, state/action controls, errors/conflicts,
  activity tasks and cache invalidation. Run package `validate`, full suites,
  web production build, documentation build and German overlay check.
- Capture a bounded visual matrix and obtain the required independent finish
  review. Fix material findings and record verified and unverified surfaces.
- Update root/package guides and user/developer docs. Commit only scoped source,
  tests and documentation, push the branch, and open a PR using the complete
  repository template. Do not deploy or merge as part of this request.

## Plan review and adjustments

Reviewed against `agent-docs/plan-review-checklist.md` before implementation.

1. **Avoid parallel planners:** use existing Workout/Mobility definitions and immutable
   versions, adding only explicit workout resolutions. No second routine library.
2. **Do not infer attendance from scheduled data:** completion is confirmed-set or
   owner-selected actual-record evidence; same-name provider imports are not matched
   automatically. Partial completion remains visible.
3. **Preserve installed clients:** new task domains require explicit opt-in. Legacy
   REST and MCP progress continue using their existing v1 shape by default.
4. **Historical truth:** baseline new snapshot metadata on migration day; missing
   prescription coverage cannot become a guessed complete workout. Sequential plans
   have no dated recurrence and are listed separately, outside weekly denominators.
5. **Keep proposal review separate:** this branch can be consumed by pending coaching
   but does not import its unreleased proposal machinery or activate agent writes.
6. **No calorie side effects:** linking, skipping and mobility completion resolve
   planning tasks only; existing logged metrics and nutritional targets stay intact.
7. **One evidence record, one task:** enforce link uniqueness and reject reassignment
   of original plan-linked activity to prevent completion inflation.

## Execution record

Completed on 2026-10-01 in an isolated worktree. Production and the unrelated
coaching/Watch worktrees were not changed. The new branch contains the contract,
migration, owner API, pure MCP readers, web/mobile overview and reviewed German
copy described above. Existing progress clients retain v1 unless they opt in.

### Review findings and final adjustments

The independent finish review identified five material source-level issues. The
implementation now addresses them:

1. Library deletion clears live exercise IDs. Completion retains confirmed diary
   snapshots using their saved exercise name only when the live ID is null.
2. Same-day plan edits can retain assignment IDs or replace them. The first
   confirmed set or owner decision pins the prescription captured before that
   instant; later changes cannot rewrite it. Replacement matching consumes only
   one matching activity and leaves unrelated weekday insertions visible.
3. Mobile account changes can race a request. Scoped requests capture destination,
   authentication and account identity, reject mismatches before dispatch and after
   response decoding, and keep caches keyed by server and user.
4. Old versions can lack prescription detail. They remain explicitly unknown and
   stay outside completion denominators and applicable Daily Progress tasks.
5. Missing recorded evidence and unknown prescriptions need an explanation. Both
   clients now show localized recovery hints alongside their state and actions.

Regression tests cover the final same-ID edit, replacement, deletion and account
switch cases. The finish reviewer confirmed the other source fixes; its visual
disposition remains **recapture** because no authenticated render was available.
The required documenter added the bounded component pattern to `DESIGN.md` without
changing the established visual system or adding raster assets.

### Validation results

| Gate | Result |
| --- | --- |
| Server `pnpm run validate` | Passed: TypeScript, ESLint and Prettier |
| Server `pnpm run test:ci` | 441 suites / 5,242 tests passed; 11 optional suites / 373 tests skipped |
| Isolated PostgreSQL integration | 3 tests passed: pure reads, concurrent resolutions/retries/undo/deleted evidence, owner/delegated RLS isolation |
| Fresh server startup and migration restart | Passed; migration applied and RLS reapplied; `pnpm run test:migrations` passed |
| Web production build | Passed, including the package validation gate |
| Web `pnpm run test:ci` | 164 suites / 1,437 tests passed |
| Mobile `pnpm run validate` | Passed, including locale generation/audit and native source checks |
| Mobile full Jest suite | 516 suites / 7,449 tests passed with `--watchman=false --runInBand --coverage` |
| Repository layout and German override check | Passed |
| Documentation build | Passed |

The database checks used only a generated local PostgreSQL instance and synthetic
accounts. No production health data or credentials were copied into fixtures.
All eight migration checklist steps are complete: SQL, owner RLS, normal startup,
CI-owned schema backup left untouched, exported shared schemas, permission/table
docs, downstream contracts and consuming-package validation.

### Deferred verification and delivery

The browser tool rejected `http://localhost:8080` with a saved permission block
despite the visible Always allow setting. Its explicit rejection prohibits using
an alternate browser or workaround. On 2026-10-01 the user directed that browser
checks be skipped and the blocker recorded in Todoist. The follow-up is
**Resolve X on Track browser verification permission blocker**.

Authenticated light/dark, desktop/narrow and German text-expansion captures are
unverified. No physical-device or emulator verification was performed. The PR
remains a draft with these template gates unchecked; automated component tests
and a production build do not replace those checks. No deployment or merge is
included in this delivery.
