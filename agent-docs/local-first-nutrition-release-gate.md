# Local-first nutrition release gate — 2026-09-23

Branch: `feat/local-first-nutrition`. Production remains on its existing pinned SparkyFitness release. This document records development verification, not permission to deploy. No HealthIntel data was migrated.

## Gates passed

- A disposable PostgreSQL 18 database was initialized with the prior stable revision `3c84e8007`, then upgraded with this branch. The legacy synthetic food entry retained its ID, date, time, calories, and protein; both added reference columns remained nullable. All three nutrition migrations applied and a second startup reapplied RLS without resetting data. The previous fresh-database test also verified two-user RLS for captures and linked food.
- Mobile validation passed, including type checking, lint, localization audit, native locale check, and formatting. The full mobile suite passed: 448 suites, 7,006 tests. New tests cover amount-scaled pending nutrients, unknown versus known zero, photo-completion reconciliation, duplicate suppression, and goal/exercise summary projection.
- The full `SparkyFitness` iOS app scheme built successfully for the iOS 26.2 simulator with code signing disabled. This does not verify device signing, installation, camera permission, or offline persistence on hardware.
- The development app installed on the booted iOS 26.2 simulator. Opening `sparkyfitnessmobile://meal-photo` reached the iOS confirmation prompt for SparkyFitness. The React Native camera flow was not exercised in this simulator check.
- A disposable local server with PostgreSQL 18, isolated uploads, and a synthetic account passed API smoke tests. Authentication survived a server restart; anonymous capture listing and image retrieval returned 401. Repeating the same food operation, capture creation, image upload, and photo completion returned the same logical records. The completed capture retained one image and one linked food row. Deleting the synthetic capture removed its database row, linked food row, and server image file. The test server is bound to `127.0.0.1`; its public-interface address was unreachable.
- The diary now includes locally saved nutrient snapshots in its online daily summary until the matching server row becomes visible. When disconnected, it labels pending nutrient totals as **known on this device** rather than presenting them as complete daily totals. Incomplete photos remain separate from numeric zero intake.

## Device acceptance still required

An iPhone is available later in this session, but none was connected when this note was written. The Mac has an Apple Development signing identity. A development build needs a connected, trusted device and a private, reachable non-production server with this branch's migrations/API before the end-to-end tests can pass. The current disposable server is loopback-only; do not open its port on this Mac's public network interface. Do not point a branch build at the existing production v1.7.2 API; it lacks the new endpoints.

Use synthetic data only. Record the exact build commit and server commit, iOS version, device model, and test time. Do not record personal meal names or photos in test evidence.

1. Build/install the development app, sign in to the matching test server while online, cache one synthetic favorite and meal type, and confirm the direct `sparkyfitnessmobile://meal-photo` route opens the camera.
2. Enable airplane mode. Log the cached favorite and capture a synthetic meal photo without AI or calories. Confirm both appear immediately, with the photo marked incomplete and the offline summary labeled device-only.
3. Force quit and reopen offline. Confirm the same action IDs, original timestamps, nutrient snapshot, and durable photo remain. Complete the existing photo manually; confirm its capture ID and image remain, and the incomplete count falls.
4. Restore connectivity. Wait for reconciliation; confirm each logical action appears once in the diary and database. Deliberately replay each create/complete operation ID against the test API and confirm no extra rows. Force quit and reopen again.
5. Test an invalid/expired session and server switch separately: pending actions must remain in their original account/server partition. Confirm no data is sent to the wrong account.

## Outstanding release blockers

- Physical-device airplane-mode and camera tests are pending. Simulator/unit tests do not establish device durability, camera behavior, or widget cold launch.
- A private transport from the iPhone to the isolated test server is pending. The Mac's active network address is public, so a plain LAN HTTP listener would expose test credentials. The branch now supports `SPARKY_FITNESS_SERVER_BIND_HOST` for restricted development binds; the default bind behavior for container deployments is unchanged.
- The selected development backend is not yet deployed with this branch. Production should remain on its pinned release until a restorable production backup, matching server rollout, and owner-approved cutover procedure are ready.
- Search or AI completion of an existing photo, photo deletion and local-file cleanup, local widget numeric snapshots, direct favorite widget/App Intent actions, and Watch nutrition actions remain unimplemented. This branch cannot be declared to meet those later-stage acceptance tests.
- The current completion contract supports one reviewed food snapshot per capture. A multi-food photo requires a separate schema/API design.

## Rollout order

1. Take and restore-test a backup of the target environment; preserve the previous image digest and schema-compatible rollback plan.
2. Apply the three migrations and matching API, then run auth/RLS/idempotency smoke tests on the target server.
3. Install a development mobile build on the iPhone and execute the synthetic offline tests above against that matching API.
4. Release the matching mobile build only after device evidence is recorded. Rolling back a mobile image does not roll back a migrated database schema.
