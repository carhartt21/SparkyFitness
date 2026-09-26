# Mobile header and control shapes

User direction: put the Dashboard date selector on the first line, retain the approved logo, remove visible brand text from this header, and avoid pill shapes throughout the mobile app. This supersedes the reference's wordmark/tagline header and capsule date controls; the product identity and logo asset remain unchanged.

## Implementation

- DashboardHeader places the 40-point approved logo in a 44-point Home target beside grouped previous/date/next controls and Today. The selector uses the existing 8-point radius token, a surface fill, subtle border and pressed states. The date remains localized and exposes the selected ISO date as its accessibility value. All five existing callbacks remain intact.
- At enlarged text sizes, Today moves to a second line. The logo and date remain together, with wrapping rather than truncation or reduced font scaling.
- Horizontal pill filters, badges, dosage actions, rest controls, copy/date shortcuts and photo guide controls use the existing 8-point radius. Shared Button variants and Dashboard water/exercise actions use that radius too. Floating workout chrome uses 16-point container corners; its helper and keyboard accessory names now describe chrome rather than pills.
- Circles serving as radio/check states, icon-only controls, camera shutters, progress indicators and the central Add button remain circular. No API, persistence, calculation, native identity or navigation changes.

## Verification

- Full mobile Jest suite: **482 suites / 7,232 tests passed** after the initial shape and header edits. Final targeted run after shared-button and rest-chrome refinements: **4 suites / 52 tests passed**.
- Final TypeScript, ESLint and whole-package formatting checks passed. `git diff --check` passed.
- Aggregate `validate` continues to stop at the three previously documented dynamic translation-key findings in HealthDataWriteback/SyncScreen. It is not reported as passing.
- Simulator matrix: German dark 390×844, English dark 430×932, German light 390×844 and enlarged German 430×932. Dark scenarios exercise date navigation, header alignment and 44-point targets, Dashboard scrolling, hydration increment, and hydration/exercise Details destinations.
- Light and enlarged-text scenarios are render checks. Physical-device/VoiceOver checks and visual coverage of every affected secondary screen are unverified. Secondary-control changes have source review and regression tests, not a whole-app visual certification.

Before screenshots: [previous Dashboard alignment](evidence/dashboard-alignment-2026-09-26/). Final synthetic screenshots and result manifest: [header/control evidence](evidence/mobile-header-controls-2026-09-26/).

Independent Impeccable review found no material visual defects in the scoped captures and requested one correction: stale DESIGN.md header/pill guidance. DESIGN.md and its sidecar were corrected; the reviewer scored that documentation fix **resolved**, final disposition **SHIP** at the stated review scope. UI was unchanged by the documentation correction, so no recapture was needed.

## Release status

Implementation/evidence commit `52d420f72` is pushed to `feat/personalbest-rebrand`. A clean detached checkout at `/tmp/xot-v15-release` was used for `eas-cli build --platform ios --profile production --non-interactive --auto-submit --no-wait`.

EAS advanced the remote build number from 14 to **15**, validated credentials, uploaded the archive and computed its fingerprint, then rejected the request because account `ilmtech` exhausted its monthly free iOS build quota. EAS reports a reset on **October 1, 2026**. No build URL or TestFlight submission was created. No billing change was made. A future retry may advance the build number again.

No web code changed or web deployment was performed. Unrelated untracked audit artifacts and the original reference archive were excluded from the commit and build checkout.
