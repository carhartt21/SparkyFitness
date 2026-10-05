# v42 inbox corrections — 2026-10-05

Branch: `feat/v42-inbox-corrections-20261005`, based on
`0c14fc15b054929452fefa4f2e0097a86d424f52`. This is an implementation record for an
unreleased branch. Main, production and TestFlight are unchanged by this batch.
The six Todoist inbox items remain open for the owner's next device acceptance.

## Reviewed scope and implementation order

The Todoist inbox and all six attached screenshots were reviewed before editing.
The owner explicitly selected **earliest to latest** for the diary's timeline.

| Stage | Report | Implementation |
| --- | --- | --- |
| 1 | Logo does not return home; headings lack emphasis | Connect tab-header logos to Dashboard, with the existing accessible label. Strengthen shared header typography and keep subtitles on one line. |
| 2 | Gauge text is cramped | Keep the number and unit inside the energy gauge; place its descriptive status and goal control below the arc. Retain the compact shared summary layout and neutral card treatment. |
| 3 | Diary is dominated by quick entry and grouped blocks | Remove the quick-entry section, interleave recorded events chronologically, keep meal-state/navigation controls and bulk food editing, and move the intake summary to the bottom. |
| 4 | Search text is not vertically centered | Use shared single-line search input metrics in food search and library search. |
| 5 | Saved OFF foods still lack portions | Add a bounded, owner-scoped refresh when opening an old saved food, reusing the existing provider detail and food-variant APIs. |
| 6 | Verification | Check German copy, quantity and chronology regressions, complete mobile validation/tests, and review native dark/light/enlarged-text screenshots. |

Todoist IDs: `6hgxm77r47h6xMCf`, `6hgxmVVvGhMw4vQ7`, `6hgxp6Q3gFRVP7ff`,
`6hh23QJWRwW2CWQ7`, `6hh2GcjgF8PR3jcf`, `6hh2H2wJ8qWXcWp7`.

## Verified causes and resulting behavior

The logo already supported a press action in `AppHeaderRow`; the shared tab
header did not supply it. Diary, Insights and More now route that press to
Dashboard. The dashboard's existing brand placement remains static.

The energy gauge put its number, unit and status in a small fixed center, while
the goal button used a negative top margin. The status now has a separate row
below the arc, alongside the existing 44-point goal control. Calorie policy,
exercise adjustments, unknown nutrition and the canonical mark are unchanged.

The old diary rendered separate source sections and quick-entry content above
the intake overview. The new `DiaryTimeline` presents the selected day's food,
meal captures and pending food actions, recorded workouts, confirmed mobility,
water, confirmed medication/supplement intake, wellness, and sleep events using
their occurrence times. Linked food hydration is not repeated as another event.
Scheduled or skipped intake is not represented as confirmed consumption.

Local clock times use the existing shared timezone conversion; offset-bearing
timestamps retain their real ordering, including repeated DST hours. Unknown
times are explicitly separated after timed events, with stable identity-based
ordering. Creation/sync times are not invented occurrence times. Backfilled
wellness recorded on another day remains untimed. Measurements and check-in
photos retain their existing selected-day sections because they lack a reliable
event-time contract.

Existing serving adjustment, food edit/delete/selection/move/copy, workout
navigation, wellness undo, photo completion, offline saves and meal-state actions
remain available. Normal browsing has a compact pencil button beside
“Tagesverlauf”; bulk editing retains the grouped food view. At enlarged text
sizes, food calories stack beneath the name and quantity. Time is displayed once
in the timeline header. Water amounts reuse the configured unit and locale
formatting. Partial source failures show a translated refresh/retry message
without hiding other source results.

The search inputs had separate platform text metrics. `SearchFieldInput` now
shares line height, padding and vertical alignment while preserving search,
keyboard, barcode, selection and accessibility behavior.

### Serving ingestion and older saved foods

The [previous serving-ingestion batch](open-food-facts-serving-ingestion-2026-10-04.md)
corrected fresh provider records. Inspection confirms that a barcode or library
selection resolving to an existing local food can bypass that fresh import path.
The screenshot's gram-only choices are consistent with this gap. The owner's
production record was not inspected; its exact stored metadata is still a live
verification item.

`useProviderServingRefresh` runs only online for an explicitly identified OFF
food owned by the active account. It reads local variants, makes at most one
provider detail request for that opening, re-reads variants before appending,
and evaluates at most ten provider choices. Account/server/food/provider/locale
and refresh version scope the refresh cache; successful results are fresh for
24 hours. Existing usable countable portions avoid provider traffic. Unknown
provider identities, other owners' records and offline use do not trigger writes.

Only positive, comparable, explicitly weighted countable portions are added.
Portion nutrition is scaled from the **saved** food's complete gram/ml reference,
preserving owner corrections and absent nutrient values. Existing defaults,
manual variants, historical food-entry snapshots and goals are not rewritten.
Exact portion identities are deduplicated; different weights stay distinct.
No serving weight is guessed from a product photograph or an ambiguous label.

Variant reads/writes carry the expected account/server identity. The cache
publish checks identity again and cancels older variant reads before updating
the existing query cache. An authoritative existing legacy portion is published
even when no insertion is needed; a successfully appended portion stays visible
if a later insertion fails. Errors retain saved choices and expose a localized
retry action on quantity entry. No extra outbox, persistence layer or provider
search fan-out was introduced.

Example: a saved 572 kcal/100 g reference plus an explicit 21.5 g portion yields
122.98 kcal per portion and 43 g / 245.96 kcal for two portions. If the owner
corrected that reference to 400 kcal/100 g, the appended portion retains the
correction at 86 kcal. These arithmetic tests use deterministic fixtures. The
native review uses different synthetic yogurt nutrition; it is not proof of a
live Kinder Bueno import.

## Validation and visual review

- Frozen offline workspace install passed.
- Final full mobile suite passed: **560 suites / 7,834 tests**. This includes
  the new chronology/serving cases and existing navigation, logging, quantities,
  snapshots, photo capture, offline and medication/supplement regressions.
- Focused final source/cache checks passed: 38 tests across DiaryScreen and
  provider-serving-refresh suites. They verify mixed-source order, linked-water
  deduplication, confirmed versus skipped intake, food-edit access, stale summary
  totals, offline behavior, partial insertion failure and late account changes.
- `pnpm run validate` passed, including TypeScript, lint, formatting, Knip,
  localization/plural audits, reviewed German overlays and native locale/mark
  synchronization.
- Documentation build and `git diff --check` passed.
- The mechanical UI detector was run once and reported no findings.
- Native `testV42Corrections` and render smoke passed in German dark and light
  at 390×844, and dark accessibility-extra-large at 430×932. They check summary
  geometry, quick-action clearance, chronological food/water order, edit-control
  bounds, logo navigation and a saved gram-only food acquiring a selectable local
  portion. Screenshots were visually inspected, not accepted solely on OCR or
  XCTest success.

Initial visual review caught the energy status consuming too much vertical
space; it was combined with the goal-control row. A subsequent enlarged-text
capture caught an overflowing diary edit label and cramped food columns; the
compact edit icon and stacked food row resolved those. Intermediate native
failures also exposed two test-harness issues (missing back navigation and a
wrong portion selector), which were corrected independently of product code.

[Selected simulator screenshots and raw case results](evidence/v42-inbox-corrections-2026-10-05/README.md)
use an isolated synthetic transport. The existing compatible development
simulator binary loaded this branch's JavaScript; the UI test runner compiled
with Xcode. A new signed app archive, physical-device TestFlight check, actual
production provider refresh/database persistence, Android, tablet and spoken
VoiceOver were not performed. Server/web code is unchanged; backend tests were
not run, consistent with the owner's standing instruction.

The Impeccable context check reported stale legacy product/platform metadata.
This was recorded, not repaired as a side effect; current code, tokens and the
approved X on Track identity governed the scoped UI corrections.

## Release requirements and prioritized follow-up

No migration, new index, native dependency, credential or server configuration
is required. This uses the existing serving metadata columns and normal APIs.
No production catalogue or personal record was backfilled during development.

1. On the next device build, open an old owned OFF item such as the reported
   product; verify the declared portion, two-portion weight, logging and a restart.
2. Review the chronological diary with a real mixed day, long names and enlarged
   text; verify meal states, food bulk actions and offline capture replay.
3. Foods without provider identity or an explicit metric portion remain limited
   to saved units. A broader library backfill and refreshing foods that already
   have countable portions remain separate improvements, justified only by later
   device evidence.
