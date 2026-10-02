# v38 mobile UI refinements

Branch: `feat/v38-review-corrections-20261002`. Previous task completed first in `b6a807e68` (`fix(mobile): constrain workout plan time entry`): optional 24-hour session time selection/confirmation/clearing, including enlarged text. Its evidence remains in the [v38 corrections record](v38-review-corrections-2026-10-02.md).

This follow-up uses the supplied review screenshots as defect evidence and keeps the current identity, data calculations, destinations and logging behavior. “Meal item screen” is interpreted as the food-details screen shown in the supplied amount-keyboard image. No server changes, migrations, merge or publication are part of this batch.

## Prioritized findings and corrections

| Priority | Observed evidence                                                                                                                                                                                                           | Correction                                                                                                                                                                                                                                                               | Verification                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| High     | Food quantity editing displayed our localized actions above a second English “Done” toolbar. React Native's installed iOS TextInput implementation creates that toolbar for decimal pads requesting `returnKeyType="done"`. | Remove the redundant numeric return-key request. Keep the existing shared Done/Add bar, decimal drafts and modal keyboard provider. Initialize visibility from the current keyboard state and expose actions on `willShow` as well as `didShow`.                         | Numeric-input regression, mounted-open-keyboard regression, native panel/frame check, long-note save acknowledgement.         |
| Medium   | Food Settings put an unconstrained long label beside a shrinking picker; the selected option broke within words. Visible German copy contained mixed English/German fragments.                                              | Stack both name-search and barcode provider labels above full-width selectors. Add reviewed German overrides for all adjacent defective Food Settings text.                                                                                                              | Existing provider/preference tests, German override check, light/dark and enlarged-text native captures.                      |
| Medium   | Daily Progress showed the generic checklist for every habit despite stored icons for strength, reading and evening routines. A tiny X headed a full-width list.                                                             | Use the configured habit icon by stable source ID through the existing cached habits query. Other rows use their real domain/objective/training category. Place the larger X/count on the left and the next three actionable tasks on the right; stack at enlarged text. | Icon metadata/fallback regressions, existing loading/stale/empty/resolved/action tests, native destination check and renders. |
| Medium   | The energy card had a tall heading row, a goal action in the heading and vertically centered supporting values.                                                                                                             | Reduce heading spacing, top-align the right-side values and move the 44-point goal icon below the gauge. Its open lower arc provides space for the action without widening the card.                                                                                     | Energy balance/destination tests and native captures. Intake, base target, burn and credited allowance remain distinct.       |
| Low      | Supporting food detail rows competed with prominent food and nutrient values.                                                                                                                                               | Step brand/field/destination captions down to the established small type, and portion/expanded detail rows down one type level. Keep numeric inputs, primary actions and nutrient amounts prominent; retain font scaling and scrolling.                                  | Food detail/selection tests and native default/enlarged-text captures.                                                        |

## Changed surfaces

- `XoTMobile/src/components/CalorieRingCard.tsx`, `DailyProgressCard.tsx`, and `tracking/progressTaskIcons.ts`: compact energy layout and semantic task preview.
- `XoTMobile/src/screens/FoodSettingsScreen.tsx`, `FoodEntryAddScreen.tsx`, `components/AmountWheel.tsx`, and `SetRowChrome.tsx`: selector layout, food typography and one localized keyboard bar.
- `XoTMobile/src/hooks/useKeepNoteVisible.ts`: reuse the existing measured visibility correction for the amount field and note; retain blur, hide and manual-scroll cancellation. Food View keeps using the same helper.
- `localization-overrides/de/mobile.json` and its generated mobile German catalog: reviewed, durable German copy.
- Focused component/screen tests, `review/ReviewApp.tsx`, `review/DashboardReview.swift`, `scripts/review-ios.mjs` and the [review guide](../../XoTMobile/review/README.md): repeatable isolated native checks.

Habit names remain literal personal data; icons are not inferred from their language or words. Missing/unknown habit metadata uses the existing generic fallback. The extra read reuses the existing account-scoped query/cache and is enabled only when habit tasks exist. No persistence stack or aggregate health score is added. Existing nutrient colors and canonical progression-X geometry are unchanged.

## Evidence and validation

[Evidence directory](evidence/v38-ui-refinements-2026-10-02/) contains original synthetic native screenshots, capture/source metadata, keyboard geometry measurements and the validation summary. The before captures are from the preceding committed implementation plus a nonvisual test identifier. User clipboard images, account data, videos, full xcresult bundles and generated build output are not committed.

The native geometry gate compares the action bar with the **OS-reported keyboard panel**. XCTest's key-region frame excludes panel padding and is not the keyboard backdrop's upper edge. Hidden software-keyboard runs were rejected; the dedicated simulator's visible keypad was enabled before the final checks. The gate retains a two-logical-point tolerance, rejects a duplicate English “Done,” and checks the note remains above the entire action bar. Review-only keyboard geometry is sent to the loopback fixture harness, never a production endpoint.

The screenshot review caught an enlarged-text defect that the initial action-only test missed: stacked Done/Add buttons could cover the note's last line. The test had compared the field with the lower Add button. The corrected gate uses the whole bar's top edge, and the screen reserves the bar's measured height in both keyboard-aware scrolling and content padding. A focused native diagnostic showed that the layout-mode keyboard spacer contracted while the multiline note updated, clamping the scroll range and leaving the note below the buttons. Food Details now lets UIKit own iOS keyboard insets, while Android keeps controller scrolling. The existing visibility helper measures whichever field is focused, so both the amount and note stay above the measured bar with a standard 16-point clearance. The inner Touchable owns shared keyboard actions; the glass surface is decorative. Focused post-correction keyboard/save checks cover the normal and enlarged-text device classes; their captures replace the initial food-keyboard captures in the evidence directory. Temporary geometry diagnostics were removed; no note text was logged.

Validation results are recorded in [validation.json](evidence/v38-ui-refinements-2026-10-02/validation.json). All **120 tests across 10 focused suites** pass; the mobile validation wrapper and production iOS JavaScript export pass. The final keyboard flows pass in German dark/light at 390×844 and enlarged German dark at 430×932. The shared visibility helper also retains the existing food-view regressions. The focused suite covers food selection/quantity, provider preferences, energy semantics/destinations, task states/icons, shared accessory actions and note visibility. The production iOS JS export uses the normal entry point, independent of the development-only review transport.

Native writes in this gate are acknowledged by an isolated in-memory fixture; they do not establish production database persistence. Physical iPhone/Watch, Android keyboard geometry, signed device archives and a fresh TestFlight build remain separate checks. Backend tests were skipped as requested; no backend behavior changed.

### Repeatable checks

From `XoTMobile/`:

```sh
pnpm exec jest --runInBand --coverage=false \
  __tests__/components/CalorieRingCard.test.tsx \
  __tests__/components/DailyProgressCard.test.tsx \
  __tests__/components/progressTaskIcons.test.ts \
  __tests__/components/AmountWheel.interactions.test.tsx \
  __tests__/components/SetRowChrome.test.tsx \
  __tests__/hooks/useKeepNoteVisible.test.ts \
  __tests__/hooks/useProgressActions.test.ts \
  __tests__/screens/FoodSettingsScreen.test.tsx \
  __tests__/screens/FoodEntryAddScreen.test.tsx \
  __tests__/screens/FoodEntryViewScreen.test.tsx
pnpm run validate
pnpm exec expo export --platform ios --output-dir /tmp/xot-ui-export
```

The original three-case native run covers dashboard, task navigation, provider and food-detail layouts. Its lower-Add-button note gate was inadequate and is explicitly superseded by the focused final keyboard runs. Repeated numeric Done taps failed to reach the React Native handler despite correct visible bounds; merely changing the test tap point did not repair them. Shared keyboard actions now use the existing native Gesture Handler touchable. Failed attempts remain failures, not renamed passes. The exact native hit-testing cause is not claimed. The final focused gate verifies numeric dismissal, no duplicate toolbar, panel attachment, whole-note visibility and acknowledged save.

| Surface                         | Before (390, German light)                                                             | After (390, German light)                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Dashboard energy / task preview | [Before](evidence/v38-ui-refinements-2026-10-02/before-390-de-light-dashboard.png)     | [After](evidence/v38-ui-refinements-2026-10-02/after-390-de-light-dashboard.png)     |
| Provider settings               | [Before](evidence/v38-ui-refinements-2026-10-02/before-390-de-light-food-settings.png) | [After](evidence/v38-ui-refinements-2026-10-02/after-390-de-light-food-settings.png) |
| Food details                    | [Before](evidence/v38-ui-refinements-2026-10-02/before-390-de-light-food-details.png)  | [After](evidence/v38-ui-refinements-2026-10-02/after-390-de-light-food-details.png)  |

The baseline capture flow stopped before numeric keyboard testing, so no baseline keyboard pass or capture is claimed. Final normal and enlarged keyboard captures are in the evidence directory.

The native touch adapter was chosen with [Reanimated's animated-transform touch guidance](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/) as a behavioral reference. No feature flags, dependencies or native project settings were changed. The evidence here establishes the tested interaction behavior; it does not prove which internal native fast path caused the missed taps.
