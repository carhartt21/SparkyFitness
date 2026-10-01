# Food controls and German localization — 2026-10-01

Branch: `fix/food-ui-localization-20261001`, based on `main` at `53c7092ef`.
Implementation followed the three Todoist tasks in order. The separate
`fix/watch-workout-energy-20261001` checkout and its uncommitted work were left intact.
No merge, deployment or mobile publication was performed.

## Findings and corrections

| Priority | Task / evidence                                                                                                                                                                                                                                                | Correction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Verification                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | [Amount spinner](https://app.todoist.com/app/task/6hfxgV8Q8rrmXPff): reported scrolling conflict; the old `PanResponder` acquired the field immediately and changed quantity after six points of movement.                                                     | Tap for numeric entry; hold 400 ms before vertical dragging adjusts quantity. Ordinary movement before the hold belongs to scrolling. Visible German instructions explain both actions.                                                                                                                                                                                                                                                                                                                                               | Grid bounds, decimal and invalid drafts, latest values, disabled gestures and VoiceOver regression tests. Native gesture arbitration remains unverified.                               |
| Medium   | [Translation/layout](https://app.todoist.com/app/task/6hfwjgmhmMc5WmWf): all three attached screenshots inspected, including “Lasse set”, “End Training”, the misleading previous-set heading, squeezed serving headings and the overlapping Food Edit header. | Reviewed 168 German strings in workout, photo and serving flows. “Reduktionssatz”, “Satz hinzufügen”, “Übung hinzufügen”, “Training beenden” and “Vorher”; a dedicated compact “Wdh.” column avoids shrinking the full repetitions label elsewhere. Cancel becomes an accessible dismiss icon; Save retains its label. Header titles receive only space left between actions. Serving add becomes a labelled 44-point icon; full-width descriptions and a two-column nutrient preview replace narrow text columns and font shrinking. | German catalog and plural tests, serving preview recalculation/selection and existing food form, quantity-entry, workout-card and header tests. Native screenshots remain unavailable. |
| Medium   | [Watch meal names](https://app.todoist.com/app/task/6hfwjmgrGW3Wvpp7): the phone context used raw server names rather than the phone Diary’s localized meal labels.                                                                                            | `buildWatchMealTypes` reuses `getMealTypeDisplayLabel`. System meals follow the app language; account overrides and custom names stay literal. Meal IDs and the logging protocol are unchanged. The existing locale-dependent context callback refreshes labels after a language change.                                                                                                                                                                                                                                              | German/English payloads, stable IDs, custom names, account overrides, empty lists and existing meal/Watch-food tests. Physical phone–Watch delivery remains unverified.                |

The exercise names supplied by users/providers are intentionally unchanged.
The short repetitions heading has its own key; other screens retain the full label.
Food quantities, nutrient calculations, serving records, save callbacks, snapshots,
authentication and the Watch outbox are unchanged.

## Changed surfaces

- `AmountWheel.tsx` and `FoodEntryAddScreen.tsx`: intentional gestures and instructions.
- `useScreenHeader.tsx` and `foodForm/EditFoodMode.tsx`: bounded title layout, stable test identifiers and compact cancel action.
- `foodForm/ServingSizesEditor.tsx`: heading/action separation, readable preview and accessible add action.
- `ActiveWorkoutExerciseCard.tsx`: dedicated compact repetitions heading.
- `localization-overrides/de/mobile.json`, English source and applied German catalog: reviewed product copy, protected from translation-sync replacement.
- `watchFoodShortcuts.ts` and `useWatchCheckInBridge.ts`: localized context projection.
- Four new regression suites, existing header regression and the native food-details review gate.

## Validation

The final full mobile suite passed **518 suites / 7,463 tests**, with no skipped or
failed tests. It ran after the last layout correction; its result is recorded in
[verification.json](evidence/2026-10-01-food-ui-localization/verification.json).

Mobile type checking, lint, compiler lint, German copy/overlay checks, i18n checks,
Knip, native locale checks and formatting passed. The normal `validate` wrapper
reached the Watch geometry check but its `tsx` CLI failed to create an IPC socket
in this sandbox (`listen EPERM`). The identical geometry checker passed with
`node --import tsx scripts/generate-watch-progress-x.mjs --check`; formatting was
then run separately. This is an environment limitation, not a passing wrapper exit.

`xcrun swiftc -parse review/DashboardReview.swift` passed. The review runner’s three
runtime-error detection tests passed. These verify syntax/detection, not rendering.

## Native review limitation and release checks

CoreSimulator could not enumerate runtimes/devices: its service connection became
invalid and returned connection refused. Automatic approval review separately
rejected Simulator UI access: “Computer Use was not approved to use Simulator”.
There are **no new before/after screenshots** and no claimed visual/device passes.
Todoist remains open for native acceptance, with implementation/testing comments.

The food-details XCTest now checks scrolling from the quantity field without a
quantity change, deliberate hold-and-drag, header bounds, and the serving-add
target. Run it on the normal and enlarged German cases when access is available:

```sh
node scripts/review-ios.mjs \
  --app /absolute/path/to/CompatibleSignedSimulator.app \
  --output /private/tmp/xot-food-ui-review \
  --case '390-de-dark|390-de-light|430-de-large' \
  --interactions --food-details-review
```

Review the captured Food Edit heading, portion controls and nutrient labels at
390×844 and 430×932. Check live workout and the set-type menu in German; the
existing fixture does not seed an active workout for a visual review. On the
paired Watch, foreground the German phone app, open food logging and confirm
localized system meals, literal custom names, and logging to the selected meal.
The existing save/edit/delete fixture flow remains a separate gate.

Only synthetic fixtures were added. The owner’s screenshot attachments were
inspected through Todoist and were not copied into the repository.
