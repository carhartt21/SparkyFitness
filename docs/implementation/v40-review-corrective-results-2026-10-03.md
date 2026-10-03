# v40 review corrections

Implemented on `feat/v40-review-corrections-20261003`, based on `0472ee2d8`.
The [reviewed plan](v40-review-corrective-plan-2026-10-03.md) covers all six
X on Track Inbox findings. Five owner attachments were inspected privately;
committed screenshots contain synthetic data only.

## Results

| Finding / priority                         | Result                                                                                                                                                                                                                                                                                                     | Verification                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom check-in tags / retention           | Creating a tag immediately saves an account/server-scoped option in existing device preferences. Deselecting changes the answer only. Historical selected tags recover options. Native text uses the final end-editing value, avoiding stale last characters.                                              | Create, deselect, reopen and reselect pass in German dark/light/enlarged text. Store rehydration, invalid input, duplicate handling, unknown identity and account isolation have regression tests. Only selected tags enter a submitted check-in.                                |
| Gauge text / visual                        | Text is centered inside the measured gauge square rather than placed at a fixed top offset.                                                                                                                                                                                                                | Synthetic known-intake render and existing zero/over-target/unknown calculation tests pass; calorie adjustment policy is unchanged.                                                                                                                                              |
| Main card height / visual                  | Both summaries use the same smaller 144-point visual column, compact padding and 44-point or larger rows. The redundant category footer is removed; the heading still opens all categories.                                                                                                                | Both cards fit below the header and above bottom navigation at 390×844 normal text. Enlarged text stacks and scrolls. Native tests verify column alignment, target sizes and opening a category destination.                                                                     |
| Supplements spacing / visual               | Neutral card borders replace simultaneous colored glows. Show All and settings actions have explicit spacing. The 44-point menu stays beside dose details instead of wrapping below them. The summary places its count/caption below the X at ordinary text sizes; larger text retains the stacked layout. | Populated rows and settings reviewed in German dark/light/enlarged text. Unit tests retain prescription exclusion, tap-only intake and locally queued responses. German status, reminder and accessibility labels were corrected; free-text names and dose units remain literal. |
| Watch intake labels / visual               | Short visible labels (“Essen”, “Aktivität”) retain complete spoken labels and units. Missing data says “Keine Daten”; it does not look like a known zero. Watch app and complication use the phone's categorical macro colors.                                                                             | Actual Watch sources compile and render at 42 mm; known/unknown/over-target captures inspected. Complication sources type-check. Physical complication appearance remains unverified.                                                                                            |
| Watch Daily Goals / existing functionality | Already present in main; no duplicate implementation added. Existing current-day incomplete-goal and permitted-action behavior retained.                                                                                                                                                                   | Native assertions exercise non-completable activity rejection, duplicate capture, account-scoped queues, acknowledgement receipts and refreshed snapshot reconciliation. Real paired delivery remains unverified.                                                                |

## Changes and constraints

Production changes are limited to `DailyCheckInScreen`, the new
`useCheckinTagOptions` hook, `appPreferencesStore`, the two dashboard summaries and
their shared frame, `SupplementsScreen` / `TrackingSummaryCard`, Watch intake and
complication colors, and authored English/German copy. The review runners now cover
custom tags, populated supplement rows and Watch intake states. The Check-In guide
documents the distinction between available tag options and selected answers.

Tag options are **device-local preferences**, scoped to a server/account. Selected
answers still use the existing check-in API. This does not add cross-device option
sync or recover options that were already deselected before this fix; such options
can be created again. A loaded historical entry can recover its selected tags.
No API, database migration, nutrition calculation, notification scheduler or
Watch action outbox was replaced.

## Validation actually run

| Check                                                          | Result                                                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Frozen workspace install                                       | Passed; lockfile unchanged.                                                                                     |
| Final full mobile Jest suite                                   | **543 suites, 7,669 tests passed** (`--watchman=false --runInBand --coverage=false`).                           |
| Targeted phone/store/gauge/hook tests                          | 7 suites, 39 tests passed; included in the final full run.                                                      |
| `XoTMobile/pnpm validate`                                      | Passed: types, lint, unused-code, translation, native geometry/brand, colors and formatting gates.              |
| Authored German overlay check, copy audit and their Node tests | Passed; 10 tests.                                                                                               |
| Native phone summary/custom-tag matrix                         | 3/3 interaction cases passed: German 390 dark/light and 430 accessibility text.                                 |
| Dedicated populated Supplements matrix                         | 3/3 interaction cases passed at the same configurations; final captures reviewed after copy/layout corrections. |
| Native Watch source build/assertions                           | 19 assertions passed; four German state captures inspected.                                                     |
| Watch complication Swift type-check                            | Passed for watchOS simulator; no signed archive produced.                                                       |
| Documentation build                                            | Passed; existing large-chunk warning remains.                                                                   |
| `git diff --check`                                             | Passed.                                                                                                         |
| Backend tests                                                  | Not run: this batch changes no server code or contract.                                                         |

The first supplement capture in the combined phone run used an empty list; it is
not evidence for populated layout. A dedicated fixture and final run cover populated
rows instead. Native input review also exposed the old blur/submission race; the
final end-editing handler and literal-input test resolved it. A successful OCR
smoke check was followed by visual inspection, not treated as visual approval.

## Evidence and remaining acceptance

See [screenshots, provenance and machine-readable results](evidence/v40-review-corrections-2026-10-03/README.md).
Historical dashboard captures are linked as the preceding implementation, not an
exact pixel comparison of v40. The Watch intake before capture is rebuilt from
`0472ee2d8` with the same isolated synthetic values as the after capture.

Unverified: physical phone/Watch sync, actual Watch confirmation dialogs and server
round-trips, signed complication delivery, VoiceOver listening, Android interaction
and a new EAS/TestFlight archive. Native phone checks reuse a compatible development
simulator binary and serve current JavaScript; they do not constitute a signed
release build. Enlarged text intentionally scrolls rather than fitting both cards
on one screen. Inbox tasks remain open for owner device acceptance.

This branch is committed for review. Main, production and TestFlight are unchanged
by this corrective batch.
