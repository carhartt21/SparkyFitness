# iOS UI review

Run the real app with deterministic synthetic responses, independently of the user's account and server. This is a local macOS/Xcode gate, not a cloud CI job or a screenshot-only mock.

```sh
node scripts/review-ios.mjs \
  --app /absolute/path/to/DevelopmentSimulator.app \
  --output /tmp/xot-review-unique-run \
  --interactions
```

Prerequisites: Xcode with iOS 26.2 runtime (override with `--runtime`), an existing compatible Expo development **simulator** app with bundle ID `com.cg.phi`, installed project dependencies, Swift/Vision, and Ruby's `xcodeproj` gem. Use a fresh output directory. Ports 43990 and 43991 must be free. `--single` runs the German 390-point baseline case only. The package shortcut is `pnpm ui:review:ios --app ...`.

The runner creates/reuses only simulators named `XOT UI Review …`; it does not erase the user's simulator or launch a physical phone. It installs the supplied native app into those disposable review devices and serves current JavaScript through a dedicated Metro process. It uses iOS launch arguments for the actual date locale, theme preferences for the app, and system Dynamic Type for the large-text case.

## Gates and artifacts

- 390×844 German dark/light; 430×932 English dark and German accessibility-extra-large; empty day, over-target AMOLED and summary error.
- OCR waits for expected fixture metrics and rejects known untranslated dashboard labels/developer menus. It is a render smoke test, **not a visual-fidelity score**.
- Runtime errors and unknown fixture endpoints fail the run. Expected simulated HTTP 503 errors and blocked writes do not.
- With `--interactions`, XCTest scrolls the German 390-point and English 430-point dashboards, checks the four quick actions are hittable and at least 44×44 points, and opens food search with one tap. It waits for the loading indicator to disappear before capturing search.
- Output includes PNGs, OCR JSON, `results.json`, Metro log, native test logs, `.xcresult` bundles and exported scroll/search attachments. Inspect images against the reference before accepting a change; successful OCR does not prove layout quality.

`results.json` records the base Git revision; screenshots include uncommitted source edits. Record the working-tree diff with review evidence when needed. Native-test `null` means not run, never passed.

## Isolation and limits

`XOT_UI_REVIEW=1` changes only Metro's resolution of the entrypoint's `./App` import. Normal exports retain the production entrypoint. The review wrapper refuses release builds and physical devices, allows only the synthetic `ui-review.invalid` origin, supplies explicit GET fixtures, and blocks writes. No credentials or personal records belong in fixtures or committed screenshots. Do not set this variable in EAS/deployment profiles.

The synthetic transport deliberately does not verify authentication, server persistence, offline mutation replay, HealthKit, Watch sync, camera permissions or physical-device performance. Food search navigation is tested; portion/save/edit/delete flows are not yet part of this pipeline. Read-only bootstrap-timezone warnings and an unpaired Watch warning are expected. The review preference set hides health trend series and optional modules; those require separate scenario coverage.

Before release: run the normal type check, lint and relevant tests; export iOS without `XOT_UI_REVIEW`; verify review markers are absent from the bundle; review captures; then use a real TestFlight device for integration gates.

Runner error detection has its own tests:

```sh
node --test review/runtime-check.test.mjs
```
