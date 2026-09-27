# Dashboard header refinement — synthetic iOS review

The iOS 26 Dashboard used an expanded native title row above its date controls. On a 390-point screen the energy card began roughly 52 points lower than necessary, and the large title did not show the approved logo. The compact header now places the logo and explicit selected date on the same row. The energy card begins directly below it; date navigation and the four logging actions remain available.

- [Before, 390-point German dark](before-native-390-de.png)
- [After, 390-point German dark](after-native-390-de.png)
- [After, 430-point German enlarged text](after-native-430-de-large.png)
- [Training details reached from Dashboard](exercise-details-safe-header.png)

Captures use the repository's isolated synthetic UI review app and contain no account data. The 430-point capture uses iOS accessibility-extra-large text. Energy and nutrient metrics cap display scaling to retain a useful first viewport while still enlarging; all content remains vertically scrollable. The review harness now has a `--native-tabs` option so this iOS header path can be checked separately from the fallback tab bar.

Validation: mobile typecheck, lint, i18n audit, targeted Dashboard/review/navigation tests, iOS native-tab render smoke at 390-point German, 430-point English, and 430-point German enlarged text, and native Dashboard interaction checks passed. The interaction run covered date navigation, the four quick actions, hydration and training details, and the Training back action. The Training header uses its localized title and a minimal back control; the prior back label incorrectly named the Library. The fallback tab-bar render smoke also passed. The physical iPhone appearance remains a separate device check.
