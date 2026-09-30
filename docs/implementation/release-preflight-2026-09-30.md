# Feature-batch release preflight — 2026-09-30

## Source and deployed functionality

The mobile archive is built from `cbbd40eb4aa6c53f7195c82919d157b81aec3693` (main plus the frontend Docker localization-copy fix). Web/server additionally retain the FDDB fixes already running in production, recovered from verified release archives based on `9fa073ef04ad46892bbe30ae42860bd47394953e`. No unfinished changes from the separate FDDB checkouts were included.

Verified archive SHA-256:

- Server: `a058a8f74c4822db8f465196e67887c222eb87ff01951c2049708989e6fff725`.
- Frontend: `b5a8e750dcab5b8f866483c2dbe516b58cf1b3955d62878c725801b09aa8cfc9`.

The preserved changes cover owner-only historical FDDB snapshots, activity-import parameter typing, ingredient review, portions and recipes, their English/German labels, and regression tests. The two German JSON conflicts were combined by key; both the mobility and FDDB groups remain.

## Additional preflight corrections

- The FDDB policy migration previously assumed the identity helper already existed, which failed first boot. It now applies directly when that helper exists; fresh installs receive the identical policy from the normal post-migration RLS script. No historical records or identifiers change.
- The RLS completeness test omitted recent owner-only, diary, check-in, and auth-infrastructure tables. Classification now reflects inspected PostgreSQL policies; auth tables deliberately allow no application-role policy.
- Production upload/backup volume destinations must follow the renamed server package (`/app/XoTServer/…`), retaining the same host directories, credentials and database volume.

## Validation

- Frozen workspace install: pass.
- Web validate: pass. Web full suite: 163 files, 1,434 tests pass.
- Server validate: pass. Server full suite: 437 files, 5,213 tests pass; 344 tests skipped without their optional integration environment. A first run had one exercise-route failure (HTTP 200 instead of 400); the isolated 12-test suite and full rerun passed without changing that code or its expectation.
- Disposable PostgreSQL normal startup: all migrations and RLS applied successfully after the first-boot correction.
- Real database notification/mobility + RLS suites: 275 tests pass, 26 skipped. Repair tests gated on a `test`-named database remain unverified; no tests were pointed at production.
- iOS archive: Release archive succeeded; runbook export recovery resolved the local certificate-selection mismatch. Version 1.7.2 (35); all five bundle signatures, distribution entitlements, team and shared app group verified. English/German native resources are present in the app, widgets and Watch targets; the Expo widget extension uses its existing generated resource pipeline.

Production switch, encrypted matched backup, Apple processing and physical-device installation are separate release gates recorded in the private deployment repository. This document does not claim device tests or an authenticated browser review.

## Migration checklist

1. Existing timestamped FDDB policy migration retained and made fresh-install-safe.
2. RLS source updated; owner-only snapshot insert, existing diary/report access retained.
3. Normal disposable server startup and real RLS DML tests pass.
4. Schema backup untouched; CI regeneration remains authoritative.
5. Shared table/API Zod changes: not applicable (no column, table, or payload changes).
6. Security tiers and family-sharing documentation updated.
7. Downstream contracts: unchanged; existing import UI and regression tests retained.
8. Server/web validation and nearby integration tests pass; final format/type validation repeated after the test-matrix update.
