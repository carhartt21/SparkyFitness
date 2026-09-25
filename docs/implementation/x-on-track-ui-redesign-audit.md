# X on Track interface redesign — audit register

Status: reference audit, redesign, source review, correction and code verification completed 25 September 2026; authenticated visual acceptance remains unverified.

## Reference availability

- The [screen asset index](https://app.notion.com/p/3e65fb777c5d815785fdcbd28f9498c4) names the eight references but says they are pending upload. The user supplied `x-on-track-ui-assets-2026-09-25.zip` in the repository root. All seven standalone PNGs and the secondary collage were extracted to `/tmp/x-on-track-ui-assets-2026-09-25/` and visually inspected at original resolution. The five mobile references are 852×1846 pixels; the two web references are 1586×992 pixels.
- The [approved brand page](https://app.notion.com/p/3e45fb777c5d81ce9afdfbb0c6e64524) confirms **X on Track** and **Keep getting better.** The existing light/dark logo assets under `SparkyFitnessMobile/assets/brand/` were visually opened: both show the continuous green left chevron, separate orange right segments and three perspective track surfaces. The web has corresponding assets under `SparkyFitnessFrontend/public/images/brand/`; no logo reconstruction is needed. The reference mockups' “Track today. A better tomorrow.” tagline is superseded by the approved brand.
- Standalone mobile references favor a date control above a single prominent daily summary, then direct logging actions, concise macro/hydration/activity cards and meal rows. The Add Food image places search and recent/favorites first, with scan/photo/manual paths visible. The Nutrition and Exercise images use one primary trend, then compact secondary metrics. Desktop references use a fixed navigation rail, a four-card overview and one leading trend before subordinate charts. The collage differs in details and is secondary.
- The mockups contain invented foods, timestamps and conflicting energy figures (for example the dashboard shows 1,513 consumed, 1,592 in the ring and 408 remaining against 2,000). They also imply unsupported premium and motivational health claims. Those are excluded from implementation; actual summary and server balance fields remain authoritative.
- The installed iPhone 17 Pro simulator build opens to the Expo development menu, so its screenshot at `/tmp/x-on-track-audit-baseline.png` is **not** a valid baseline of a scoped screen. No baseline or reference comparison is claimed from it.

## Stack and flow map

| Surface | Existing owner | Data/action path |
| --- | --- | --- |
| Mobile Dashboard | `DashboardScreen`, `CalorieRingCard`, `MacroCard`, `HydrationGauge`, `ExerciseProgressCard` | `useDailySummary` → daily-summary API; food search navigation; water mutations |
| Mobile Diary | `DiaryScreen`, `FoodSummary`, `DiaryCalorieMacroSummary`, `ExerciseSummary` | Same date store/summary; food entries and captured drafts; meal detail, serving adjustment, exercise and water actions |
| Mobile Add Food | `FoodSearchScreen`, `FoodEntryAddScreen` | Local/recent/favorite/provider search → variant/quantity/meal selection → `useAddFoodEntry` → cache invalidation |
| Mobile Nutrition / Exercise | `DailyNutritionDetailsScreen`, `ExerciseReviewScreen`, library and live-workout routes | Daily summary/nutrient goals; exercise sessions and tracking routes |
| Web Dashboard | `/` → `Diary`, `DailyProgress`, `NutritionSummaryCard`, `DiaryWidgetGrid` | Daily summary + food/meal queries; create/delete entry mutations; date query parameter |
| Web Nutrition Reports | `/reports` → `ReportsControls`, `NutritionPeriodSummary`, `NutritionChartsGrid` | Period report queries; logged-day and calorie-balance data; nutrient chart preferences |

Mobile uses Expo SDK 57 / React Native 0.86, React Navigation and Uniwind. Web uses React 19, Vite 8, Tailwind 4, React Router 7, Radix and Recharts. Existing light/dark tokens live in mobile `global.css` and web `src/index.css`. The prior web-audit edits are uncommitted and must be reviewed as part of this work, not discarded.

## Prioritized issue register

| Priority | Status | Surface / evidence | Correction to verify | Verification |
| --- | --- | --- | --- | --- |
| P0 | Corrected in code, runtime unverified | Mobile Dashboard: `DashboardScreen.tsx` rendered its direct `FoodSearch` card only when `summary.foodEntries.length === 0`. After logging food, the direct action disappeared. | The permanent two-column action grid opens the existing FoodSearch route on the selected date. Diary also keeps one permanent Add Food action in `NutritionQuickActions`. | Focused Diary and FoodSearch tests passed; simulator tap remains unverified. |
| P0 | Corrected in code, runtime unverified | Mobile energy card: `CalorieRingCard.tsx` labelled `calorieBalance.burned` only “Burned.” The server's `calorieBalanceService` sets this to exercise energy plus BMR when `include_bmr_in_net_calories` is enabled. | The card now labels activity or total expenditure according to that preference, uses the server balance, and presents over-target and missing-target states without a fake zero allowance. `NutritionMacroCard` no longer floors over-target intake to zero. | Macro over-target test passed; end-to-end cross-platform fixture remains unverified. |
| P1 | Corrected in code, runtime unverified | Web nutrition reports: `Reports.tsx` stacked hydration, period summary and the full `NutritionChartsGrid`; grid presented all enabled charts equally. | The period summary now leads, the secondary nutrient chart is selected one at a time, and all charts remain available on demand. Hydration and alcohol follow. | Report summary and dashboard-layout tests passed; viewport screenshots and keyboard traversal remain unverified. |
| P1 | Observed in code | Web and mobile use different report/dashboard composition, though both consume daily-summary data. Mobile uses `calorieBalance`; web `DailyProgress` also uses it. | Align names, units, nutrient colors and missing-data treatment in platform-appropriate layouts. | Shared synthetic fixture for totals, units, local dates and incomplete days. |
| P2 | Latent; no current user-facing defect | Web `NutritionPeriodSummary` and `NutritionChartsGrid` contain a browser-calendar-date branch for excluding the current day. `getChartConfig` currently sets `excludeIncompleteDay: false` for every nutrient, so this branch does not run. | If incomplete-day filtering becomes a product requirement, use `todayInZone(timezone)` and a timezone-boundary fixture. Do not silently change chart inclusion now. | Configuration and boundary test if filtering is enabled. |
| P1 | Corrected in code, runtime unverified | Mobile Dashboard has many independently gated cards before Health Trends; quick logging was absent on a populated day. | Daily energy and permanent Add Food / Exercise / Log water / Scan Food actions now lead; secondary cards remain below. | Static target-size check and focused route tests; portrait captures remain unverified. |
| P1 | Partly corrected | Food search has favorites, recent, scan, provider search and multi-select. Initial keyboard focus hid the landing actions. | Search no longer opens the keyboard automatically; photo and new-food paths are visible below search, and the existing labelled scan action remains in the header. | FoodSearch tests passed; keyboard and screen-reader traversal remain unverified. |
| P1 | Observed in references and code | The reference hierarchy is markedly simpler than the mobile Dashboard's many independently gated cards and the web Reports' equally weighted chart grid. | Lead with day summary and actions; progressively disclose secondary reports and retain existing routes. | Side-by-side review at both required mobile and web sizes. |
| P1 | Corrected in code, runtime unverified | Mobile nutrient trends inserted zero-valued days when no food had been logged, making missing intake look confirmed. | The hook retains the date range but exposes recorded dates; the trend screen plots and averages logged days only and explains gaps. | Hook test distinguishes a recorded day from an unknown gap. |
| P0 | Corrected in code, runtime unverified | Web `NutritionPeriodSummary` showed negative “Net Balance” for days with some logged food, which could be read as a confirmed deficit despite missing meals. | The card and chart now name logged intake versus target and logged variance, with an explicit incomplete-logging caveat. New copy is in the English source catalog; other locales fall back to English until the translation pipeline syncs them. | Report fixture tests pass; locale and authenticated visual review remain. |
| P1 | Corrected in code, runtime unverified | Mobile energy summary did not explain why target minus intake differed from remaining when only part of activity was credited; web burn tooltip was not keyboard-focusable. | The mobile card displays the signed server-balance adjustment separately from burn; web labels activity burn versus total expenditure and uses a focusable tooltip button. | Mobile energy-card fixture test and web typecheck pass; live calculation check remains. |
| P1 | Corrected in code, runtime unverified | Food Search and Diary could open a photo flow that always saves to today even when viewing a historical date. | Quick photo is available only on today's date in those entry points; historical dates retain search, scan and manual routes. | Today/historical Food Search test passes; device interaction remains. |
| P1 | Corrected in code, runtime unverified | Nutrition details hid trends behind another route and forced total carbs despite the net-carbs preference. | The page now leads with the existing calorie chart and 7/30/90-day controls anchored to the selected day; it passes fiber and the user preference into the macro card and recalculates the displayed carb percentage. | Historical-date trend and net-carbs screen tests pass. |
| P1 | Corrected in code, runtime unverified | Exercise review opened on a week and placed its trend below secondary analysis; diary rows and serving controls were below 44 points without photos. | Exercise now opens on a day, offers day/week/month/year, and shows the trend near the primary summary. Diary rows, serving actions and segmented controls have 44-point minimums; imported food source is shown when present and names may span two lines. | Exercise period tests, Diary row tests and focused lint pass; text-scaling/device check remains. |
| P1 | Corrected in tokens, runtime unverified | Light-theme `--color-text-muted` had approximately 2.53:1 contrast on the light surface, including the ring unit and macro notes. | Muted text was darkened to `#596b60`, while the semantic nutrient palettes remain consistent. | Static contrast is 5.59:1 against `#fffdf8`; device color rendering remains unverified. |
| P2 | Blocked | No authenticated local web or simulator data fixture was available. The physical iPhone is currently unavailable to CoreDevice and simulator opens the Expo development menu/onboarding. | Supply a synthetic signed-in account/session or a fixture-backed UI route for captures; do not commit screenshots containing personal data. | Valid before/after screen captures are still missing for all seven scoped screens. |

## Constraints for implementation

Keep authentication, IDs, routes, API schemas, saved data and Health/Watch behavior intact. Use the server `calorieBalance` as the headline energy source; do not add `burned` again to an already adjusted target. A missing value remains unknown rather than becoming a reported zero or confirmed deficit. Preserve date strings in the configured timezone and distinguish logged intake from complete nutrition coverage. Carry forward all existing actions, including scan, photo, manual food, hydration, food edit/delete, exercise logging and live workouts.

## Design-system and implementation decisions

- Reuse the existing approved logo; the mockup's alternate tagline and invented data were excluded. The interface keeps both supported themes and applies the reference's quiet dark surfaces and green/teal accent through existing platform conventions.
- Semantic nutrient colors now map consistently by meaning: calories teal, protein amber, carbohydrate green, fat cyan, fiber coral. Web uses `--metric-*` HSL tokens; mobile uses `--color-*` tokens in light, dark and AMOLED modes. Measured contrast against the respective card surfaces is at least 4.5:1 for the new metric text colors in all tested theme palettes.
- Existing routes and API payloads remain unchanged. Mobile Add Food reaches FoodSearch with its selected date; scan, photo, manual entry, recent/favorites, quantity and meal flows still use their existing handlers. Exercise and hydration use existing actions. Web Add Food opens the existing food-search dialog for the first visible meal type.
- Nutrition's daily page names the selected date, shows a range-controlled trend ending on that day, and states that missing meals are unknown. The separate trend route also shows only logged days. The web period summary explicitly warns that logged variance is not a confirmed energy deficit. No health conclusion is inferred from incomplete logging.
- The reference images use fixed portrait and desktop canvases. The implementation retains scrolling and fluid layout rather than copying screenshot dimensions. The web's non-nutrition reports, saved widget ordering and out-of-scope themes stay accessible.

## Verification record

| Check | Result |
| --- | --- |
| Reference images | Seven standalone PNGs and the secondary collage visually inspected from the supplied archive. |
| Mobile typecheck and changed-file lint | Pass. |
| Mobile i18n audit | Zero missing static English keys, missing fallbacks or hardcoded UI strings; command exits 1 for three existing dynamic `metric.labelKey` lookups in Health writeback/Sync. These call `t` with explicit defaults and were outside this redesign. |
| Mobile Jest CI suite | Pass: 477 suites, 7,208 tests, including the 11 focused redesign suites. |
| Mobile iOS JS bundle | Pass: `expo export --platform ios` to `/tmp/x-on-track-ui-export-final`. This is a JS bundle, not a signed native build. |
| Web typecheck, changed-file lint, Vite development build | Pass. |
| Web Jest CI suite | Pass: 149 suites, 1,372 tests. The first run found two missing English energy-label keys; those were added and the complete suite passed on rerun. |
| Impeccable detector on scoped changed files | Pass: zero findings. |
| Package `validate` wrappers | Unavailable: the scripts call `pnpm`, which is not installed on this Mac. Their constituent checks were run with `npm` and local binaries; all passed except the pre-existing mobile dynamic-key i18n audit finding above. |
| 390×844 / 430×932 mobile render, 1280×800 / 1440×900 web render, before/after screenshots | **Unverified.** No authenticated synthetic session is available for the actual screens. The simulator's Expo menu screenshot is not counted as product evidence. |
| Search → portion → save, edit/delete, date changes, hydration, live exercise, offline/sync and permissions | **Unverified end-to-end in this redesign pass.** Existing flow handlers and focused tests were preserved; physical test device is not currently connected. |

The remaining visual and end-to-end checks are acceptance blockers, not passes. This audit did not include merge or deployment; a later owner-requested review deployment is tracked separately.

| Screen | Inspected reference in archive | Product before/after capture |
| --- | --- | --- |
| Mobile Dashboard | `mobile/01-dashboard.png` | Unverified: no authenticated synthetic session |
| Mobile Diary | `mobile/02-diary.png` | Unverified: no authenticated synthetic session |
| Mobile Add Food | `mobile/03-add-food.png` | Unverified: no authenticated synthetic session |
| Mobile Nutrition | `mobile/04-nutrition.png` | Unverified: no authenticated synthetic session |
| Mobile Exercise | `mobile/05-exercise.png` | Unverified: no authenticated synthetic session |
| Web Dashboard | `web/06-dashboard.png` | Unverified: no authenticated synthetic session |
| Web Nutrition Reports | `web/07-nutrition-reports.png` | Unverified: no authenticated synthetic session |
