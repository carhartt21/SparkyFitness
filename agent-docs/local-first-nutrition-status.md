# Local-first nutrition status — 2026-09-23

This work is on `feat/local-first-nutrition`, based on upstream v1.7.2. It has not been deployed to the production SparkyFitness server or installed on an iPhone. HealthIntel and its stored data remain untouched.

## Implemented

- Server food creation accepts an optional UUID `client_operation_id`. The database has a partial unique index on `(user_id, client_operation_id)`; retries return the first snapshot. Existing web requests remain valid. Standalone offline snapshots have a narrow owner-scoped RLS policy.
- The mobile outbox stores versioned, owner/server-partitioned actions in AsyncStorage. It persists food logs, photo captures, and manual photo completions before any network request. Its coordinator retries bounded batches on startup, foreground, and connectivity recovery after verifying the authenticated owner. The diary projects local food and photo actions before sync and matches completed server rows by operation or capture ID.
- Favorites and meal types are cached locally. A cached favorite's default portion and nutrients can be logged offline. Quick calorie/macro entry uses the same action path.
- Meal photos are copied into application documents before the capture action is stored. The server stores an incomplete capture and authenticated image attachments separately from food entries. Missing nutrition is absent, not zero; the diary counts incomplete captures. A manual reviewed snapshot can complete a capture while keeping its ID, photo, and timestamps. Completion uses another stable operation UUID and one linked food entry.
- Local and provider search rows show energy and macros per 100 g or 100 ml only for explicit metric mass/volume servings. Unknown nutrients display as unknown; package servings remain labeled per serving.
- Existing calorie and macro iOS widgets now link directly to the meal-photo route, which hands capture to the mobile outbox. The widget does not write to the server.

## Schema and API

Migrations, in order: `20260923000000_add_food_entry_client_operation_id.sql`, `20260923020000_add_nutrition_captures.sql`, and `20260923030000_link_food_entries_to_nutrition_captures.sql`. Owner-only capture and standalone-snapshot policies live in `db/rls_policies.sql`, which startup reapplies after migrations. Apply to a disposable copy of the previous stable database before production rollout.

`POST /api/food-entries/` may include `client_operation_id`; `(user_id, client_operation_id)` identifies one immutable create operation. `POST /api/nutrition-captures` uses the capture UUID as its idempotent create key. `PUT /api/nutrition-captures/:id/images/:imageId` uses the image UUID. `POST /api/nutrition-captures/:id/complete` requires a distinct `clientOperationId` and reviewed food snapshot, links one food entry to the capture, and returns the existing result on retry. A second completion operation is rejected. The capture remains the photo occurrence and holds captured/consumed instants; the food row supplies daily nutrient totals. The current completion API supports one food snapshot per capture.

## Release gates and limits

- Full validation passed for server and mobile. Server tests: 399 files passed, 7 skipped; 4,862 tests passed, 305 skipped after the RLS fix. Mobile tests: 447 suites and 7,000 tests passed. A fresh disposable PostgreSQL 18 database completed every migration and a repeat startup kept all three nutrition policies. Synthetic two-user checks confirmed owner write/read and cross-owner denial for captures and linked food. The iOS prebuild generated targets and the `CalorieTracker` widget target built for the simulator with code signing disabled. The full workspace build is blocked by existing Watch complication previews that require iOS 17 while their target uses a lower deployment version. No physical device acceptance test has run.
- The production server is still on its prior release. Deploy server migrations and matching API before distributing a new mobile build. Test the migrations on a restorable database copy and test auth/RLS with two users.
- Photo completion currently supports manual kcal/macros. Search and AI completion into the *same* capture are still pending. AI remains optional and is not invoked during capture.
- Native App Intents, direct favorite/quick-entry widget actions, Lock Screen accessories, and Watch nutrition logging remain pending. The current widget action opens the app camera; it does not itself save a record until the user captures a photo.
- Favorite meals and recent meals are not cached for offline logging. Existing online editing/deletion is unchanged. Photo deletion UI, local file cleanup after deletion, startup orphan cleanup, and backup/export inclusion need follow-up. A permanently rejected completion remains in the outbox for attention rather than being discarded.
- Pending food and completed-photo snapshots are visible in local diary cards, but the existing daily calorie/macro aggregate and widget snapshots still come from the server summary until reconciliation. They must include locally known values before full offline-diary acceptance can pass.
- The completion form has only English source strings for its new copy, with localization fallback; native meal-photo widget labels are localized in English and German, with English fallback elsewhere.

## HealthIntel migration readiness

No historical data has been imported. Map HealthIntel supplement definitions, schedules, and actual intake events separately. Preserve original source IDs, instants, timezone context, units, missing values, and attachments. Import into a disposable SparkyFitness namespace first; report unmapped records and collisions, then use stable source-derived operation IDs for idempotent repeat imports. Archive analytics artifacts and any record without a faithful destination rather than flattening them into food intake. Do not shut down the HealthIntel runtime or change its keys as part of this branch.
