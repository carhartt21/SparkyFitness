# Recent feature branch review and merge strategy

Review date: 30 September 2026. `origin` was fetched successfully; local and remote `main` are at `f80035495`. Seven local branches have unmerged work. This was the initial read-only review. The owner subsequently authorized execution; see the [integration execution record](feature-batch-integration-2026-09-30.md) for corrections, validation and the final disposition.

**Initial verdict: changes requested before combining everything.** Integrate the repository cleanup, BLS language fix and notification corrections first, after repairing the cleanup's CI invocation. The favicon is independent. Hold serving-size UI and the Watch features for the corrections below.

## Branch readiness

| Branch                                           | Reviewed tip | Disposition                                      | Reason                                                                                                                                                                  |
| ------------------------------------------------ | ------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chore/xot-repository-cleanup-20260929`          | `0e5f94124`  | Hold for CI fix                                  | Four jobs invoke a root-only script from package working directories. This is the foundation for the new source paths.                                                  |
| `fix/bls-display-language-20260930`              | `10286a29a`  | Ready after cleanup                              | UI locale reaches provider search and details; cache identity follows it. Optional query parameters preserve old clients. No catalogue or saved-name rewrite.           |
| `feat/notification-mobility-corrective-20260930` | `1b4320cfc`  | Ready after cleanup and BLS, with upgrade checks | The prior data-loss and read/write findings are corrected. Exact-tip package and PostgreSQL evidence is recorded separately. Physical delivery remains unverified.      |
| `chore/web-favicon`                              | `8f24bb95f`  | Ready after path resolution                      | Canonical mark paths and colors are retained, with thicker strokes, a correspondingly wider taper and tighter framing for small icons. No application behavior changes. |
| `feat/serving-sizes-ui`                          | `ec5a85a7c`  | Changes requested                                | Valid typed amounts and bounded spinner arithmetic are fixed, but blank/zero drafts still submit the previous amount. The new parallax ignores Reduce Motion.           |
| `feat/watch-progress-x`                          | `75e0e5eeb`  | Changes requested                                | New complication copy lacks German resources; its mandatory geometry check imports TypeScript directly under Node 20 CI.                                                |
| `feat/watch-food-layout`                         | `f93d8918e`  | Changes requested                                | New serving/custom-amount copy and accessibility text lack German resources. Native compilation alone does not verify logging/reconnect behavior.                       |

Trust review found no new dependency, install hook, external service, credential flow or widened authentication boundary in the four UI/asset branches. Progress X adds a local generator/check script. Cleanup changes build paths and CI, not dependency versions; its concrete CI defect is listed below. Notification security and migration review is documented in [the corrective review](notification-mobility-review-corrections-2026-09-30.md).

## Confirmed corrections before merge

1. **P1 — cleanup CI fails before validation.** `.github/workflows/ci-tests.yml:158`, `:203`, `:272` and `:368` run `pnpm run repository:check` under `XoTMobile` or `XoTServer`. The script exists only at root. Running that exact command from `XoTMobile` reproduced `ERR_PNPM_NO_SCRIPT`; pnpm explicitly recommends `pnpm -w run repository:check`. Use the workspace-root invocation, or set the step's working directory to root. Check all jobs, including fresh-install and upgrade migrations.

2. **P1 — an invalid amount silently logs the previous amount.** On serving-size UI, `SparkyFitnessMobile/src/components/AmountWheel.tsx:103–109` keeps the draft locally and updates the screen only for positive parsed values. Clearing the field or typing `0` leaves the screen's old quantity valid. Two temporary rendered regression cases both submitted quantity `1` after those edits, when Add should refuse the invalid draft. Make validity and draft state visible to the submission path, disable/refuse Add until valid, and commit regression tests for blank, zero, decimal separators and valid focused submission. The temporary review tests were removed; no feature source was changed.

3. **P2 — serving-size hero ignores Reduce Motion.** `SparkyFitnessMobile/src/screens/FoodEntryAddScreen.tsx:2038–2065` always scales/translates the hero using scroll offset. Gate these transforms with the existing reduced-motion convention and verify the enabled setting. Existing captures cover English dark at 430 points; German, light, narrow widths and enlarged text remain open. The inspected comparison sheets predate later macro/hero refinements and are not visual approval of the exact latest tip.

4. **P1 — Progress X's new validation step needs a compatible runtime.** `SparkyFitnessMobile/scripts/watchProgressXGeometry.mjs:9–12` imports `shared/src/brand/progressionX.ts` directly. Its `node` invocation was added to `validate`, while mobile CI selects Node 20 at `.github/workflows/ci-tests.yml:150`. The check passed on local Node 26.7.0 and failed with `ERR_UNKNOWN_FILE_EXTENSION` when native TypeScript stripping was disabled. This reproduces the unsupported import, not an actual Node 20 run. Use an explicit supported runner already available in the project, or align CI with a verified runtime; keep a single canonical geometry source and add a CI-runtime check.

5. **P2 — new Watch surfaces violate the required German localization gate.** `ProgressXComplication.swift:263–285` returns English dynamic summaries/accessibility labels; its title and widget configuration are also English. `FoodQuickLogView.swift:294–338`, `:347`, `:421` and `:445` add English serving, amount and accessibility text. No Watch/Watch-widget translation resources accompany either diff. Add reviewed English/German native resources and explicit interpolation-aware lookup for dynamic strings, wire them into both separate targets, and extend the locale checker to these targets. The current mobile validator passes despite this gap.

Further Watch checks should include small-wrist/enlarged-text layout, reduced-motion transitions, custom quantity previews versus saved snapshots, and bounded thumbnail retry/cache behavior. These checks are not claimed as observed defects.

## Merge rehearsal and conflict handling

Read-only `git merge-tree --write-tree` rehearsals used temporary Git objects without changing refs or working trees:

- `main` → cleanup → BLS → notification corrections: **no conflicts**. Main's already-merged intake gauge is retained.
- Core plus favicon: four newly added assets need explicit placement under `XoTFrontend/public/` after the directory rename. The existing HTML edit follows its renamed file.
- Core plus serving-size UI: four new files need placement under `XoTMobile/`; `localization-overrides/de/mobile.json` also has a content conflict. Preserve both changes' reviewed keys/copy, then regenerate/check catalogs; do not choose one entire catalog. Navigation/header/review-harness edits auto-merge but still need behavioral validation.
- Core plus Progress X: six new test/generator/widget files need placement under `XoTMobile/`.
- Core plus Watch food layout: four new test/service/native files need placement under `XoTMobile/`.
- Progress X plus Watch food layout: **no textual conflicts**. Their overlapping context mapper, model, session manager and bridge edits coexist. Combined Watch and Watch-widget Swift source type-checks pass. This does not prove runtime synchronization.

Use an integration branch based on current `main` for the actual rehearsal. Keep merge ancestry rather than cherry-picking the stacked notification branch or force-rebasing active worktrees. Resolve new-file directory conflicts into XoT paths; never recreate obsolete package directories. Recheck tips before execution because other work may continue after this review.

## Staged implementation and merge order

1. **Repair and integrate the foundation.** Correct root CI invocations on cleanup. Frozen install, repository layout check and affected validation must pass; check the new paths in Docker, CI and release tooling. Merge cleanup into the integration branch, preserving main's gauge fix. Then integrate BLS and notification corrections in that order, with distinct merge commits for reviewability.
2. **Prove the core upgrade.** Run server/web/mobile validation and relevant full suites on the integrated tree, plus fresh-install and upgrade migration checks. Verify retention past 100 mobility sessions, explicit deletion, moved plan dates, read-only GET/MCP and reminder ownership/legacy-device compatibility. Keep pre-upgrade database and release references before any separately authorized rollout. Lookup repair constraints may abort on pre-existing conflicting data; investigate rather than deleting records or bypassing constraints.
3. **Integrate the favicon independently.** Resolve its four asset locations. Verify HTML and built asset URLs, PNG/ICO sizes and browser small-size appearance. It need not wait for native UI fixes.
4. **Repair and integrate serving-size UI.** Fix invalid-draft submission and reduced motion. Resolve the German overlay deliberately. Re-run food selection, servings, create/edit/delete, barcode/external hydration, focused quantity submission and keyboard-safe notes. Capture the final German/light/dark layouts at 390 and 430 points with enlarged text. Preserve the existing nutrition snapshots and categorical macro colors.
5. **Repair and integrate the Watch pair.** Fix the Progress X runtime check and add German copy to both targets. Integrate Progress X before Watch food layout for a clear review sequence; no functional dependency requires this order. Rebuild clean native targets and verify neutral/unknown/partial/full progress plus food amount/portion selection, queued offline logging and reconnect exactly once. Avoid reapplying the gauge change already in main.
6. **Freeze one release candidate.** Run final checks once on the exact combined revision. After separate merge/release authorization, merge the approved candidate to main. For rollout, use the renamed TestFlight runbook, clean prebuild and the existing five signed target IDs/app group. Deploy compatible API/web before activating client features, then publish the signed client. Check in-place entry preservation, language switching, reminder receipt, complication links and Watch logging. Keep application-image rollback references; a database migration is not undone by reverting a merge commit.

The core/favicons can be released as an earlier batch if serving-size or Watch gates remain open. Do not hold verified server fixes behind unfinished cosmetic work, and do not ship blocked features merely to combine every branch.

## Verification evidence and limits

Checks performed in this review:

- Serving-size UI: mobile `validate` passed; five targeted suites, **88 tests passed**. Two additional review cases for blank/zero submission **failed**, confirming the blocker.
- Watch food layout: mobile `validate` and TypeScript checks passed; **10 targeted tests passed** for shortcut amounts and thumbnail transfer.
- Progress X: generated geometry parity passed on local Node 26; Watch and Watch-widget source type-checks passed separately.
- Combined Watch branches: **20 Watch and 7 Watch-widget Swift files** type-checked against the installed Watch simulator SDK, with watchOS 11 deployment target. This is neither a linked Xcode build nor a signed-device test.
- Favicon: visually inspected Apple touch export, checked canonical path identity and optical taper adaptation; PNG sizes are **180×180** and **32×32**, ICO contains **16/32/48** sizes. Browser runtime capture was not performed.
- All four UI/asset branch diffs passed `git diff --check`.
- Merge rehearsals above passed or produced the explicitly recorded conflicts.

The unchanged notification corrective tip already has evidence from the preceding correction: all three validation wrappers, **5,213 server / 7,415 mobile / 1,427 web tests**, and **18 isolated PostgreSQL integration tests** passed. Full suites were not repeated here; that evidence does not automatically validate a future combined tree.

GitHub PR/check/thread status could not be inspected because `gh` has no authenticated session. Origin fetch worked. No physical push, signed phone/Watch upgrade, Dynamic Island, lock-screen or production deployment check was performed in this review.

## Excluded work and branch housekeeping

`fix/intake-gauge-glow`, `feat/serving-sizes`, `fix/compact-meal-status-20260929` and the older local rebrand branch are already ancestors of main. The fetched remote rebrand/progression/release branches are also merged; do not merge them again. Two old remote documentation branches have unique September 23 commits; they are historical roadmap material, not this feature-release batch, and require a separate relevance check before integration/archive.

The primary old-brand checkout and detached `xot-fddb-20260930` checkout contain uncommitted FDDB UI/import/RLS work, including an untracked migration. Exclude it from this candidate until collected into its own reviewed branch and checked against the renamed layout. Do not treat worktree changes as committed branch contents or delete those checkouts. The pre-existing `.impeccable/critique/` directory remains untouched.
