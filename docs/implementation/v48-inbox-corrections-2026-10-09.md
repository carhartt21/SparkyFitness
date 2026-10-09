# v48 Inbox corrections

The owner approved implementation and automatic release after the planning round.
All eight issues were implemented in the planned dependency order on
`feat/v48-inbox-corrections-20261009`.

| Issue                           | Result                                                                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Return after food logging       | Search, scan, photo and quick-add return to the same mounted meal/date; basket depth and independent flows retain their existing semantics.                                                                                                |
| Meal tap and drag               | Preset rows open details in edit mode and expose the same drag handle. Server moves parent and components atomically, preserving nutrient snapshots and enforcing ownership/source restrictions.                                           |
| Missing preset images           | The collapsed entry projection retains recorded and template image fields for the existing resolver.                                                                                                                                       |
| Collapsed meal previews         | Up to three distinct thumbnails, an additional-item count and an accessible expand action; no preview on empty groups.                                                                                                                     |
| Favorites/custom rows/quick-add | Actual account-local 28-day consumption ranks favorites before the Watch eight-item cap. Long preset names wrap above metadata. Search and Favorites offer one documented preset portion, with detail fallback and duplicate-submit guard. |
| Manual supplement time          | Confirmation starts with fresh exact account-local time, provides Now and quarter-hour choices, rejects future/DST-gap times and preserves scheduled versus additional status. Cancellation writes nothing.                                |
| Back/day navigation             | A shaft Back arrow differs from compact calendar chevrons through existing header APIs. Native header/gesture rules are preserved.                                                                                                         |
| Habit Save contrast             | Save inherits shared button foreground for enabled, disabled and pending states instead of forcing black text.                                                                                                                             |

The attachment review confirmed that the original Save problem was in the habit
count editor and the drag problem involved whole preset meals. No new dependency,
migration, authentication change or Watch payload field was required. Favorite
metadata is additive and validated through the shared schema by both clients.

## Verification

[Sanitized checks](evidence/v49-release-2026-10-09/validation.json) record full phone
validation and 580 suites / 7,945 tests, plus the final three search suites / 49
tests after the Favorites path and separate translation key were corrected.
Frontend validation and five affected suites / 21 tests passed. Server validation
passed; backend suites remain skipped at the owner's request. An isolated real
PostgreSQL smoke exercise verified atomic moves, unchanged nutrition, owner/source
rejection and ranking boundaries; the actual Favorites HTTP router also returned
typed metadata and isolated unrelated owners with the production permission
middleware. The smoke supplies a synthetic authenticated caller only on loopback;
it does not verify production login.

German native rendering and the daily-details interaction smoke passed at normal
dark/light and enlarged dark text sizes. The images use synthetic data. Enlarged
summary tables deliberately stack instead of overlapping. These checks use the
current JavaScript changes with the existing simulator application; signed phone
and Watch compilation is a release-build gate. Normal iOS export and documentation
build passed. The reviewed German overlay and button/header checks remain intact.

## Remaining physical acceptance

Real-device gesture cancellation and scroll-edge drag, real-transport scroll
restoration, paired Watch ordering/offline replay, backdated supplement history,
VoiceOver and Android checks remain separate acceptance items. Todoist items stay
open pending those outcomes. No task completion is inferred from Jest or OCR.

Current usage is documented in [Meals](../src/features/diary/meals.md),
[Food Search](../src/features/food/food-search.md) and
[Supplements](../src/features/supplements.md). Delivery is tracked in
[v49 release](v49-release-2026-10-09.md).
