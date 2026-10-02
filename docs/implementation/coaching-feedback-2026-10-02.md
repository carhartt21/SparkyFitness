# Coaching feedback integration — 2026-10-02

## Focus and reviewed plan

Deliver the existing owner-reviewed MCP coaching workflow on a separate branch based on current `main`, with weekly activity evidence shared by the coach and Daily Progress. Preserve the original uncommitted coaching worktree. This branch includes the weekly activity foundation from draft PR #5 because a second completion implementation would drift. It supersedes that PR for the integrated release; it does not deploy or enable production coaching.

1. Reconcile the previously implemented coaching and weekly activity work with current whole-activity planning, Daily Progress objectives, authentication fixes, and centralized notification copy.
2. Extend immutable prescriptions to retain whole activities, optional/rest rules, duration/distance targets and saved exercise requirements. Add a forward migration; preserve historical unknowns and completed diary history.
3. Derive coach workout evidence from the same pure activity projection. Separate completed, started, skipped, optional and unknown counts. Never evaluate old attendance-only evidence as completion.
4. Keep owner preview/review, revision conflicts, idempotency, consent/revocation, selected-domain isolation and prompt-only effects intact. Check web/mobile error and stale states, English/German copy, and all dependent cache families.
5. Validate server, web and mobile packages; run fresh-install/upgrade migrations and isolated PostgreSQL workflow checks. Recheck the subscription runner against the installed CLI using synthetic data, without enabling a production schedule.
6. Record results and remaining acceptance gates, then publish a PR with the complete repository template.

### Plan review and adjustments

- Current `main` already contains whole-activity planning and goal objectives. Retain those contracts and combine activity progress once; do not add both workout and activity tasks for the same occurrence.
- Workout completion requires the saved prescription or an explicit owner link to a recorded activity. An arbitrary completed set is only started evidence. Whole-activity targets need actual recorded duration/distance. Rest/optional/skipped tasks do not inflate adherence denominators; unknown prescriptions remain unknown.
- Preserve account-local calendar days, owner RLS, immutable versions, existing diary snapshots and legacy version 1 clients.
- Fresh source validation is required; historical checks in earlier notes are not evidence for this integrated branch.
- Browser access in this session still carries an explicit permission rejection. Do not bypass it. Authenticated screenshots, theme/narrow/German rendered review and physical push/device acceptance remain separate gates. Publish as draft if these gates remain outstanding.

## Results

Implemented on `feat/coaching-feedback-20261002`, based on `main` revision `899ac67bc`. The original dirty coaching worktree was preserved. This branch includes the owner-reviewed workflow and weekly activity foundation, plus shared prescription/outcome corrections and whole-activity review fields. Credential issuance now accepts valid agent display names longer than the credential label limit.

### Automated verification

- Pinned `pnpm install --frozen-lockfile`: passed.
- Server `validate` and `test:ci`: passed; 450 passing test files and 5,300 passing tests. Database-only suites remain opt-in in the normal run.
- Web `validate`, `test:ci` and production build: passed; 169 suites and 1,461 tests.
- Mobile `validate` and CI-equivalent Jest with `--watchman=false`: passed; 527 suites and 7,566 tests. This is not device or native-build acceptance.
- Documentation build: passed. English/reviewed German overlays and German copy audits: passed.
- Source UI detector for Coaching and Weekly activities: no findings. Owner review inputs are locked during preview/review; errors block acceptance and delegated contexts do not fetch owner evidence.
- Fresh isolated PostgreSQL startup through the normal server entrypoint applied migrations and RLS successfully. `test:migrations` also passed against this database.
- A second isolated database was initialized with the exact `899ac67bc` migration sources and upgraded with this branch's `test:migrations`: passed. Existing source migrations and `db_schema_backup.sql` were not rewritten.
- PostgreSQL coaching/activity suites: 16 tests passed, including owner RLS/table contracts, review/retry idempotency, revocation, immutable prescriptions, optional whole activities and credential issuance for long display names.
- Workout outcome regression checks: 14 tests passed, covering partial sets, unknown coverage, current-day exclusion and legacy attendance snapshots.
- Subscription runner smoke with CLI 0.160.0 and the saved ChatGPT login: succeeded and published one proposal using synthetic data. Owner-session preview/accept/retry/completion succeeded; completion feedback was readable through MCP. Diary intake remained unchanged, mixed key/session access was rejected, and revoked access returned HTTP 403. The synthetic owner and credential were removed; no recurring runner was installed.

### Remaining acceptance gates

- Authenticated web screenshots at reference and narrow sizes, both themes, and rendered German review remain pending because this session's browser permission rejection is still in effect. No alternative browser/origin was used to bypass it.
- iOS/Android device or emulator review, native build, notification delivery and physical push receipt remain pending.
- The optional repository-wide database schema-parity probe still reports pre-existing schema-export naming mismatches in other domains. The explicit new coaching/activity database contracts and RLS checks pass. This broader audit is not counted as passing.
- PR #5's activity foundation is included here; this integrated draft supersedes it for the combined release. No production deployment or recurring production coaching is enabled. Complete the manual acceptance gates before rollout or an owner pilot.
