# Meal actions from Goals and German empty states

Branch: `fix/meal-goal-actions-20261002`. Based on `main` at `899ac67bc` (v38).

## Findings and corrections

| Priority | Evidence                                                                                                                                                 | Correction                                                                                                                        | Verification                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| High     | Goals opens `MealTypeDetail`, which previously had no meal-state action. Its empty state returned before rendering meal content.                         | Keep the detail destination and reuse the Diary's compact `MealStatusControl` on both populated and empty meals.                  | Real React Query hooks in screen tests; native Goals → empty meal → change → Goals → reopen. |
| Medium   | German catalogue contained “Nein … foods,” “Wird geladen meal…” and “Nein Server configured.” Custom meal names were lowercased.                         | Reviewed German overrides for empty/loading/disconnected states and “Lebensmittel”; preserve literal custom names.                | German screen test and rendered dark/light captures.                                         |
| Medium   | First native long-press check showed menu rows visually but not in the accessibility hierarchy. The sheet library defaults to grouping the entire sheet. | Set the shared ActionSheet container `accessible={false}` and mark its title as a header, exposing each existing labelled button. | Component regression test; native selection by the row's accessibility identifier.           |
| Medium   | Initial rendered date hint read “Am Heute.”                                                                                                              | Use “Für diese Mahlzeit wurden noch keine Lebensmittel erfasst ({{date}}).”                                                       | Final native screenshots.                                                                    |

## Behavior and data

Tap cycles pending → complete → incomplete → skipped → pending. Hold opens direct choices, including reset once a status is set. These are explicit user decisions; logged food does not imply completion, and an empty meal does not imply it was skipped.

The screen uses the existing selected calendar date and canonical meal-type ID, `useMealTrackingStatus` and `useSetMealStatus`. The latter updates the shared meal-status cache and invalidates the Daily Progress family, so Diary and Goals reuse the same state. No API, schema, database or notification changes were introduced.

A loading or failed status read never fabricates a pending state. A read failure offers Retry; a failed save keeps the last persisted state and displays the existing localized error snackbar. Saves disable the control to prevent repeat taps. Historical/aggregate groups without a current tracked identity do not offer a status write. The empty content scrolls for enlarged text and offers Add Food with the same date and resolved meal ID.

## Validation actually run

- Mobile `pnpm run validate`: passed, including typecheck, lint, German overlay/copy checks, i18n audit, unused-code, native locale/Watch geometry and formatting gates. Existing non-German native translation-coverage reports remain informational.
- Four focused Jest suites: **42 passed** (`MealTypeDetailScreen`, `MealStatusControl`, `ActionSheet`, isolated nutrition fixture). They cover canonical/custom/historical identities, empty German copy, status writes, cache refresh, read retry, failed save, duplicate-tap protection, normal food navigation and fixture isolation by day.
- Native XCTest: **3/3 passed** on iOS 26.2 using current JavaScript and an existing compatible development simulator app. German 390×844 dark/light and 430×932 with accessibility-extra-large Dynamic Type. The status control meets 44×44 points. Long-press menu actions are individually exposed and selectable. Returning to Goals reflects the saved status and reopening the meal retains it in the fixture.
- Manual inspection of final empty-state and menu screenshots: text contrast follows the existing theme, normal-size controls fit, and enlarged text wraps vertically. Enlarged content requires scrolling; the menu title ellipsizes while its action labels remain readable.

## Evidence and limits

All committed images contain synthetic simulator data. The captures show the new implementation, not a screenshot comparison with installed v38. Before-state evidence comes from the user report and the inspected source/catalogue.

- [Dark empty meal](evidence/meal-goal-actions-2026-10-02/390-de-dark-meal-empty-pending.png)
- [Light empty meal](evidence/meal-goal-actions-2026-10-02/390-de-light-meal-empty-pending.png)
- [Status choices](evidence/meal-goal-actions-2026-10-02/390-de-dark-meal-status-choices.png)
- [Updated Goals](evidence/meal-goal-actions-2026-10-02/390-de-dark-meal-goals-updated.png)
- [Enlarged text](evidence/meal-goal-actions-2026-10-02/430-de-large-meal-empty-pending.png), [enlarged menu](evidence/meal-goal-actions-2026-10-02/430-de-large-meal-status-choices.png)
- [Simulator results](evidence/meal-goal-actions-2026-10-02/simulator-results.json), [validation summary](evidence/meal-goal-actions-2026-10-02/validation-results.json)

Full local native logs, audit events and `.xcresult` bundles are in `/private/tmp/xot-meal-goal-ui-20261002-final`; test and validation logs are `/private/tmp/xot-meal-goal-tests.log` and `/private/tmp/xot-meal-goal-validate.log`.

Physical iPhone/Watch checks, real server persistence, offline mutation replay and restart persistence were **not performed**. Backend tests were not run because this change uses unchanged contracts. No merge, deployment or TestFlight publication was performed.
