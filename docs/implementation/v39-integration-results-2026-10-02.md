# v39 integration and release checks

Execution of [the reviewed preparation plan](v39-release-preparation-plan-2026-10-02.md), authorized on 2026-10-02. Worktree: `integration/v39-20261002`, based on main `899ac67bc`.

## Integrated work and resolved conflicts

Corrections/caffeine/hydration, the exact remote micronutrient and coaching tips, wellness, native widget alignment, Watch set editing, current guides and both historical roadmaps are integrated. Shared exports, cache families and reviewed German overlays were combined instead of choosing one branch wholesale. The phone keeps safe workout finish/energy recording; the Watch editor uses the existing durable operation queue and localized controls. FDDB remains read-only. Check-in remains last in the compact task list.

The older weekly-activity PR is superseded by coaching plus its independently retained final fixes: planned exercise category classification and configured web date formatting. Watch retries now compare the complete expected edited signature, including untouched fields, so an intervening phone edit is not falsely acknowledged. The editor rejects invalid values and stale snapshots. Wellness definition creation respects a borrowed coaching transaction: it never commits, rolls back or releases another caller's connection.

The five reviewed Todoist inbox issues are covered by the integrated correction work: keyboard spacing, compact dashboard/task list, `Mark fertig` replaced by `Erledigen`, selected-day caffeine refresh and unified hydration. Drinks and taken supplement drinks count toward hydration; solid-food water is detail-only. No production historical records are rewritten.

## Rollout boundaries

Production EAS explicitly sets `EXPO_PUBLIC_MICRONUTRIENT_SYNC_ENABLED=false`. The matched server rollout explicitly sets `MICRONUTRIENT_IMPORT_ENABLED=false` and `XOT_COACHING_ENABLED=false` in Compose while preserving protected credentials/routing. Stored observations and ordinary nutrients remain available. Native extended permission/background/writeback round-trips require later physical-device acceptance. No external coaching runner is installed, no credentials are issued and no goals/doses are changed by this release.

Watch/WidgetKit code is included for internal testing; real paired Watch offline editing, hosted widget interactions, VoiceOver and HealthKit energy round-trips remain unverified on physical devices. Android launcher/device checks are also unperformed; this cycle publishes iOS only.

## Validation actually run

- Frozen workspace install passed.
- Full mobile: 536 suites, 7,628 tests passed before final integration regression additions. Focused reruns cover the Watch's 251 tests, seven task-order/icon/navigation tests, native nutrient rollback and four web date-format tests.
- Full web: 172 suites, 1,468 tests passed; final weekly-date regression passes separately.
- Focused server: 14 files, 100 tests passed. Borrowed-transaction success/failure checks passed in the six-test wellness suite. The blanket backend suite was deliberately skipped per the owner's standing request.
- Real PostgreSQL: coaching/activity 16, micronutrients/wellness 17, hydration SQL 3 tests passed. These are not mocked persistence tests.
- Fresh startup passed. Upgrade from the actual v38 migration set advanced 258 → 269; a second initialization passed and a synthetic prior-day 500 ml hydration record remained unchanged. Databases were disposable and isolated on local port 55439.
- Server/mobile/web validate wrappers, German overlay/copy/native-locale audits, repository-path check and whitespace check passed. Final rechecks are recorded below.
- Web production build, VitePress build/internal links and production-profile iOS JS export passed.
- All Watch Swift sources type-checked against watchOS. Native iOS/Watch simulator compilation and a runnable ad-hoc signed simulator build passed. An initial forced `-sdk iphonesimulator` invocation incorrectly applied that SDK to Watch targets; rerunning with destination-based SDK selection fixed the build command. An unsigned launch then failed HealthKit source identity; normal simulator signing fixed that tooling setup.
- 18 English and 18 German authenticated synthetic web captures cover Dashboard/Diary/Reports, dark/light, 1586×992, 1280×800 and 390×844. No page overflow or console errors. German captures set the actual disposable account preference (changing browser storage alone is overridden by account settings). Representative captures and machine results are in [evidence](evidence/v39-2026-10-02/).

## Visual review

The reviewed German web captures preserve legible numeric hierarchy, nutrient colors, full-width narrow cards and accessible logging destinations. Sidebar long labels truncate without horizontal overflow. Selected follow-up polish: the longer medication/supplement navigation label still truncates on desktop; no destination is lost. Native capture/interaction results are being finalized before release. Synthetic fixture successes do not establish live-account or physical-device acceptance.

## Repository preservation

Dirty older worktrees and the separately edited deployment checkout are retained. The integration preserves ancestry of included feature branches. No backup branch, unaccounted worktree or historical reference was deleted to make the inventory appear clean. The fresh v39 release package will pin one final main commit, archive checksum, eleven migration filenames and the observed healthy v38 image IDs; it retains encrypted off-host backup and duplicate-upload guards.
