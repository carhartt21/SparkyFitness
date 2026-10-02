# v38 food-detail macro fitting — 2026-10-02

The calorie value could exceed its quarter-width column because the centered parent allowed the text to use its intrinsic width. `adjustsFontSizeToFit` did not have a reliable width constraint. The number and unit also used the same large bold font.

## Correction

`XoTMobile/src/screens/FoodEntryAddScreen.tsx` now gives each label and amount the full allocated column width, centers them, and adds four-point horizontal insets. Units use smaller secondary type while numbers retain their emphasis and fit within the bounded single line. The same treatment applies to all four nutrients. Category labels remain above the amounts and goal percentages remain below. Existing two-column wrapping for enlarged text, semantic colors, calculations, servings, and logging are unchanged. No new localization keys are needed.

The simulator runner adds `--food-macro-review`; `review/DashboardReview.swift` exercises search, selection, quantity editing and keyboard dismissal. The large-value case uses an isolated, unsaved synthetic draft solely to stress the layout.

## Evidence and validation

- Food add/view Jest suites: **72 tests passed** in two suites.
- `pnpm run validate`: **passed**, including TypeScript, lint, German localization checks and formatting.
- Normal `expo export --platform ios`: **passed**. Review fixture markers were absent from the exported iOS bundle.
- Impeccable type scan of the changed screen: **no findings**.
- Native XCTest: **3 cases passed**, German 390×844 dark/light and 430×932 accessibility-extra-large dark. Captures were visually inspected: 150 kcal and 15.000 kcal fit inside the calorie column without crossing separators. The enlarged layout uses two columns.

Before evidence: [390 dark](./evidence/v38-ui-refinements-2026-10-02/after-390-de-dark-food-details.png), [390 light](./evidence/v38-ui-refinements-2026-10-02/after-390-de-light-food-details.png), [430 enlarged](./evidence/v38-ui-refinements-2026-10-02/after-430-de-large-food-details.png). No before capture of the long-value stress case exists.

After evidence:

| Case | Normal value | Long value |
| --- | --- | --- |
| 390 German dark | [150 kcal](./evidence/v38-food-macro-fit-2026-10-02/after-390-de-dark-normal.png) | [15.000 kcal](./evidence/v38-food-macro-fit-2026-10-02/after-390-de-dark-long-value.png) |
| 390 German light | [150 kcal](./evidence/v38-food-macro-fit-2026-10-02/after-390-de-light-normal.png) | [15.000 kcal](./evidence/v38-food-macro-fit-2026-10-02/after-390-de-light-long-value.png) |
| 430 German enlarged | [150 kcal, first row](./evidence/v38-food-macro-fit-2026-10-02/after-430-de-large-normal.png) | [15.000 kcal, full macro grid](./evidence/v38-food-macro-fit-2026-10-02/after-430-de-large-long-value.png) |

[Validation manifest](./evidence/v38-food-macro-fit-2026-10-02/validation.json) records the base revision and reviewed source hashes. The native app loads current JavaScript in a development simulator; its synthetic in-memory transport does not verify production persistence. Android, signed TestFlight and physical-device checks were not run for this correction. No merge or deployment was performed.
