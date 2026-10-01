# Food amount input and named servings — 2026-10-01

Implemented on `fix/food-serving-unit-conversion-20261001`, based on `a37673dfc` (the completed medication/supplement and food UI batches). The main checkout's unrelated Watch workout-energy changes were not edited. This batch has not been merged, published or deployed.

## Verified cause

`buildServingOptions` correctly preserves a saved portion's label and underlying quantity/unit. A portion labelled “Slice (7.1 g)” can therefore have `serving_size: 7.1` and `serving_unit: g`. `FoodEntryAddScreen` passed that canonical gram quantity straight to `AmountWheel`, although the adjacent selector described an entire slice. Entering `2` consequently meant two grams instead of two slices.

A regression test reproduced the discrepancy: choosing the slice displayed **7.1**, rather than **1**.

## Correction

The amount field displays and accepts a count of the selected saved portion, including fractional counts. Its input is converted to the underlying variant unit before existing nutrition calculations and submission paths use it. Grams/ml selections retain direct quantity entry. Unsaved adjusted-unit overrides retain their existing direct-unit behavior.

| Selection       | Entered amount | Total and saved quantity |
| --------------- | -------------- | ------------------------ |
| Slice (7.1 g)   | 1              | 7.1 g                    |
| Slice (7.1 g)   | 2              | 14.2 g                   |
| Slice (7.1 g)   | 0,5            | 3.55 g                   |
| Glass (200 ml)  | 2              | 400 ml                   |
| Pair (2 slices) | 2              | 4 slices                 |

The saved variant still supplies the nutrition denominator. Two slices containing 24 kcal each display 48 kcal and submit `quantity: 14.2`, `unit: g` against the 7.1 g variant. Reopening an existing 14.2 g quantity on that portion displays **2**; it does not rewrite the saved record.

The wheel increments in portions for portion selections. Changing units resets its open editor, preventing the previous unit's typed draft from remaining visible. Conversion back to grams no longer rounds half a 7.1 g slice to 3.6 g; it retains 3.55 g at the existing four-decimal display precision. Invalid input remains blocked, including when Save is pressed before keyboard dismissal. Quick-add continues to submit canonical quantities directly.

No API, database, provider, historical snapshot, persisted unit or calorie-target policy changed. No new user-facing copy or localization keys were introduced.

## Validation

Machine-readable results: [validation.json](evidence/food-serving-unit-conversion-20261001/validation.json).

- **12 new screen regressions** cover portion counts, nutrition scaling, decimal-comma fractions, focused saves, unit conversion, quarter-portion stepping, reopened quantities, quick-add, invalid drafts, ml portions and multiple-piece portions.
- Targeted screen, wheel, serving-option, numeric-input, add-entry hook and meal-builder tests: **7 suites, 129 tests passed**.
- Full mobile Jest suite with CI coverage: **519 suites, 7,489 tests passed**.
- Locale generation, reviewed German overlay/copy checks, TypeScript, lint, i18n audit, Knip, native locales, Watch geometry and package formatting passed. The unchanged `pnpm run validate` wrapper encountered the environment's `tsx` IPC `listen EPERM` restriction. All steps passed using the equivalent sequence with `node --import tsx scripts/generate-watch-progress-x.mjs --check` for geometry; the standard wrapper is recorded as blocked.
- `git diff --check`: passed.

## Remaining verification

No physical-device, simulator rendering, signed native build, live API save or deployment was performed. On the next device build, select a named gram portion, enter two servings, confirm total weight/nutrition, save and reopen the diary entry. Also verify decimal-comma fractions and switching units with the keyboard open. Automated checks use synthetic fixtures rather than the user's food data.
