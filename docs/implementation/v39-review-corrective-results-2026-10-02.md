# v39 owner-review corrections

Implemented the five initial v39 inbox findings on
`feat/v39-review-corrections-20261002`, based on main `bcb401c4`. The
[reviewed plan](v39-review-corrective-plan-2026-10-02.md) was executed in order:
phone correctness, dashboard categories, Watch localization, Watch daily goals,
then correction and verification. Code commits are `e2862af7f` and `e88bf6107`.
No merge, release publication or production deployment was performed.

## Findings and delivered behavior

| Priority               | Verified cause                                                                                                                                                         | Result                                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1 · activity goals    | The activity projection dropped `activity_type`; phone label handling translated only the older workout domain. Optional rows displayed a misleading zero denominator. | Retain activity type and optional metadata, translate machine identifiers such as `running` → **Laufen**, preserve custom plan/routine names, and show **Optional** or **Keine zählenden Aufgaben**. A separate 44-point skip/undo action uses the occurrence's expected revision. Opening a row still opens its existing recording destination. |
| P1 · Watch German copy | Several shared screens and returned sync/VoiceOver labels bypassed native resources.                                                                                   | Reviewed German copy for measurements, trends, water, energy, sync states and accessibility. The native gate checks all four key namespaces and static UI/returned status literals. Watch has 145 matching English/German keys; its complication has 10. Personal/provider names remain literal.                                                 |
| P2 · card headings     | The shared summary frame rendered left-aligned text without heading icons.                                                                                             | Centered icon/title groups, balanced arrow space, shared columns and neutral outlines/glow. Enlarged text stacks the visual and rows instead of squeezing them.                                                                                                                                                                                  |
| P2 · progress overview | The dashboard preview selected individual unresolved tasks.                                                                                                            | Up to four compact categories, unresolved categories first, with open/partial/complete/skipped/optional/unknown states. A category opens its focused breakdown; the full overview remains available through the heading and **Alle … Bereiche** link. The X/count still uses actual task totals, never category totals.                          |
| P2 · Watch goals       | The context contained aggregate counts only, and the Progress X link opened nutrition rings.                                                                           | A current-day **Tagesziele** page with canonical X, actual counts and up to 64 unfinished goals. Explicit boolean habit and meal-state confirmations use the existing transport/persistence. The Progress X complication opens this page. Unsupported actions explain that they need the phone.                                                  |

## Safety and design decisions

Optional or skipped activity does not become a completed workout or create calories.
The new dashboard projection does not change goal calculations. Unknown/nonapplicable
rows are not automatically labelled optional. Completed categories remain in the full
breakdown. All new phone and Watch copy has reviewed German values in the overlay.

Watch confirmations carry a fixed ID, account/server scope, local date, capture time
and source timestamp. The phone checks current state and permits only completion
habits and explicit meal status; it does not invent counts, measurements, supplement
intake, workout sets or questionnaires. Meal confirmation creates no food or calories.
A durable attempt receipt precedes writes; an uncertain response is reconciled rather
than blindly replayed over a later undo. Acknowledgements also ride in the existing
scoped application context because immediate messages can be lost. Queued actions
are visibly pending and do not advance progress. Old-day actions are rejected.

This uses existing APIs and Watch persistence, with no migration, new scheduler or
second outbox. Habit/meal writes retain their existing upsert semantics; unlike the
activity resolver, their read and write are not one cross-device compare-and-swap
transaction. Simultaneous changes on another client remain a concurrency limitation.

The native app and complication share generated geometry and drawing from the same
canonical specification/template. The first-launch weight-entry gate was removed so
the daily goals page is accessible once the phone's account context has synchronized;
measurement entry remains an ordinary companion page. Active workouts still take
priority. Normal phone cards use columns; at accessibility text sizes the heading may
wrap and the card scrolls vertically. This is intentional, not a fixed-height layout.

## Validation actually run

| Check                         | Result / scope                                                                                                                                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen workspace install      | Passed; lockfile unchanged.                                                                                                                                                                                                            |
| Mobile full Jest suite        | 539 suites / 7,651 tests passed during implementation. Final small corrections were then checked separately.                                                                                                                           |
| Final mobile focused Jest run | 8 suites / 33 tests passed: category state/order, label preservation, dated navigation, activity skip/undo/conflict, safe Watch receipts/actions, native locales and canonical drawing parity.                                         |
| Targeted server Vitest        | 4 files / 42 tests passed: activity planning service, routes and projection; daily progress projection. Blanket backend suite intentionally omitted.                                                                                   |
| Package `validate`            | Mobile, server and web passed. Mobile includes TypeScript, lint, locale generation/German overlay, copy audit, Knip, native locale and generated-asset checks, and formatting.                                                         |
| Documentation build           | Passed with the existing nonblocking bundle-size warning.                                                                                                                                                                              |
| Native sources                | Phone WatchConnectivity bridge typechecked with the cached simulator Expo framework; Watch app compiled in the synthetic executable; Watch complication typechecked for watchOS simulator. These are not signed-device archive checks. |
| Phone simulator               | German 390×844 dark/light and 430×932 enlarged-text render/native interaction checks passed. Shared columns, 44-point actions, horizontal bounds and category-to-breakdown navigation were checked.                                    |
| Watch simulator               | German native goals page rendered; 16 assertions passed for supported/unsupported captures, duplicate admission, scoped queues/context acknowledgements, backward-compatible payloads and canonical reveal states.                     |

Review corrected long German category wording, misplaced heading icons, missing
activity metadata, custom-name replacement, misleading optional-only summaries, and
missed Watch sync/accessibility copy. The capture runner now includes both the top
and lower part of the category card; gestures use viewport coordinates to avoid
capturing only the bottom at enlarged text. See the [evidence index](evidence/v39-review-corrections-2026-10-02/README.md).

## Changed surfaces

- Shared Daily Progress activity metadata and server projection regression test.
- Phone `DailyProgressCard`, `DashboardSummaryCard`, `CalorieRingCard`, `DailyProgressScreen`, tracking labels, category projection and typed navigation.
- Watch context/action bridge, identity-pinned tracking API calls, action receipts and unfinished-item projection.
- Native Watch presentation, models/store, mapping/transport, deep links and complication drawing.
- English catalogs, reviewed German overlays, native-copy validator, generator and simulator review harnesses.
- Mobile instructions, review runbook, widget/Watch user guide and dated evidence.

## Remaining release checks

Implementation/local validation is complete; physical-device acceptance is pending.
With matching updated phone and companion builds, verify German pages and Progress X
complication routing, a boolean habit and meal confirmation, phone undo followed by
an old retry, disconnected delivery, phone/Watch restarts, midnight, account switch,
and large-text/VoiceOver traversal. Server persistence from an actual Watch action,
signed entitlements, every scrolled Watch row/dialog and a new full native archive
were not verified. The phone screenshots use isolated in-memory responses and an
existing simulator native binary; they do not exercise the new native event bridge.
Keep the five owner-review items available for that device acceptance.
