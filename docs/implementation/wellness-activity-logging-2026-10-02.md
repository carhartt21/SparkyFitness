# Wellness activity logging

## Behavior and surface decisions

The Diary records an activity and calendar day in both web and mobile. Sauna,
massage and meditation are one-tap presets; custom names remain literal. There
are no session times, durations, temperatures, calorie estimates or recovery scores.

This is an Operate extension of the existing Diary. Web places the existing
`Card` after the widget grid; mobile places `GlowCard` after the daily summary.
The card uses incumbent controls, theme roles and spacing. Navigation, saved
widget layouts and the approved X on Track identity remain in place; this
surface does not establish a new visual system.

Logged activities lead the card, followed by presets, a labelled custom-name
input and the collapsed “History · last 30 days” disclosure. The selected Diary
day determines both logging and undo. A recorded preset is visibly marked and
disabled for that day. Custom names accept 1–50 characters after trimming, stay
in the input after a failed save and clear after success. Loading, unavailable,
retry, empty-history and mutation-failure states have English source copy and
reviewed German overlays. Web readers without write permission can view entries
and history without mutation controls.

Activity names and controls wrap rather than truncate or cap text scaling. At
enlarged text, Undo can move below the name. The native name retains a readable
minimum width and Undo has a minimum 44-by-44-point target.

## Implementation plan (completed)

1. Extend completion-habit storage with an explicit wellness category, outside
   scheduled tasks, Daily Progress and reminders.
2. Add activity-and-day logging to both Diary surfaces with presets, custom names,
   day-specific undo and recent history.
3. Reuse check-in permissions and the habit API, shared behavior and account-scoped
   cache invalidation; keep wellness separate from measurement editors.
4. Add English source copy and reviewed German overlays, shared contracts,
   sharing/security documentation and package guidance.
5. Apply the migration in a disposable PostgreSQL stack, verify persistence and
   RLS, validate affected packages, and review German screens in both themes and
   at enlarged text sizes.

## Data contract

`custom_categories.habit_category` defaults existing records to `habit`.
`wellness` definitions are completion records with an empty weekday schedule and
no reminder. `custom_measurements` retains the activity's dated completion value.
The public habit API has an optional `category` field for compatibility with old
clients and fixtures. Creation defaults to an ordinary habit when omitted.
The category and habit type stay fixed after creation.

Wellness creation reuses a name within the account under a transaction lock,
including retry after a lost response. Dated logging uses a separate per-activity,
per-day lock so simultaneous web/mobile saves do not leave duplicate daily rows.
Undo deletes only the requested date's log; definitions and other history remain.

Both clients read 30 calendar days ending on the Diary's selected day. Earlier
history remains stored and can be viewed by changing that day. Missing records do
not imply that an activity happened; only positive completion records appear.
Shared helpers in `shared/src/tracking/wellness.ts` own definition reuse and the
dated entry projection. Mutations refresh account-scoped tracking queries.

Wellness stays outside routine habit editors, scheduled tasks, Daily Progress
and optional reminders. Generic measurement category, value, history and
carry-forward queries also exclude wellness so completion values cannot become
numeric measurement fields. Ordinary measurement types and API contracts are
unchanged.

## Permissions and migration checklist

- Migration: `20261002120000_add_wellness_activity_category.sql` extends an existing
  table; there is no new table or route family.
- RLS: the existing `create_checkin_policy` on `custom_categories` and
  `custom_measurements` applies, including check-in delegate writes and report
  delegate reads. The policy file records wellness reuse.
- Startup: migration and RLS applied through the standard server entrypoint in
  an isolated PostgreSQL database. Only synthetic fixtures and generated isolated
  secrets were used; no personal account or production configuration was used.
- Schema backup: intentionally untouched; CI synchronizes it after merge.
- Shared schemas: habit columns, API category and empty schedule validation;
  exports remain source-first through `shared/src/index.ts`.
- Documentation: sharing behavior, security tiers, database index, feature map and
  package guides updated.
- Downstream: web and mobile Diary cards, existing habit editors, Daily Progress,
  local/remote reminder derivation and cache invalidation checked.
- Validation and visual evidence: recorded below with their verification limits.

## Visual review and evidence

German web captures in `.visual-sample/captures/wellness-final/` cover 1280- and
390-pixel widths in dark and light, plus enlarged text at 390 pixels. The five
card crops show the bounded wellness surface. `results.json` records five checks
against the isolated real server: reload persistence on the selected day,
date-specific undo, retained input after a failed save, concurrent definition/log
reuse with schedule rejection, and unchanged Daily Progress. It reports no page
errors. The web detector returned no findings (`[]`) in one run.

Native evidence is in `.visual-sample/wellness-ios-verdict/`. The
`390-de-dark-attachments/`, `390-de-light-attachments/` and
`430-de-large-attachments/` manifests each map four screenshots to empty, logged,
expanded-history and after-undo states. `results.json` records successful render
checks and native interactions on simulated iPhone 13 (390×844, both themes) and
iPhone 14 Pro Max (430×932, largest Dynamic Type, dark). Native interactions
exercise the preset target, logging, history and undo using an in-memory
transport; backend persistence and permissions are verified separately below.

The initial visual disposition requested one fix: at the largest iOS text size,
the logged “Sauna” name squeezed into “Saun/a” beside Undo. Wrapping rows with a
readable name basis/minimum width and a 44-by-44-point Undo target resolved that
finding. The final disposition was **ship**, with the sole fix **Resolved**. The
final review covers this logged-row correction on simulated iPhone; the original
bounded review remains valid for the wellness feature component on web and
iPhone. No native detector ran.

These are feature-level review results, not whole-app visual approval. Android
native rendering was not performed; the mobile app has `supportsTablet: false`.
Physical-device review and production deployment are not established by this
evidence. Generated captures remain in the ignored local evidence directory.

## Validation

| Check                       | Result and boundary                                                                                                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                    | `validate`, full `test:ci` (167 files, 1,459 tests) and production build passed.                                                                                                                                                             |
| Mobile                      | Final `validate` passed. Full `test:ci` (524 suites, 7,559 tests) passed before the final wrapping/test-only changes. Final focused WellnessCard and Diary wellness-only-day checks passed (four tests each).                                |
| Server                      | Final `validate` and full `test:ci --maxWorkers=1` passed with 443 files and 5,265 tests (13 files and 381 tests skipped).                                                                                                                   |
| PostgreSQL/RLS              | Latest integration run passed all five tests: concurrent reuse of one definition and daily row, dated undo, check-in delegate writes, report delegate reads, unrelated-user isolation, ordinary measurements retained and wellness excluded. |
| Docs                        | Documentation build passed.                                                                                                                                                                                                                  |
| Repository and localization | `repository:check` passed for five packages; German overlay `--check` passed with zero drift.                                                                                                                                                |
| Normal mobile export        | iOS Expo export passed. Its production Hermes bundle contains none of the review transport or synthetic wellness fixture markers.                                                                                                            |

Default-concurrency server runs encountered socket resets and an unrelated
cycle-route 401/400 failure. The exact final full suite passed with one worker.
