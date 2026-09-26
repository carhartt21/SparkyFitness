# Launch-icon actions — simulator evidence

Date: 2026-09-26. Implementation base: `853b63688`.
All application records in these captures are synthetic, supplied by the isolated
review fixture. These are native SpringBoard interactions, not rendered mockups.

## Reproduction

From `SparkyFitnessMobile`, with the new native module compiled into the simulator
app, run:

```sh
node scripts/review-ios.mjs --app /absolute/path/to/XonTrack.app \
  --output /tmp/xot-launch-icon-review \
  --case '390-de-dark|430-en-dark' --interactions --launch-icon-actions
```

The runner uses disposable review simulators and writes locale/development-menu
preferences only inside their application containers. The production export was
checked for review fixture markers; none were present.

## Results

Both native interaction tests passed with zero failures: 390×844 German and
430×932 English, iOS 26.2. Each test opens all four shortcuts; Add Food is launched
after terminating the application. Both runtime/render smoke checks passed.
The ten menu/destination captures were visually inspected. This matrix checks
shortcut routing and scanner escape, not save/persistence for every destination.
`results.json` records the base revision with the staged feature changes applied.

## Screenshot map

For each locale/viewport, `launch-icon-menu.png` captures the actual long-press
menu. `launch-icon-destination-0.png` shows Scan Food and its camera-permission
escape; `-1.png` Add Food after process termination; `-2.png` Activity;
`-3.png` Measurements. All actions open local today without saving an entry.

## Limits and existing findings

- Physical iPhone/TestFlight and Android launcher verification remain pending.
- Simulator camera permission/Cancel was checked; real barcode capture was not.
- Enlarged text, light appearance and VoiceOver traversal were not exercised by
  this native menu matrix. OS menu typography and motion remain native.
- Existing German scanner/activity/measurement copy contains untranslated or
  mixed-language phrases. The shortcut labels themselves use translated keys.
- The existing Activity form uses a parent accessibility group; the runner checks
  that group for the destination. Field-by-field VoiceOver improvement is outside
  this change.
- Full mobile Jest: 484 suites / 7,247 tests passed. After a review fixture update,
  its focused suite passed 5 tests. TypeScript, ESLint and production iOS export
  passed. Combined validation still reports three existing dynamic translation
  keys; Knip reports the existing unused `GAP_USER_LABEL` export.

See [implementation record](../../launch-icon-actions-2026-09-26.md) for code map,
release constraints and Todoist follow-up.
