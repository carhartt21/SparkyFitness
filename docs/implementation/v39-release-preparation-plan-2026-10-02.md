# v39 release preparation plan

Reviewed on 2026-10-02. This is a preparation and integration plan, not release approval. No PR, Todoist task, branch, deployment or mobile publication was changed during this review. The intended result is one tested main revision, with each open PR either merged or explicitly superseded, and a fresh release package pinned to that revision.

## Current state

- Fetched `origin`; local and remote main are `899ac67bc`. The local deployment lock records that revision for both web and server. The recorded EAS build is 1.7.2 (38), finished, from the same revision. These are release records, not a new live container or Apple availability check.
- The latest correction branch is `feat/caffeine-hydration-20261002` at `ff61b8a59`, ten commits ahead of main. It already contains `fix/meal-goal-actions-20261002` and all seven commits in `feat/v38-review-corrections-20261002`. Merge that ancestry once; do not cherry-pick its component branches again.
- There are six open PRs: #1, #2, #4, #5, #6 and #7. The connector returned no comments or review threads and no pull-request-triggered workflow runs at their current heads. This is not evidence of green CI. PR descriptions provide prior validation records; integrated-source validation remains necessary.
- Twenty-three local branch tips are already ancestors of main. Eleven are not, including a backup, older variants, and the branches described below. Branch count is not a count of independent features.
- The current XoT checkout has an untracked `.impeccable/critique/` directory. Older FDDB, Watch review, coaching and OAuth worktrees contain uncommitted work. Preserve those until a file-by-file comparison proves which changes have landed. The deployment checkout also has uncommitted release/configuration records; do not overwrite it from application Git.
- `gh` has no authenticated session. Git fetch works and the GitHub connector supplied live PR metadata. Use the connector for PR actions, or restore CLI authentication without putting credentials in chat or files committed to Git.

## PR and branch disposition

| Work | Observed state | Planned disposition |
| --- | --- | --- |
| [#1 Watch roadmap](https://github.com/carhartt21/SparkyFitness/pull/1), `aae24e10d` | Old baseline; status update still describes main at `53c7092ef`. GitHub reports not mergeable, although current local merge-tree is clean. | Refresh the roadmap against the final implementation and X on Track identity, preserve historical source links, reconcile the docs index, then merge. Do not treat roadmap promises as shipped features. Recheck GitHub mergeability after updating. |
| [#2 MCP roadmap](https://github.com/carhartt21/SparkyFitness/pull/2), `f6006084c` | Same stale baseline/mergeability disagreement. Its product paragraph still describes PersonalBest/HealthIntel and later stages as entirely planned. | Update after the coaching disposition is known, retain the read-only/consent boundaries, then merge with the current documentation branch. |
| [#4 Micronutrients](https://github.com/carhartt21/SparkyFitness/pull/4), `63bec2029` | Draft; 14 actual conflicts against main. Local feature branch is one commit behind this remote head. Native permission/background/writeback acceptance is outstanding. | Integrate the exact remote tip, including its conflict-skipping ingestion fix. Resolve conflicts and validate unknown/zero, units, RLS, imports and writeback. Extended collection/import flags currently default on: verify the devices or explicitly configure and test a disabled rollout before inclusion. Never assume a draft is disabled in production. No bulk repair or historical rewrite as part of release preparation. |
| [#5 Weekly activity](https://github.com/carhartt21/SparkyFitness/pull/5), `89fa20568` | Draft; 20 conflicts against main. Local tip is one commit behind. #6 explicitly incorporates its foundation, with subsequent prescription changes. | Compare both remote commits with #6, including category classification and localized dates. Close as superseded only after the integrated replacement is merged and coverage is recorded. Do not merge both implementations independently. |
| [#6 Coaching and activity outcomes](https://github.com/carhartt21/SparkyFitness/pull/6), `19fc0b3f0` | Draft; clean against current main but conflicts with the newer correction branch. Prior full tests/DB workflow checks are documented; authenticated German visual and native/device acceptance remain incomplete. | Integrate after the core corrections and micronutrients; preserve reviewed UI and activity semantics. Complete the outstanding review. Keep `XOT_COACHING_ENABLED` disabled until the owner workflow is accepted. A merge must not install a recurring runner or issue credentials. |
| [#7 Native widget styling](https://github.com/carhartt21/SparkyFitness/pull/7), `ec12d466b` | Draft; clean against main and the correction branch. Native gallery/typecheck evidence exists; real widget hosting, tap delivery, VoiceOver and Android launcher checks remain unverified. | Include after native host/action checks. Gallery screenshots alone do not establish WidgetKit behavior. If Android tooling remains unavailable, record that platform gap explicitly and verify that no Android release is being claimed. |
| `feat/caffeine-hydration-20261002`, `ff61b8a59` | Clean and ten commits ahead; includes meal actions, v38 corrections and latest caffeine/hydration work. | First application integration. Preserve the keyboard inset fix, compact matching dashboard cards, 24-hour plan selector, macro fit, and the drinks-versus-solid-food hydration rule. |
| `feat/wellness-activity-logging-20261002`, `ddfbcede4` | Clean against main; conflicts with coaching and the correction branch. Prior mobile/web/server and real-DB evidence is documented. | Integrate after coaching, resolving habit-category and idempotent creation together. Verify wellness remains distinct from numeric measurements and exercise calories. |
| `feat/watch-workout-edit`, `74f0118ff` | Unique pre-rename feature, not on main; conflicts in `WorkoutView.swift`. Main has newer active-energy/safe-finish work. | Port the weight/repetition editing onto current Watch code, retaining current workout recording and localization. Require phone/Watch retry, conflict, finish and energy regressions before merging. Do not discard it as an already-merged branch or let its older view overwrite main. |
| `docs/current-guides-20261002`, `1ce972437` | Clean, one commit ahead, tested documentation refresh. | Integrate near the end, then reconcile guides with the features actually included and update #1/#2. |

All merge candidates are owner-repository branches. The manifest diffs inspected add only runner/review/validation commands, not dependencies or install hooks. No candidate inspected changes the lockfile or GitHub workflows. This inventory and targeted source review does not replace the final security and behavior review of the combined patch.

## Todoist inbox triage

All five open inbox tasks and their comments were read. The keyboard, dashboard and habit-label attachments were visually inspected in this review; caffeine and hydration attachments were inspected in the preceding implementation and their evidence is recorded there. No task was marked complete.

| Task | Current evidence | v39 action |
| --- | --- | --- |
| Keyboard layout, `6hg8gjccwPVxW247` | The correction branch removes the duplicate iOS Done toolbar and measures the full localized action bar against the keyboard panel. Native normal/enlarged German save/dismissal evidence exists. The comment also requests checking other screens. | Run the final combined food quantity/note flows and spot-check shared numeric forms, workout planning, hydration and habits. Close implementation work after these checks; keep physical-device confirmation explicit. |
| Dashboard/progression, `6hgFrmmrW985jfF7` | Compact energy, moved goal action, progress above shortcuts, category-specific task icons, aligned columns/separators and check-in-last ordering exist in the correction branch. | Protect these during coaching/wellness conflict resolution. Verify new activity/wellness tasks use the same ordering and destinations rather than restoring the older checklist preview. |
| German “Mark fertig”, `6hgH2WPhwh8QpPw7` | **Still defective.** `habits.markDone` is literally `Mark fertig` in the reviewed overlay and HabitRow renders it. It is also unchanged in coaching and wellness. | Fix to a compact reviewed label such as `Erledigen`, with a complete accessible label. Review neighboring copy (`decrease`, `clearRecord`, undo/delete) for contextual German, regenerate catalogs and test/render HabitRow and WellnessCard. This is an actual remaining pre-build fix, not merely task cleanup. |
| Caffeine refresh, `6hgHqv6Xp45M2gJ7` | Fixed on the correction branch, not main. The screenshot contained a new rise as well as the old peak; the verified cause was the chart window/caption, not proven failure to retrieve the new drink. | Retest new energy drink save, edit/delete, local midnight, account timezone and older-dose residuals against the combined server. Then confirm on v39; do not claim the existing v38 binary is fixed. |
| Combine hydration, `6hgJ2hv6vp6FpMHf` | One full-width card and unified details implemented, including drinks and taken supplement water. Solid-food water stays detail-only. | Verify linked-source deduplication, volume/serving scaling, goal totals, history, undo/cache refresh and export exclusions after micronutrient/wellness integration. Old gram-only drink snapshots without volume metadata remain a documented limitation. |

## Integration stages

### 1 Preserve work and establish the release baseline

Create a fresh `integration/v39-20261002` worktree from fetched main. Record exact feature heads and private release/rollback metadata. Inventory dirty worktrees and create private patch/untracked-file backups where necessary; never blindly add legacy files, signing material or owner screenshots. Compare FDDB overlays with the already-landed `53c7092ef` release preservation, and old coaching/Watch drafts with their newer implementations. Delete nothing while provenance remains uncertain.

Read current production image revisions and migration ledger without exposing personal data. Recheck EAS/Apple build state: v39 is the intended next build, but EAS failed attempts can consume numbers. Do not force a stale build number.

### 2 Land the correction baseline and close the confirmed inbox gap

Integrate `ff61b8a59` once. Fix the habit copy and test the neighboring German actions. Run the documented focused correction suites and native keyboard/dashboard/hydration tours against this baseline. This creates the smallest independently useful v39 candidate if a larger feature cannot clear its gates.

### 3 Integrate connected data features in order

Integrate exact remote micronutrient head `63bec2029`, then coaching/activity `19fc0b3f0`, then wellness `ddfbcede4`. Preserve each feature's commits and isolate conflict resolutions in reviewable commits. Compare #5 with the integrated activity implementation before declaring it superseded.

Review source snapshots, quantity scaling, unknown versus zero, read/write permissions, account-scoped cache keys and backward compatibility with v38. Verify that hydration includes recorded drinks/supplement drinks once and only once, micronutrient writeback does not echo imported records, and planned activities do not become completed exercise/calorie data. Keep coaching activation and any native collection rollout explicit.

### 4 Finish native work

Integrate widget styling `ec12d466b` and port the unique Watch set editor. Keep production entitlements, shared app-group identifiers, existing shortcuts, Watch outboxes, energy collection and HealthKit single-writer behavior intact. Validate actual hosted widgets and actions, not only the isolated content gallery. Exercise stale/duplicate set operations, temporary IDs, disconnected edits, reconnect, finish and one exported workout. A native source/build pass cannot substitute for physical phone/Watch verification.

### 5 Resolve documentation and PR dispositions

Integrate the current guides, then update the two planning PRs with accurate shipped/planned status and current identity. Build docs and check links. Promote feature PRs only after evidence matches their resolved heads. Merge the approved integrated result to main, preserving ancestry or recording replacement commits. Close #5 as superseded only after #6's replacement is landed; close replacement PRs with their actual disposition rather than marking rejected/unverified work as merged. Keep a feature draft open if its acceptance cannot be completed; a zero-open-PR count is not a substitute for readiness.

Remove only clean, fully merged worktrees/branches after checking descendants and unique commits. Retain rollback refs, pending feature branches and unaccounted dirty files. The older micronutrient local and backup variants must be compared with the newer remote implementation before removal.

### 6 Validate the combined revision

Run a frozen install, server/shared-consumer/mobile/web `validate`, German overlay and copy audits, repository layout and whitespace checks. Use focused backend/real-DB integration tests for changed hydration, nutrient ingestion, activity/coaching, wellness, RLS and idempotency; retain the user's previous preference to skip the blanket backend suite. Run mobile/web regression suites and production web/docs builds and normal iOS export. A new conflict resolution requires its relevant checks even if the original branch was green.

Rehearse fresh startup and upgrade from the recorded v38 database schema in disposable databases, including restart/idempotency and retained history. Several branches use the same timestamp prefix in different migration filenames; the runner keys by the **full filename**, so this is not itself a duplicate migration ID. Confirm filename order satisfies dependencies. Do not rename an already-applied migration or hand-edit the schema backup.

Capture the final German UI at 390×844 dark/light and 430×932 enlarged text, plus web reference/narrow layouts. Cover meal status from goals, quantity and note keyboards, weekly time/date controls, compact dashboard, caffeine, hydration source history, habits/wellness, activity outcomes and recommendations. Native fixture persistence and real server persistence must remain separately reported.

### 7 Prepare and launch the release after acceptance

Create a new private v39 release package pinned to the exact merged main commit. The existing `xot-release-v38-20261002/launch.sh` points at the v37-corrections checkout, and its deployment helper and attempt markers belong to v38. Do not rerun it unchanged or remove its duplicate-submission protection. Adapt the existing script workflow with fresh paths, commit/checksum pins and attempt records; keep credentials outside Git.

Follow `XoTMobile/docs/testflight-release.md`. From clean source, run the production EAS build with automatic submission; use the documented local archive/export/API-key upload only as the fallback. Do not submit the same artifact through both paths.

Once the source is accepted and release execution is authorized, run build/upload and production deployment concurrently from that same commit. Deployment requires a matched encrypted backup verified off-host, retained image/configuration rollback, migration checks, unchanged mounts/private routing and BLS availability. Deploy the new server before distributing mobile code that uses its hydration detail endpoint. Preserve v38 compatibility if the mobile build is delayed. Image rollback does not undo schema migrations.

Verify frontend/API health and source revisions, then separately verify EAS build completion, Apple processing and internal TestFlight availability. Record real outcomes, not queue acceptance as release success. Update Todoist only with the corresponding implementation/release evidence.

## Conflict resolution map

These are actual read-only `git merge-tree` results, not guesses and not applied merges. Counts are pairwise; the final cumulative merge can reveal additional conflicts.

| Comparison | Conflicts | Resolution requirements |
| --- | --- | --- |
| Main → micronutrients | 14 | Union cache invalidations, shared exports and security/API docs; preserve current Vite native-resource copying and isolated review script behavior. Reconcile English and reviewed German overlays, then regenerate synced German catalogs. |
| Corrections ↔ coaching | 7 | Resolve DashboardScreen, DailyProgressScreen and MealTypeDetailScreen so compact layouts, task ordering and meal-state controls coexist with new activity/proposal actions. Combine translations by meaning. |
| Corrections ↔ wellness | 5 | Preserve both review runner scenarios and translation sets. |
| Coaching ↔ wellness | 13 | Combine `dailyTrackingRepository` category filters, concurrent/idempotent creation and revision behavior, plus permission docs and translations. Test real DB behavior; a syntactically clean result is insufficient. |
| Coaching ↔ micronutrients | 19 | Combine exports, caches, package guides, API/security docs and review tooling; ensure health writeback semantics remain coherent. |
| Main → old Watch editor | 1 | Rework `WorkoutView.swift` against the current safe-finish/energy view; inspect all automatically merged transport/store changes too. |
| Corrections ↔ widget styling; corrections ↔ current guides | 0 | Still run semantic/native and documentation checks after cumulative integration. |

Never resolve localization, shared exports, database policies or cache families with blanket “ours/theirs”. Automatically merged changes also require semantic review, particularly hydration versus micronutrient export and activity versus wellness progress.

## Review limits and readiness decision

This pass refreshed Git refs, inspected all open PR metadata/review discussions, compared ancestry and dirty worktrees, ran read-only conflict rehearsals, reviewed five inbox issues and existing validation evidence, and inspected the release scripts/records. It did not run the combined application, rerun package tests, modify production, close tasks/PRs or execute merges.

The correction branch is the strongest starting point. The German habit label is a confirmed remaining defect. Micronutrients, coaching, widgets and the old Watch editor need explicit integration/acceptance work before the entire feature set can be called v39-ready. Preserve a releasable correction baseline while clearing those gates; document any deferred feature instead of silently shipping it or deleting its PR.
