# Nutrition flow simulator gate — 26 September 2026

The follow-up to Dashboard build 10 exercises the real mobile screens with an isolated in-memory nutrition fixture. The base revision in results.json is `4922fa1e0`; captures include the accompanying hook, screen and review-harness changes in this commit series. Images and mutation summaries contain synthetic data only.

## Implemented and verified

- XCTest passes the full flow at **390×844 German dark** and **430×932 English dark**: Dashboard → food search → synthetic yogurt → 200 g → 442-character note above the keyboard and floating Save → save → Diary → quantity edit to 100 g → delete → Diary with the row absent.
- Seven Dashboard render smoke scenarios pass: the two above, German light, German enlarged text, empty day, over-target AMOLED and summary error. The other five cases do not execute nutrition interactions.
- Mutation evidence verifies one created entry, full note retention through quantity edit, and deletion followed by refreshed summaries. Fixture unit tests reconcile baseline 600 kcal → 900 after adding 200 g → 750 after editing to 100 g → 600 after deletion. Inspected UI captures show 900 kcal in Diary, 150 kcal for the edited entry, and 600 kcal after deletion.
- The initial keyboard capture showed the lower note lines hidden behind the floating action. The fix measures that action in the same native window as the note. Manual scrolling suspends automatic correction until typing/focus resumes; hide, blur and drag invalidate queued frames and native measurements.
- The independent finish review identified scroll trapping, a keyboard-dismissal race and a premature post-delete capture. All three were corrected; narrow re-review found no remaining blocker. The final native run includes those corrections.
- TypeScript, changed-source ESLint and 50 focused Jest tests in four suites pass. Three runtime-detection tests pass. Normal iOS export passes with no `ui-review.invalid`, synthetic yogurt, `END-REVIEW` or `review-created-` markers. `git diff --check` passes.

## Images and interpretation

`390-de-before-keyboard-fix.png` is the failing capture from the initial flow run. The two `*-food-note-keyboard.png` images are the corrected result. Other named captures cover search, portion, saved Diary, edited entry and Diary after deletion. PNG checksums are in screenshots.sha256.json. `*-mutations.json` condenses the corresponding simulator audit events; it does not represent production writes.

The standalone Diary and Add Food references in the supplied archive were extracted and visually inspected. This batch establishes interaction evidence and fixes note occlusion; it does **not** claim the remaining Diary/Add Food composition matches the references. The approved brand, existing calculations and API contracts are unchanged.

## Prioritized next corrections

| Priority | Observed issue | Evidence | Correction and verification |
| --- | --- | --- | --- |
| P1 | Mixed and malformed German food-flow copy | German captures include “Food hinzufügen”, “Log to”, “Neinte für this entry”, “Add food” and mixed exercise guidance | Audit the complete food flow's static keys and German catalog; retain literal user food names. Add focused localization checks and review German captures. |
| P2 | Diary quick actions dominate the first viewport | `390-de-dark-diary-after-delete.png`; three vertically stacked large actions before meals | Compact action hierarchy and meal-first layout following standalone Diary reference; keep every existing destination accessible and verify 44-point targets and large text. |
| P2 | Narrow nutrient labels and excessive food-detail header space | Portion/edit captures; German long labels and large title/photo section | Adapt nutrient rows and title/photo hierarchy to available width; verify long names and enlarged text at both viewports. |
| P2 | Repeated Add Food action in wide keyboard state | `430-en-dark-food-note-keyboard.png` shows inline and floating actions | Clarify action hierarchy while preserving reachable Save; rerun the complete keyboard flow. |
| P2 | Food search hierarchy still differs from reference | Both food-search captures | Improve search/filter/recent hierarchy and verify scan/photo/manual paths remain reachable. |

## Unverified and bounded claims

The transport uses memory and resets for each scenario. Authentication, real backend persistence, relaunch retention, offline replay, editing a note with the keyboard open, camera permissions, HealthKit and Watch are not established by these tests. Native keyboard is configured on the simulator, not locale-translated by the app. The edited-entry screenshot is taken during keyboard dismissal; it verifies the displayed quantity/calories, not a settled-keyboard visual gate. OCR checks expected rendering and known runtime/debug failures, not visual fidelity. No claim of full localization or full accessibility conformance is made.

Reproduce using `SparkyFitnessMobile/review/README.md`. Raw Metro/native logs and xcresult bundles are retained locally under `/tmp/xot-nutrition-flow-final`; only portable synthetic evidence is committed.
