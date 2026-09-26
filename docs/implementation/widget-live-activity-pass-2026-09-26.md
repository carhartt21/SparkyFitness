# Widget and Live Activity pass

Scope: iOS Home/Lock Screen widgets and workout/movement-break Live Activity
layouts. This is a targeted native review, not a new widget family or a release.

## Findings and corrections

| Finding | Evidence | Correction |
| --- | --- | --- |
| The inline nutrition Lock Screen accessory showed a capture label but had no explicit tap destination. | `nutritionEngagementWidget.swift` inline branch; the circular and rectangular branches already linked to photo capture. | Added `widgetURL(photoURL)` to the inline label, using the existing `meal-photo` route. |
| A paused workout recovery continued to show a ticking workout clock in the small banner and compact Island. | The `paused` phase carried a frozen `pausedRemainingLabel`, but those two regions only froze on `complete`. | Both regions now show the frozen remainder during pause. |
| The compact Island could lose its leading identity before the shared app icon became available; a long workout title could crowd the expanded leading region. | The compact branch used `appIcon(24)` without fallback, while minimal/expanded already had one. | Added an SF Symbol fallback and single-line scaled title. |
| The movement-break Live Activity had no bounds for long translated labels or its timer. | Banner and expanded regions used unrestricted text and timer width. | Limited the title/subtitle to one line and capped the timer slot with scale fallback. |
| The Calories widget picker description named intake alone, although the widget leads with remaining energy and includes activity. | The [simulator preview before the copy fix](evidence/widget-live-activity-pass-2026-09-26/calorie-widget-preview-before-copy.png) showed this mismatch. | Corrected the English native description and English fallback to name food, activity, and remaining energy. |

The widget deep links keep the existing authentication and server-selection gates.
The approved X on Track icon and current bundle/widget identifiers are unchanged.

## Verification

| Check | Result |
| --- | --- |
| Clean iOS Expo prebuild and local simulator build | Passed; zero errors, two pre-existing Xcode warnings. |
| Incremental native build after movement-break layout fix | Passed; zero errors, one pre-existing script dependency warning. |
| Full mobile Jest suite after Swift/widget and workout changes | 484 suites, 7,251 tests passed. |
| Focused movement-break and widget tests after final layout change | 4 suites, 45 tests passed. |
| TypeScript, scoped ESLint and Prettier, native locale validator | Passed; locale validator still reports existing untranslated locales. |
| 430-point iOS simulator system widget picker | X on Track appears in search with the approved icon; [search](evidence/widget-live-activity-pass-2026-09-26/widget-picker-search.png) and [Calories preview](evidence/widget-live-activity-pass-2026-09-26/calorie-widget-preview-before-copy.png) captured. |
| Lock Screen accessory placement and tap routing | Unverified: the simulator picker probe did not place an accessory. |
| Workout and movement-break Live Activity presentation on Lock Screen/Dynamic Island | Unverified without an authenticated synthetic live session in the simulator or a new physical build. |

The system-picker screenshot uses only simulator data. The development-only
SpringBoard probe was removed after capture; it is not part of the normal UI
test runner. A physical TestFlight pass should place the nutrition and routine
accessories, tap each, and review workout active/resting/paused/complete plus
movement-break compact/expanded states with long German labels.

The translated Calories descriptions in non-English native resources still
describe intake alone. They need localization review; only the English source
and fallback were edited in this pass.
