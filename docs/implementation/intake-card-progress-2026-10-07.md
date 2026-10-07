# Compact Home intake progress

Implemented on `feat/v45-diary-meals-training-refinement-20261007`, following
`9e9663f81`. The original phone-only refinement shipped in v46; the later optical alignment
follow-up below remains on its separate fix branch.

## Layout and typography

`CalorieRingCard` places Protein and Carbs to the left of the existing 130-point
energy gauge, and Fat and Water to its right. Each small progress display has a
localized label, a four-point rail and a numeric percentage. The ordinary-text
card remains 184 points high, with a 130-point body. The center retains the four
lines intake / of or von / allowance / kcal. Allowance is now 16-point medium
instead of 20-point semibold; intake stays 26-point bold.

Only the intake number gets a subtle green text glow while it is below or equal
to its adjusted allowance, and red above it. Its text stays legible and neutral;
light theme uses a weaker glow. The main card retains its neutral edge treatment.
Protein blue, carbohydrate violet, fat amber and hydration cyan remain stable
categorical colors. Bar fill caps at 100%, while the visible and spoken percentage
can show an excess. No extra text is added below the gauge.

Above font scale 1.3 the existing arc-free, larger numeric layout is retained.
The new side columns are 64 points wide, labels are capped at 1.4 and percentages
at 1.6; the full nutrient name, amount, allowance and percentage remain available
in each accessibility label. The larger target is 20 points, reduced from 24.
The screen scrolls normally. This does not establish a fixed height for all
accessibility sizes.

## Data and component usage

`DashboardScreen` passes the selected day's existing `protein`, `carbs`, `fat`,
`waterConsumed` and `waterGoal` summary. Net carbohydrate display honors the
existing preference and calculation; water amounts use the owner's volume unit.
No query, logging, scheduler, persistence or backend contract was added.

The optional additions to `CalorieRingCardProps` are `protein`, `carbs`, `fat` and
`water` (`MacroSummary`, with `consumed` and `goal`), `waterUnit` and `showNetCarbs`.
Existing callers remain compatible. The local `IntakeProgressBar` is read-only,
not a small touch target. Its animation uses the existing interruptible,
reduced-motion-aware `useTweenedValue` hook.

Known zero intake displays 0%. Missing or invalid values, and missing/nonpositive
goals, display an unfilled baseline and an em dash. Their accessible names
separate unavailable data from known intake without a target. An unset calorie
goal retains the known intake and an explicit localized message, without colored
intake glow. The calorie allowance remains consumed plus remaining, so the
server's exercise adjustment is credited exactly once. Center activation still
opens dated Meals; the separate goal action retains its 44-point target.

## Validation and evidence

- `pnpm run validate` passed in `XoTMobile`: localization overlay/audit, TypeScript,
  lint, formatting, dead-code checks and native brand/button checks.
- Targeted Jest passed: four suites, 23 tests (`CalorieRingCard`, `EnergyGauge`,
  `DashboardReview`, and the nutrition review fixture). New assertions cover
  bounded visual fill with truthful excess percentage, known zero versus unknown
  or missing goals, and the exercise-adjusted green/red threshold.
- Native `DashboardReview.testIntakeCard` passed in all five cases below. It
  asserts the ordinary card/body height, all progress displays inside the card,
  the full card in the viewport, goal target size, and navigation to Meals.
- The simulator captures use current JavaScript in an existing Debug simulator
  app on iOS 26.2, with isolated synthetic in-memory transport. No production
  health data appears in the fixtures or evidence.

| Case | Appearance | Card / body height | Screenshot |
| --- | --- | --- | --- |
| 390-point German | Dark | 184 / 130 pt | [Capture](evidence/intake-card-progress-2026-10-07/390-de-dark.png) |
| 390-point German | Light | 184 / 130 pt | [Capture](evidence/intake-card-progress-2026-10-07/390-de-light.png) |
| 430-point German | Accessibility text, dark | 415.33 / 331 pt | [Capture](evidence/intake-card-progress-2026-10-07/430-de-large.png) |
| 390-point English | Above target, AMOLED | 184 / 130 pt | [Capture](evidence/intake-card-progress-2026-10-07/390-en-over.png) |
| 390-point German | No goals, dark | 184 / 130 pt | [Capture](evidence/intake-card-progress-2026-10-07/390-de-no-goals.png) |

[Native results](evidence/intake-card-progress-2026-10-07/results.json) record each
scenario; accompanying text files retain measured frames. Standard heights are
rounded to avoid subpixel measurement noise. Enlarged height is an observation,
not a measured before/after comparison. The initial enlarged render smoke check
looked only for Calories in the first viewport, where Daily Progress occupies
the screen; the harness now accepts that first-viewport content and lets XCTest
scroll to and verify the intake card.

Physical-device, Android, signed archive and TestFlight checks were not run.
No backend persistence or full release validation is implied by these UI checks.

The independent finish review returned `ship` for this intake-card scope, with no
material fixes. It confirmed the hierarchy, categorical colors, theme material,
nonoverlapping layout and source accessibility. Actual VoiceOver interaction and
historical enlarged-size equality remain unverified.


## Post-v46 optical alignment follow-up

On `fix/intake-gauge-optical-center-20261007`, the ordinary center text group
moves 8 points down to use the arc's open bottom and increase clearance above
the intake number. The four-line hierarchy, type sizes, glow thresholds, side
rails, navigation, 130-point gauge/body and 184-point card remain unchanged.
The arc-free layout above font scale 1.3 receives no translation. No strings,
data contracts or native assets changed.

Mobile `pnpm run validate` passed. Existing targeted Jest suites for
`CalorieRingCard`, `EnergyGauge` and `DashboardReview` passed (3 suites, 16 tests).
Native intake-card interaction checks passed in five simulator cases: German
390-point dark/light, German 402-point dark matching the supplied screenshot's
logical width, German 430-point enlarged text, and English above-target AMOLED.
The ordinary cases measured 184/130-point card/body heights; the existing
enlarged layout measured 415.33/331 points. Visual inspection and an independent
bounded layout assessment found no center-text overlap or material concerns.

[402-point preview](evidence/intake-gauge-optical-center-2026-10-07/402-de-dark.png),
[enlarged-text preview](evidence/intake-gauge-optical-center-2026-10-07/430-de-large.png)
and [results](evidence/intake-gauge-optical-center-2026-10-07/results.json) retain
synthetic native XCTest captures and measurements. Tests used current JavaScript
in an existing Debug simulator binary, not a new signed build. Physical-device,
Android, VoiceOver, signed archive and TestFlight checks were not performed for
this follow-up. No deployment was started.
