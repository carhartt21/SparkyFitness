# Combined integration visual evidence

All images use isolated synthetic food data. Provider food and serving names are fixture strings; they are not untranslated interface copy or personal data. Original reference assets remain unchanged. Base Git revision is `824139c5a` for the final layout matrix.

## Before and after

- [Before: macro hierarchy](before-390-de-dark-macro-hierarchy.png) → [after: German 390-point dark](390-de-dark-food-details-top.png). Macro names are above the amounts/units; goal shares stay last.
- [Before: enlarged quantity clipping](before-430-de-large-quantity-clipping.png) → [after: German 430-point enlarged text](430-de-large-food-details-top.png). The quantity remains readable; amount and unit controls stack with distinct labels. Macros use two columns. Scrolling is intentional.
- [German light](390-de-light-food-details-top.png) and [English dark](430-en-dark-food-details-top.png) retain normal-width hierarchy and categorical macro colors.
- Section and expanded-options images in each matrix case show saved portions, nutrition details and the note field. Long source names wrap instead of overlapping adjacent actions. App-owned German headings are readable.

[`layout-results.json`](layout-results.json) records four render smoke and four native layout-test passes. Screenshots were visually inspected after the automated assertions; OCR alone was not treated as visual acceptance. The quantity and options targets meet the harness's 44-point height checks. Enlarged text is accessibility-extra-large on the disposable 430 × 932 simulator. Normal cases are 390 × 844 and 430 × 932.

The final matrix uses the newly built native simulator app including merged Watch targets, built with Xcode simulator signing. Full `.xcresult` bundles, OCR output and logs remain in `/private/tmp/xot-integration-ui-verified-20260930` on the review Mac. No private-account logs or credentials are committed.

[`food-flow-results.json`](food-flow-results.json) records two final render and native interaction passes against the same fresh simulator app. Search → 200 g → long note with keyboard → Save → Diary → edit to 100 g → delete passed in German 390-point and English 430-point cases. Hydration/exercise Details destinations were also checked. Per-case `food-flow-events.json` contains synthetic mutation acknowledgements: the complete note and quantities are retained and daily intake reconciles 600 → 900 → 750 → 600 kcal. Keyboard, portion and edited-entry screenshots are included. Full run artifacts remain in `/private/tmp/xot-integration-food-flow-20260930`. Synthetic acknowledgements do not verify backend persistence or physical Watch/HealthKit integration.
