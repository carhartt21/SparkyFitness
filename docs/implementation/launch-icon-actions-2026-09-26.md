# Launch-icon quick actions

Request: add quick context actions to the launch icon. Todoist task:
https://app.todoist.com/app/task/6hcv6rvCm4PWGH97.

## Scope and behavior

The supplied YAZIO screenshot was visually inspected. Use the operating system's
context menu with four generic, translated actions and native icons:

| Action | Existing destination | Date |
| --- | --- | --- |
| Scan Food (DE: Barcode scannen) | FoodScan, barcode mode | Local today |
| Add food | FoodSearch | Local today |
| Add activity | ActivityAdd | Local today, unless explicitly resuming a draft |
| Measurements | MeasurementsAdd | Local today |

No entry is saved by selecting a shortcut. Native menu sizing, typography, motion
and system rows remain OS-owned. No custom pill controls or alternate identity.
The approved app icon is reused. iOS uses SF Symbols; Android uses existing
scan/search drawables and two attributed Material vector icons.

Shortcuts register on first app launch and update with app language. Cold-start
and foreground events wait for setup/auth overlays to clear, a ready main
navigator, foreground state and an active server configuration. Unknown IDs are
ignored; arbitrary parameters cannot become navigation URLs. Pending setup keeps
the most recent explicit intent. Duplicate initial events are suppressed.

Existing stack contents are not reset. Activity uses the existing connection and
draft conflict flow; cold launches join the connection query before opening it.
The scanner's pre-permission/loading screens now expose Cancel, following a
failure observed during simulator testing. Its existing camera permission and
barcode lookup remain in control of camera access.

## Implementation map

- `SparkyFitnessMobile/src/services/launchIconActions.ts`: allowlist, translated
  titles and platform icons.
- `src/hooks/useLaunchIconActions.ts`: registration, lifecycle and navigation gates.
- `src/hooks/useAddSheetActions.ts`, `App.tsx`: reuse existing entry paths.
- `src/screens/FoodScanScreen.tsx`: escape from camera permission/loading states.
- `package.json`, workspace lockfile: `expo-quick-actions` 6.0.2.
- `targets/android-widget`: vector resources and attribution/license.
- `__tests__/hooks/useLaunchIcon*.test.tsx`: routing, cold initial, duplicate,
  background/auth timing, failure and draft preservation checks.
- `review/DashboardReview.swift`, `scripts/review-ios.mjs`, `review/README.md`:
  real SpringBoard menu interaction gate (`--launch-icon-actions`).

## Verification and release

| Check | Result |
| --- | --- |
| Clean Expo native prebuild + iOS simulator build | Passed, zero errors, two existing Xcode warnings |
| Full mobile Jest suite after implementation | 484 suites / 7,247 tests passed |
| Additional measurement review-fixture checks | 5 tests passed after adding explicit absent-history responses |
| TypeScript and ESLint | Passed, zero lint warnings |
| Production iOS export | Passed; no `ui-review.invalid`, `XOT_UI_REVIEW` or `review-created-` markers in exported files |
| Native locale check, formatting, Android vector XML syntax | Passed (native locale check reports existing translation gaps) |
| Review runner runtime checks | 3 passed |
| Combined `validate` | Blocked by 3 pre-existing dynamic translation keys in HealthDataWriteback/Sync |
| Separate Knip | Existing unused `GAP_USER_LABEL` export; no new finding |
| Independent Impeccable review | `ship` for scoped 390-point native menu and scanner escape; no material fixes |

Native SpringBoard interaction tests passed for all four shortcuts at **390×844
(DE)** and **430×932 (EN)**, including Add Food after process termination. Both
runs passed their runtime/render smoke checks. All ten shortcut screenshots were
visually inspected: native menu labels/icons are legible and each intended editor
is reached. The existing Activity screen retains its oversized header spacing;
this task does not redesign the destination forms.

[Screenshots, native logs and results](evidence/launch-icon-actions-2026-09-26/README.md)
are committed with synthetic data. Android launcher, physical TestFlight, real
camera barcode capture, enlarged text and VoiceOver checks remain unverified.
The runner persists locale and development-menu preferences only in the disposable
simulator app container: SpringBoard cold launches do not inherit CLI launch
arguments. Activity's existing parent accessibility group is used to identify its
form; improving that screen's grouped field accessibility is outside this shortcut
change. The existing German camera-permission copy also needs translation QA.

This needs a new native binary; a JavaScript reload cannot add the native module.
Physical TestFlight validation belongs to the existing release follow-up:
https://app.todoist.com/app/task/6hcxwC9xFHhMHFjP.

The last cloud build attempt was blocked by the account's monthly iOS quota.
No paid upgrade or new cloud-build attempt is part of this change.
