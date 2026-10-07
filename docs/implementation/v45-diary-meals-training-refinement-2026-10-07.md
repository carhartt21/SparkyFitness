# V45 diary, meals and training refinement

Status: implemented on `feat/v45-diary-meals-training-refinement-20261007`, based on
`6f9bee426`. Unreleased; this record is not a production or TestFlight claim.

## Approved scope and implementation sequence

The six owner findings concerned imported workout visibility, task recording
controls, hydration navigation, energy-card density, daily meal editing and Diary
presentation. Two approved synthetic boards guided the phone-first work:
[Home and daily/weekly Training](evidence/v45-diary-meals-training-2026-10-07/approved-home-training.png)
and [Meals, Diary and hydration](evidence/v45-diary-meals-training-2026-10-07/approved-meals-diary-hydration.png).
The second board's Home panel is superseded. Mockup dates, names and quantities
are illustrative, never production fallback values.

1. Retain five tabs and add pushed daily Meals/Training routes with selected-day
   navigation. Reuse existing logging actions and root-stack conventions.
2. Keep Daily Progress first on Home, simplify calories to a centered gauge with
   intake and allowance inside it, and add a compact Training summary below it.
3. Add collapsed daily meal groups, independent state controls, shared food
   selection/movement and reviewed template drafts preserving recorded nutrition.
4. Combine the hydration logger and existing source/history ledger on one page;
   maintain the approved drinks-versus-solid-food goal policy.
5. Add daily recorded/planned training and a weekly itinerary using existing
   activity planning; distinguish actual workouts from daily energy aggregates.
6. Localize canonical activity names and use source workout timestamps. Run
   package validation, phone regressions, focused server tests and native captures;
   document device/account gates separately.

## Changed behavior and ownership

- Home energy uses `calorieBalance.eaten + calorieBalance.remaining` for the
  configured, exercise-adjusted allowance. It does not credit activity a second
  time. Without a configured goal, the denominator remains unavailable.
- `DailyMealsScreen` owns presentation, not another logging domain. It combines
  existing summary, meal status, captures and outbox projections. Photos without
  confirmed nutrition remain pending. Meal status is an explicit owner decision.
- `useDiaryFoodEditing` shares multi-select move/copy/delete and cache invalidation
  across Diary and daily Meals. A synchronous mutation guard prevents duplicate
  copies; changing the day cannot apply an old response to a new selection.
  `useFoodDragScroll` shares the existing drag-edge scrolling behavior.
- `diaryMealDraft` preserves recorded per-serving nutrient snapshots, ingredient
  quantities and units. It excludes entry IDs, dates/times and photos. Unresolved
  nutrition, deleted library foods or missing reusable serving variants require
  explicit review; no library identity or nutrition is fabricated. The existing meal editor performs the actual save.
- Habit action circles record completion or open numeric input as appropriate.
  Meal action circles use the existing cycle/menu control. Future selected days
  retain detail navigation but cannot record habit/meal completion through
  shortcuts; guards use the account timezone and protect the mutation callback
  too. Supplements and other domains open their established recording flows
  instead of assuming intake.
- `WaterLogScreen` and `HydrationHistory` replace the separate hydration modal.
  Recorded water, drinks and confirmed supplement drinks count toward the goal;
  solid-food water is details-only. The existing server ledger, save/retry queue,
  container configuration and original source-entry edits remain authoritative.
  The dedicated daily variant centers a cyan open arc above those shared controls.
  Enlarged text uses an unrestricted central value instead of a cramped arc.
  Uncached offline history is unavailable, never a perpetual loading state.
- `useDailyTraining` excludes aggregate active-energy rows. Actual workout
  duration and terminal mobility session elapsed time form the displayed summary;
  mobility time includes pauses and is not a measured active-minute value. Planned
  durations are never included. Failed mobility reads withhold exact combined
  counts/minutes and remain retryable; known records stay visible. No calorie
  estimate is created by this screen.
- `WeeklyTrainingItinerary` projects existing week occurrences and records, with
  sport icons and links to daily details or the retained plan editor. It does not
  create or complete occurrences merely by reading them.
- `workoutPresentation` translates known imported activity types while preserving
  custom/Hevy names. `importedWorkoutClock` chooses actual source instants and the
  retained record timezone/offset or account timezone; missing clocks stay unknown.
  New native workout ingestion persists that clock. Existing records can display
  retained raw source time without a database migration or historical rewrite.

## Component and route usage

`DailyMeals({date?, mealTypeId?})` opens the selected day and optionally focuses a
meal group. `DailyTraining({date?})` opens recorded training and plans. The existing
`WaterLog({date?})` is the unified hydration destination. `DailyDetailScreen`
provides shared date controls, safe-area scrolling, calendar and pull-to-refresh.

`FoodSummary` accepts `collapsible`, focused meal/group projections and an optional
`onSavePreset`; legacy expanded consumers remain supported. `MealAdd` accepts a
create-only `initialDraft` for reviewed ingredient snapshots. `TrainingSummaryCard`
is navigational, whereas hydration quick logging retains its independent action.
`HydrationGauge` adds a `daily` presentation; its `full`, `tile`, and `options`
consumers retain their logger semantics. `EnergyGauge.color` optionally supplies
a single categorical color, leaving the energy gradient as its default.

No bundle ID, authentication setting, database key, queue, scheduler or native
sync identity changed. Web presentation was outside this batch; shared changes
were validated in all three consuming packages.

## Validation actually run

- Mobile: full Jest run, **571 suites / 7,901 tests passed**. Following final
  compact-heading/category-color changes, focused regressions passed:
  **5 suites / 49 tests**. The later owner correction to the gauge and Diary
  icon passed **3 suites / 40 tests** plus the mobile validation wrapper. The
  full run predates those two bounded presentation changes.
- Focused server: **6 suites / 103 tests passed** covering source workout clocks,
  ingestion telemetry and Hevy CSV processing, preview, review and pagination.
  The complete backend suite was intentionally not run.
- Mobile, server and frontend `pnpm run validate`: passed, including strict
  TypeScript, lint/format, localization and native brand/geometry checks.
- iOS simulator build: `XonTrack` Debug workspace/scheme succeeded with generated
  iOS and Watch targets, ad-hoc simulator signing. This was not an App Store archive.
- Simulator: German 390×844 dark/light and 430×932 accessibility text. Real-component
  navigation, collapsed/expanded meals, state mutation, daily/weekly Training,
  inline hydration and Diary passed using isolated synthetic fixtures. The first
  harness attempted water quick logging instead of Details; its selector was
  corrected without changing production quick-log behavior. A supplemental
  German dark tour also passed; its compound source action required descendant
  label matching after two narrower selector attempts failed.
- [Simulator results](evidence/v45-diary-meals-training-2026-10-07/simulator-results.json)
  and named captures retain fixture provenance. No HTML/CSS design detector ran
  because the changed surfaces are native React Native.

## Finish review and evidence

The independent native review identified eight material corrections. Two bounded
correction rounds resolved all eight: first-viewport Home density, cyan hydration
geometry, enlarged-text reflow, unknown calorie goals, unresolved template serving
variants, future-day recording guards, unavailable source data, and category icon
roles/native control sizes. The [final verdict](evidence/v45-diary-meals-training-2026-10-07/verdict-round2.md)
is **ship for the eight scored fixes**, rather than whole-app or device acceptance.
The later [owner follow-up review](evidence/v45-diary-meals-training-2026-10-07/finish-owner-followup.md)
independently inspected all 12 new captures and returned **ship for the two gauge
and meal-icon changes**, with no material correction. Its first reviewer was
replaced once after a capacity error; the replacement completed the narrow review.
The later phone button and Meals/Training fidelity batch is recorded below.

The initial evidence packet contains 39 final matrix screenshots plus a supplemental
hydration screenshot confirming the green supplement glyph and complete source
record. A later owner-directed correction adds 12 Home/Diary captures in dark,
light and enlarged text (`owner-` prefix), with three complete native tours in
[the follow-up manifest](evidence/v45-diary-meals-training-2026-10-07/owner-followup-simulator-results.json). Approved reference boards and final captures retain embedded provenance;
all fixture names and values remain isolated from production. The final design
record is merged into the existing `DESIGN.md` and `.impeccable/design.json` without
replacing incumbent tokens or unrelated Settings/web guidance.

Repository layout checks and the final documentation build passed. VitePress
retained its existing chunk-size warning. Results are recorded in the validation
manifest.

The four-line gauge follow-up passed **2 suites / 9 tests** and mobile validation.
All three native German dark/light/enlarged interaction tours passed using the
existing simulator Debug shell and current JavaScript. Six new Home captures
(`four-line-` prefix) and [tour results](evidence/v45-diary-meals-training-2026-10-07/four-line-simulator-results.json)
record this typography change. The [fresh narrow review](evidence/v45-diary-meals-training-2026-10-07/finish-four-line-gauge.md)
found no UI defect and scored the stale sidecar correction resolved (**ship at
that scope**). Physical-device review remains unperformed.

## Reference adaptations and remaining gates

The final owner correction replaces remaining energy with consumed energy and
the adjusted goal directly inside the Home gauge, without text below it. The
latest typography correction uses four centered lines: intake, “von”, adjusted
goal, then “kcal”. The ordinary intake uses 26-point bold type; the goal uses
20-point semibold type, and the connector/unit use 12-point secondary type.
This follows the hydration gauge’s centered hierarchy without changing its layout.
It retains the existing server adjustment policy and explicit unavailable target.
Diary meal groups now use the native fork-and-knife glyph, scoped to this timeline.

On ordinary-size Home, the Daily Progress heading shares the left visual column
to expose Training and all four logging actions within the first viewport. At
enlarged text sizes it retains the stacked heading and scrollable category rows.
Meal summaries/actions and source rows reflow rather than reducing native scaling.

The itinerary extends the existing plan management screen so editing, activation
and legacy plans remain available. It never invents a rest day for an empty day.
Actual counts and source rows differ from the boards. Native headers and existing
iconography replace illustrative mockup chrome. Screens scroll at larger text
sizes instead of shrinking readable text to fit mockup density.

The owner's actual Hevy import/history has not been inspected. The V44 visibility
fix and import-range tools remain present and focused regressions pass, but this
does not verify all of that account's >200 workouts. Do not close that account
verification as complete on the basis of fixture tests.

Not performed: physical iPhone/Watch interaction, Health/Fitness export and
permissions, phone–Watch exactly-once round-trips, Android build/device checks,
signed release archive, TestFlight upload, production deployment, production-data
reimport, real-account Hevy reconciliation, or offline process-restart/replay on
hardware. Food bulk movement/template behavior has regression coverage; physical
drag accuracy and real-server persistence remain manual acceptance checks.

## Subsequent phone button and fidelity batch

The owner-directed follow-up is implemented in the same branch: one enforced
phone action theme plus compact daily Meals and daily/weekly Training tables,
actions and rows. The [follow-up implementation record](phone-buttons-meals-training-alignment-2026-10-07.md)
contains component usage, changed surfaces, reference adaptations, tests and
manual gates. The [bounded finish verdict](evidence/v45-diary-meals-training-2026-10-07/finish-button-alignment.md)
scored the four requested corrections and introduced label break resolved.
This is fix-list approval, not whole-app or physical-device acceptance.

Later minor task: move the Watch training page directly after the food-intake
page while retaining page identifiers, navigation state, session commands and
phone–Watch synchronization. No Watch page reordering was implemented here.
