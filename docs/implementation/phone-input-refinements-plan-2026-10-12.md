# Phone input and quick-action refinements

Date: 2026-10-12. Status: implementation and scoped native verification complete; merged to main at `cb13445abf`. v50 is uploaded, Apple VALID and in internal beta testing; production remains blocked by the SSH route. The focused branch was based on main `3f3bf7521`.

## Evidence and baseline

The current Todoist Inbox contains three relevant open findings: precision in food quantities, time spinners using the meal editor as reference, and clearer identification of the selected hydration container. All five attached screenshots were inspected. The unrelated Inbox item is outside this workstream and was not changed.

Remote `main` was checked on 2026-10-12 at `3f3bf7521d9ec333af5e33347b3b0dd2e616097f`. The latest repository release record is [v49](v49-release-2026-10-09.md), documenting application revision `9a178ca11` and Apple upload of 1.7.2 (49). This does not establish the build currently installed on a physical device. The separate local upstream adaptation branch ends at `7b7da2241`; it is not on remote main.

This correction batch uses a focused branch from checked main. Its three implementation commits remain independently reviewable. The upstream adaptation is excluded; if included in a later release, review conflicts and validate that combined candidate. Planning alone did not authorize a release; the subsequent execution authorization below does.

## UX brief and confirmed scope

This is an Operate refinement within the existing phone design: readable quantities, predictable 24-hour time selection and a water action whose effect is clear before tapping. Preserve the five-tab navigation, shared button material, current meal edit/save semantics and hydration action queue.

The owner confirmed both scope choices: use meal-style wheels across all phone time inputs, retaining calendars for dates; show the per-tap amount and selected container in the Water shortcut. The sequence below incorporates those decisions and has been implemented.

## 1. Quantity precision and localization

Priority: P2. First implementation commit.

**Cause verified:** `3 * 7.1` produces the binary floating-point value `21.299999999999997`. `SwipeableFoodRow.tsx` renders `entry.quantity` directly in both visible and accessible text. `FoodEntryViewScreen.tsx` also interpolates raw serving values. The app already has the locale-aware, bounded `formatServingSizeForDisplay` helper in `utils/foodDetails.ts`.

- Use the existing presentation formatter in food rows, serving summaries and their accessibility announcements. Audit the closely related meal/detail quantity labels for the same raw interpolation; avoid a repository-wide numeric rewrite.
- Render the example as **21,3 g** in German and **21.3 g** in English. Apply the same locale formatting to the per-serving weight and fractional serving count. Reuse existing unit localization while keeping literal provider/user names intact.
- Preserve canonical numeric inputs, stored quantities and nutrition calculations. Do not round diary snapshots or recalculate old meals merely to clean up text. Keep the existing maximum four decimal places and trailing-zero policy for serving displays.
- Cover the regression in `SwipeableFoodRow.test.tsx`, `FoodEntryViewScreen.test.tsx` and `foodDetailsLocale.test.ts`. Include repeated portion multiplication, fractional servings, integers, small supported quantities, DE/EN separators and unchanged saved/nutrition values.

Acceptance: the same recorded quantity reads consistently in the Diary, meal details, individual entry details and accessibility text; no floating-point tail or locale-neutral decimal leaks into German labels.

## 2. One shared phone time-wheel behavior

Priority: P2. Second implementation commit.

**Cause verified:** `TimeSheet.tsx` deliberately switches from wheels to hour/minute selectors when `fontScale > 1.25` or `minuteInterval > 1`. `AdditionalSupplementIntake.tsx` requests a 15-minute interval, which explains the reported supplement sheet. `MealTypeTimeWheel.tsx` already provides the desired full-width layout and 24-hour presentation.

- Extract or generalize that incumbent wheel for reuse by `TimeSheet` and meal time editors. Move common time-conversion helpers out of the sheet before importing the wheel into it, avoiding a sheet/wheel circular dependency; preserve existing exported compatibility helpers where callers/tests need them.
- Keep hours 00–23 and canonical `HH:mm`. Preserve minute-step restrictions where intentional, while representing an existing off-step value and the exact result of Now without silently rounding either.
- Preserve `present(initialTime)`, stable initialization, `commitOn` behavior, Done validation/error display, dismissal, optional time clearing and caller-specific Now/timezone handling. A wheel movement must not prematurely save an intake or bypass validation.
- Make enlarged-text wheels legible and operable with scaled row geometry, complete selected digits, accessible hour/minute names and adjustable actions. Do not replace working accessibility with an untested wheel or force font shrinking. Keep controls above the safe area and avoid competing sheet/wheel gestures.
- Review every `TimeSheet` consumer: additional intake and medication schedules; food add/edit and logged-meal editing; workout-plan times; coaching review times; notification and tracking settings. For fasting date/time editors, reuse the same clock presentation while preserving the selected calendar date and start/end bounds. Date-only calendar screens remain calendars; duration wheels retain duration semantics.
- Update `TimeSheet.test.tsx`, `TimeSheet.largeText.test.tsx`, `MealTypeTimeWheel.test.tsx` and affected consumer regressions. Cover 00:00/23:59, 1/15-minute modes, off-step initialization/Now, reopening, cancel, commit-on-Done, rejected validation and legacy 12-hour preferences still rendering 24-hour time. Include fasting date preservation and workout nullable time behavior.

Acceptance: the reported supplement sheet matches the meal editor's interaction at ordinary and enlarged text sizes, and shared consumers retain their original save/date rules.

## 3. Selected hydration container in the Water action

Priority: P3. Third implementation commit.

**Cause verified:** Home hardcodes the water icon and label. `useWaterIntakeMutation` already exposes `activeContainer` and `servingVolume`, resolved from the user selection, primary container, first standard container or synthetic default. `ActionTile` already accepts a sublabel and explicit accessibility label. Containers currently have no custom icon field.

- Show both the selected container name and a concise locale-aware **per-tap amount**, for example Glas and 250 ml for a 1,000 ml bottle with four servings. Keep the amount and unit complete; truncate only a long container name when necessary. Provide the full name and amount in the accessibility label and retain full container details in the existing hydration/container screen.
- Reuse the resolved hook state and existing volume formatters. Do not implement a second selection preference, choose a different container or assume full capacity equals one press. A linked-food container returns unknown serving volume: show its actual known serving description/container name, never an invented ml credit or zero.
- Preserve one-tap logging, selected day, durable retry/idempotency behavior and the existing hydration detail destination. Respect loading/unavailable states without advertising an amount the action cannot yet resolve.
- Keep all four action icons/titles aligned and ordinary tile dimensions stable. Account for the secondary line in the shared layout rather than vertically shifting only Water. Reuse the existing large-text two-column reflow. Do not reintroduce the removed Scan subtitle or truncate the meaningful volume/unit.
- Add focused Home action presentation coverage and extend `useWaterIntakeMutation.test.ts` only for uncovered selection/presentation boundaries: selected vs primary, deleted/stale selection, multiple containers, synthetic default, linked food, display units and loading. Verify the visible amount and the container used by the action agree, including after changing selection and returning to Home.

Acceptance: both the selected container and per-tap quantity are visible before tapping; the action logs exactly the same container serving as before.

## Validation and completion

- Run the named focused regressions during each commit, then the full mobile suite and `pnpm run validate` once on the combined batch. Run the German overlay application/check and shared button-theme check through validation.
- Inspect a bounded native matrix: German dark/light at ordinary phone size and enlarged text at the larger phone size. Exercise food quantity views, supplement/meal/plan time selection and the Home water action. Verify actual wheel scrolling, confirmation and full labels rather than treating snapshots as interaction proof. Use the required scoped finish review for changed UI.
- Use synthetic data for water mutation and intake tests. Record physical Android wheel/gesture and VoiceOver/TalkBack acceptance separately when unavailable locally.
- Expected scope is mobile plus reviewed German overlays and documentation. No database migration, API contract, new dependency, native permission or Watch change is expected. If a genuine cross-package dependency is discovered, revise the plan and validate each touched consumer; preserve the standing instruction to skip backend tests.
- Recheck all three Inbox tasks against the resulting behavior. Keep implementation, merge, upload, deployment and physical acceptance distinct; do not mark tasks complete based on this plan.

## Plan review

Reviewed against `agent-docs/plan-review-checklist.md`: existing formatters, wheel and hydration hook are reused; layering and action ownership are retained; date-only values and stored snapshots remain unchanged; concrete regressions and validation are defined; no schema/auth change or broad redesign is proposed. Both scope choices are confirmed. No application code, Todoist task or production state was changed during planning.

## Execution authorization

On 12 October the owner confirmed all phone clock inputs, the per-tap amount and selected container, and execution in the proposed order followed by the next release/deployment cycle. The broad upstream adaptation remains separate. Backend tests remain skipped by the standing instruction.

## Implementation and verification record

- `778d245c7`: food quantities and serving summaries use the existing locale-aware four-decimal presentation formatter. Stored amounts and nutrient calculations retain their original precision.
- `4311e5155`: a shared `TimeWheel` replaces the clock-selector fallbacks and fasting clock controls. It preserves dates, exact off-step values, 24-hour time, validation and commit behavior. Scaled row geometry and adjustable accessibility actions support enlarged text.
- `bf236dd8e`: the Home water tile shows its resolved container and per-tap amount, using the same state as the logging action. Linked drinks use their actual serving description. All quick-action tiles reserve matching supporting-line space.

All 583 mobile suites passed (7,952 tests). The final supporting-line alignment adjustment passed eight focused control tests. Mobile, web and server validate wrappers passed; backend tests were skipped. The German dark/light and enlarged-text native interaction matrix passed; the [scoped finish review](evidence/v50-release-2026-10-12/finish-review.md) returned **ship**. Evidence and limits are recorded in the [v50 release receipt](v50-release-2026-10-12.md). Physical Android gestures and VoiceOver/TalkBack acceptance remain separate from simulator and unit checks.

The production health endpoint returns HTTP 200. The existing SSH route through the university host timed out during preparation; no production mutation occurred from that probe. Release preparation continues independently, and deployment must retain its normal capacity, backup and rollback gates when the route is available.
