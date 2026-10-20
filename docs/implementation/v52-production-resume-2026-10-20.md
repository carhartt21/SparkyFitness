# v52 production rollout — 20 October 2026

## Scope

Resume the production half of the [v52 release](v52-release-2026-10-13.md).
The application source remains `bf118ae09938faaee474a9c60072a32811bc6afa`.
A fresh fetch confirmed that main has no newer server, frontend, shared-contract,
container or lockfile changes. No new phone build or upload is part of this run.

Direct SSH with the existing configured identity works. The previous university
jump route still times out from this workstation. Production initially matched
the expected healthy v49 images, with approximately 12 GB free.

The private production-only runner now uses direct SSH. It retains the clean
pinned source/checksum, expected live images, migration allowlist, disk capacity,
protected configuration, persistent mount, encrypted matched backup/off-host
checksum and rollback checks. The only allowed migration is
`20261012170000_offline_meal_actions.sql`.

## Delivery

Production frontend and API are deployed at the pinned revision. Both images
built successfully, including frontend validation. All three services are
healthy. The served HTML matches the pinned frontend image; public root, API
health and both OAuth discovery endpoints returned HTTP 200.

A fresh encrypted matched backup was checksum-verified on the server and in its
off-host copy before the switch. The previous app images and configuration are
retained for rollback. The database image, persistent mounts, protected settings,
private routing, existing migration ledger, BLS count and Mobility owner policies
were preserved. A checksum match is not a restore test.

The reviewed offline-meal migration is applied. The new table has owner-only
`USING` and `WITH CHECK` policies, a unique account/operation receipt, account
deletion cascade and meal-deletion `SET NULL`. Anonymous POST requests to the
new endpoint return HTTP 401 through both loopback and public HTTPS. These
checks establish deployment and authentication, not authenticated replay.

Build 52 remains Apple VALID and internally IN_BETA_TESTING. Its German testing
notes were updated and read back to reflect the live endpoint and the unresolved
client identity-switch limitation. No phone binary was rebuilt or uploaded.

[Sanitized delivery receipt](evidence/v52-production-resume-2026-10-20/delivery.json).

## Acceptance boundary

The 17 October client review found that pending nutrition actions can be sent
under a newly selected account or server. Its grouped-meal correction is not in
build 52, and non-meal dispatches and late responses also require correction.
Do not switch accounts or servers while any nutrition action is pending,
syncing or uncertain. This server deployment does not fix that client issue.

Physical phone/Watch acceptance, authenticated grouped-meal replay and
delete/retry behavior remain unverified. No real health entries are created or
changed for rollout verification. Backend tests remain excluded by owner
instruction; production schema and HTTP smoke checks are separate from a test
suite.

The historical offline feature task remains completed. The current client
isolation and physical acceptance task stays open and blocked. This rollout
does not include the separately reviewed, unmerged phone correction.
