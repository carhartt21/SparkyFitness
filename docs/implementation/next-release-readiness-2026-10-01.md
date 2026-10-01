# Next release readiness — 2026-10-01

## Result and boundaries

Prepared the clean local branch `release/next-cycle-20261001` in
`/Users/chge7185/Projects/xot-release-next-20261001`. Validated application code
revision: `b82cbbdb3c6b4bcdc47e4d5ef4ab62ccc96c36c8`. This report and its evidence
are subsequent documentation-only changes.

The candidate integrates the completed OAuth, MCP measurement and notification
fixes with local main. No GitHub PR was merged, commented on or approved. Main,
remote branches, deployment configuration, credentials and production data were
not changed. No EAS build number was consumed, signed archive uploaded or
deployment started. Existing dirty worktrees were preserved.

**Verdict:** completed fixes are integrated in a reviewable candidate; publication
and production deployment are not cleared yet. Backend HTTP verification is
environment-blocked, and the next signed archive must verify Watch provisioning.
New draft features remain outside this candidate.

## Source and deployment reconciliation

GitHub main was checked twice through the GitHub connector and remains
`53c7092ef642154e2254d16ede70d2ff6ed02a6a`. Local main is `ce840f415` and has seven
additional commits. The candidate has sixteen additional commits over remote
main before this readiness document.

The private deployment checkout's release lock records:

| Surface             | Recorded deployed source              | Candidate treatment                                       |
| ------------------- | ------------------------------------- | --------------------------------------------------------- |
| Frontend            | `14e993582`                           | OAuth fix retained                                        |
| Server              | `4df4eabb6`                           | Saved MCP values retained                                 |
| Internal TestFlight | 1.7.2 (35), binary source `cbbd40eb4` | Existing release; next build number must be read from EAS |

These are **local deployment records**, not a fresh live container inspection.
The two production MCP fixes were outside main; releasing main alone would have
regressed them. The candidate contains both. The deployment checkout has its own
uncommitted release records/configuration, which were left intact.

Shell GitHub fetch was blocked by DNS, and `gh` had no authentication session.
The connector supplied current main/PR metadata, source comparisons, reviews and
workflow-run listings. Cached remote refs were not treated as authoritative.

## Branch dispositions

| Branch / revision                                                                              | Decision              | Reason                                                                                                                               |
| ---------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `fix/food-ui-localization-20261001` / `2dfab7b21`                                              | Included through main | Compact controls, German food/workout/Watch copy                                                                                     |
| `fix/medication-supplement-distinction-20261001` / `a37673dfc`                                 | Included through main | Correct intake identity across clients/server                                                                                        |
| `fix/food-serving-unit-conversion-20261001` / `221a4080c`                                      | Included through main | Named serving quantities scale by serving size                                                                                       |
| `fix/watch-workout-energy-20261001` / `ce840f415`                                              | Included through main | Reviewed energy recording, single Health writer, safe finish/recovery                                                                |
| `fix/mcp-oauth-redirect-20261001` / `9d7ee2d0c`                                                | Integrated            | Current Better Auth response parsing; existing redirect registration/consent retained                                                |
| `fix/mcp-measurement-values-20261001` / `94b342573`                                            | Integrated            | Owner-scoped saved values, units and timestamps; missing values remain null                                                          |
| `fix/notification-delivery-copy-20261001` / `2d7564d6e`                                        | Integrated            | Intake deduplication, failed-cancellation handling, numbered intentional follow-ups and personal German copy                         |
| `feat/micronutrient-coverage`                                                                  | Hold                  | Draft PR #4; native permission/background/writeback gates open; local tip is one commit behind PR                                    |
| `feat/weekly-activity-goals-20261001`                                                          | Hold                  | Draft PR #5; mobile screenshots/device checks open; local tip is one commit behind PR                                                |
| `feat/watch-workout-edit` / `74f0118ff`                                                        | Hold                  | Pre-rename proposal conflicts with current Watch `WorkoutView.swift`; must retain energy recording and finish safeguards when ported |
| `feat/mcp-coaching-workflow-20261001`                                                          | Hold                  | No unique committed changes; 88 tracked changes and 51 untracked status paths at inspection; visual/native acceptance incomplete     |
| `feat/personalbest-rebrand`, detached FDDB/review/overlay worktrees                            | Preserve              | Older dirty work; committed history already integrated, working changes cannot be silently included                                  |
| Remaining serving-size, glow, BLS, rename, Watch-food/progress and earlier correction branches | Already integrated    | No unique commits outside main; no duplicate merges required                                                                         |
| `backup/micronutrient-validated-c2232f3dc`                                                     | Preserve as backup    | Not a release feature branch                                                                                                         |

No branches or checkouts were deleted. Uncommitted OAuth setup documentation and
the unrelated Impeccable critique were also left outside the candidate.

## Open PR review

All four open PRs are authored by the repository owner. No submitted reviews or
inline review threads were returned. No pull-request-triggered workflow runs
were returned for their exact head SHAs; this is not a claim about all possible
status checks. No bot finding was silently marked resolved.

| PR                                                                                   | Exact head reviewed                        | State / verdict                                 | Remaining action                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#1 — Watch implementation plan](https://github.com/carhartt21/SparkyFitness/pull/1) | `aae24e10d33cafb87ac6f4e412b8af9e9af3d876` | Open, not draft; changes requested before merge | Reconcile docs with current main/identity and existing Watch implementation; GitHub reports not mergeable. Planning only, no release code                                                                  |
| [#2 — MCP-first plan](https://github.com/carhartt21/SparkyFitness/pull/2)            | `f6006084c09b84ca3bb066e10342373140ec75f9` | Open, not draft; changes requested before merge | Rebase/reconcile planning index; GitHub reports not mergeable. Keep proposal separate from unpublished coaching implementation                                                                             |
| [#4 — Micronutrients](https://github.com/carhartt21/SparkyFitness/pull/4)            | `63bec202980b1de8a89bcdf1af2afd362fe9fa56` | Draft; do not merge for this release            | Reconcile current main, run exact-tip gates, verify native permission/denial/background/writeback/mobile presentation. Collection flags default to enabled, so missing device acceptance cannot be ignored |
| [#5 — Weekly activity](https://github.com/carhartt21/SparkyFitness/pull/5)           | `89fa205684d2b442c8c1a05eed960fe765e020b6` | Draft; do not merge for this release            | Retain completed web review fixes/evidence; capture mobile overview and verify device/account/decision behavior before promotion                                                                           |

Trust review found no added dependencies, lockfile/install-script/workflow changes
or new runtime network destinations in the inspected feature diffs. OAuth
responses still come from the existing server-side registration/consent path.
Measurement reads keep the authenticated owner, parameterized day/category
filters and RLS client; they do not introduce a system-client data path. Notification
changes preserve action IDs, account/server scoping and the existing outbox.

Micronutrient review included the narrow security-definer orphan-key guard,
permission boundaries, migration rollout, unit/unknown semantics and native
collection switches. Its newer commit skips a conflicting nutrient during
native ingestion while retaining energy/macros; interactive imports still fail
visibly. Weekly activity's newer commit fixes exercise-category classification
and web date formatting, and records synthetic web captures. These latest-tip
changes were inspected through the connector; they were not executed locally.

Read-only `git merge-tree` rehearsals against the candidate found conflicts in
`localization-overrides/de/web.json` and `shared/src/index.ts` for each draft's
**local baseline**. These are not exact remote-tip merge results. Port both with
additive reviewed German keys and combined shared exports, not one-sided conflict
resolution. The older Watch editing branch has a confirmed `WorkoutView.swift`
conflict. None of these rehearsals changed a working tree.

## Fresh candidate validation

Checks ran against the combined application revision, initially in an isolated
temporary worktree and then moved to the persistent path above. Dependency
manifests, workspace file and lockfile match the existing installed checkout
byte-for-byte. Existing ignored dependency links were reused without changing
packages. Frozen offline **lockfile-only** resolution passed; a fresh dependency
installation was not performed and is still required on the build runner.

| Check                                                                                          | Actual result                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository layout and `git diff --check`                                                       | Passed                                                                                                                                                         |
| Server `pnpm run validate`                                                                     | Passed                                                                                                                                                         |
| Web `pnpm run build`                                                                           | Passed: overlay/copy checks, typecheck, lint, formatting, Knip, production build/PWA                                                                           |
| Web full Jest suite                                                                            | 166 suites / 1,454 tests passed                                                                                                                                |
| Mobile full Jest suite                                                                         | 522 suites / 7,548 tests passed                                                                                                                                |
| Mobile validate wrapper                                                                        | Blocked at `tsx` Watch geometry launcher: local IPC socket `listen EPERM`                                                                                      |
| Mobile validate preceding steps                                                                | Locale generation/overlay/copy, typecheck, lint, i18n audit, Knip and native locales passed                                                                    |
| Mobile remaining validation steps                                                              | Direct `node --import tsx ... --check` geometry and package formatting passed                                                                                  |
| Server full Vitest run                                                                         | 366 suites / 4,393 tests passed; 74 suites / 831 tests failed under local-socket restriction; 11 suites / 380 tests skipped. Full suite is **not passed**      |
| Focused server tools/measurement/copy/policy                                                   | 4 suites / 24 tests passed                                                                                                                                     |
| Additional server progress/range/chat regressions                                              | 3 suites / 74 tests passed                                                                                                                                     |
| German copy scanner tests                                                                      | 5 passed                                                                                                                                                       |
| Documentation production build                                                                 | Passed                                                                                                                                                         |
| Production iOS Metro/Hermes export                                                             | Passed; 5,033 modules, 179 assets; output `/private/tmp/xot-next-ios-export`                                                                                   |
| Expo production config/introspection                                                           | Passed; `com.cg.phi`, team `4V6HSJQ4JP`, original EAS project and `group.com.cg.phi` retained; phone HealthKit/background delivery and Live Activities present |
| Watch Swift SDK typecheck                                                                      | All 24 sources passed; watchOS 26.5 SDK, watchOS 10 deployment target                                                                                          |
| Foundation Watch protocol executable                                                           | 29 assertions passed                                                                                                                                           |
| Runbook export helper                                                                          | `pnpm run testflight:export -- --help` passed; no credentials/export/upload attempted                                                                          |
| Signed archive, provisioned entitlements, sensors/background/reconnect, physical push delivery | Unverified                                                                                                                                                     |
| Fresh real-PostgreSQL/RLS integration, live server/container inspection                        | Unverified in this run                                                                                                                                         |

The backend run could not bind test listeners (`listen EPERM`); Supertest then
failed to read its server's port. A socket-based proxy fixture also timed out.
Do not weaken tests, disable isolation or count this run as a pass. Rerun HTTP,
OAuth transport/revocation, database/RLS and the full backend suite in an
unrestricted isolated runner before deployment. Earlier branch evidence does
not establish the combined candidate's exact release gate.

Builds retain existing non-blocking bundle-size/Knip/config warnings. No attempt
was made to fix unrelated warnings or regenerate schemas. This candidate adds
no migrations over recorded production main.

## Release sequence after the open gates

1. Review/merge this prepared candidate as a separate action; keep the held drafts
   and all dirty worktrees out. Push the exact approved revision, not a moving
   feature tip. Run the backend and real database checks above, plus a frozen
   install from the runbook on the release runner.
2. Read EAS's current production iOS build number before incrementing it. Retain
   version 1.7.2, existing bundle IDs, EAS project, team, keychain/app groups and
   production server URL. Use `XoTMobile/docs/testflight-release.md` for the stored
   credentials workflow; cloud quota may require its local archive/export path.
3. Verify all five signed targets, distribution signatures and shared app groups.
   The Watch now needs the HealthKit capability and `WKBackgroundModes` with
   `workout-processing`; refresh its provisioning profile if EAS's stored one
   lacks that capability. Plugin introspection emits a development APNs value;
   the distribution archive's actual `aps-environment` must be checked as
   production. Confirm no review fixtures/credentials entered the binary.
4. Build server and frontend from that same pinned source on the linux/amd64
   deployment host. Preserve private Caddy/media-auth routing, database/uploads
   volumes and existing secrets. Obtain and verify a fresh matched encrypted
   backup. Record actual running image revisions/IDs before changing services.
5. After separate publication/deployment authorization, TestFlight upload and
   web deployment can run in parallel. Follow the runbook's cloud auto-submit or
   local export/direct upload route, but cancel any competing EAS submission
   before a manual upload. Check Apple processing/internal-group availability;
   successful upload alone is insufficient.
6. Retain recorded production images `x-on-track-frontend:14e993582` and
   `x-on-track-server:4df4eabb6` for rollback. Do not remove volumes or restore a
   database for an ordinary image rollback. After deployment check health,
   sign-in, entries, German UI, OAuth callback/revocation and fresh MCP values.
7. Install over build 35 without deleting the app. Check entry retention,
   serving quantities, medication/supplement labels, notification deduplication
   and intentionally numbered repeats. Verify Watch permission/sensor recording,
   exactly-once reconnection/finish and one positive-energy Fitness workout;
   denial/unavailable energy must keep the diary and explain the limitation.

Machine-readable evidence: [release-checks.json](evidence/next-release-20261001/release-checks.json).
Raw local logs remain `/private/tmp/xot-next-*.log`; screenshots or device
acceptance are not claimed by these code/build checks.
