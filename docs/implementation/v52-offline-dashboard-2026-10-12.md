# v52 — offline nutrition and dashboard access

## Scope and sequence

1. Keep previously loaded saved/favorite foods available after a cold offline
   launch. Review the cached portion and selected diary date, persist an
   account/server-scoped nutrition action, then show its pending sync state.
   Missing data and storage failures must stay explicit. Provider search and
   library editing still require a connection.
2. Give all four dashboard action tiles supporting labels and accessible
   long-press options. Keep the water tile's actual container and per-tap amount.
   Opening or cancelling a menu must never log an entry.
3. Extend the dashboard's lower shortcut list with existing supplement, mobility,
   habit, check-in, measurement, wellness and recommendation destinations. Carry
   the selected calendar day to routes that support it.
4. Review German copy, validate mobile, run the full mobile suite and native
   dark/light/enlarged-text checks. Backend tests remain excluded by owner
   instruction. Review the final diff, merge, and publish build 52 from the
   verified source revision.

The owner confirmed complete saved meals are included. Resolve nested recipes
while connected and retain the full ingredient snapshot and yield. A new
owner-only offline-meal endpoint atomically creates the diary group, ingredients
and retained replay receipt. Deleted library items remain loggable from their
reviewed snapshot; replay after deliberate diary deletion never recreates them.
The new endpoint must be deployed before grouped offline meals can sync.

## Delivery boundaries

Build 51 is valid and available to internal TestFlight testers. Its production
rollout is still pending because the authorized university SSH jump host times
out before reaching production. Recheck the route for this release, retaining
the existing disk, backup, revision and rollback guards. Public HTTP health is
not evidence that a source revision has been deployed.

## Implementation and verification

All three Inbox tasks are implemented. Saved foods and favorite foods use their
reviewed device snapshot, including micronutrients, water and caffeine. Complete
meals resolve nested ingredients while online and keep their original yield.
Offline portions retain the selected calendar date and category. The durable
outbox isolates accounts and servers, handles lost responses with stable
operation IDs and never recreates a deliberately deleted meal on retry.
Pending meals contribute to local nutrition totals and reminder suppression.

All four Home tiles now have supporting labels, native hold menus and an
accessible alternative action. Existing container names and per-tap amounts
remain visible. The lower list includes Mobility, Habits, Check-In, Measurements,
Wellness and Recommendations. Cancelling any hold menu queues nothing.

- Full mobile suite: **586 suites, 7,976 tests passed**; 59 final focused checks
  passed after restoring the existing ActionTile accessibility regression test.
- Mobile, server and frontend validate wrappers, repository checks and docs
  build passed. Backend tests were authored but **not run**, as instructed.
- A fresh isolated database applied the migration through normal server startup.
  Owner RLS and the account-cascade/meal-SET-NULL foreign keys were
  inspected. The API's strict shared contract rejects unresolved ingredient
  units; request/response schemas are also used in Swagger.
- Native German dark/light at 390 points and enlarged text at 430 points passed
  real hold/cancel, offline portion, durable queue and cold-restart interactions.
  Visual review fixed a clipped large-text macro summary by stacking it.
  [Native results](evidence/v52-offline-dashboard-2026-10-12/native-results.json)
  record the base revision plus the reviewed working-tree changes.
- [Verification record](evidence/v52-offline-dashboard-2026-10-12/validation.json).

The native fixture proves local persistence, not remote replay or physical-device
acceptance. Production delivery and TestFlight publication require their own
receipt. Grouped meals remain retryable on an older server; the offline task
must remain open until the endpoint is deployed.
