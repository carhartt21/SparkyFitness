# Repository cleanup — 29–30 September 2026

Source baseline: `9fa073ef04` (the serving-size/German-copy release). The cleanup is separate from the already submitted 1.7.2 (33) binary and the currently deployed web/API revision. It does not submit another build or deploy production.

## Current source layout

| Previous source directory | Current directory | Workspace package            |
| ------------------------- | ----------------- | ---------------------------- |
| SparkyFitnessFrontend     | `XoTFrontend`     | `xot-frontend`               |
| SparkyFitnessServer       | `XoTServer`       | `xot-server`                 |
| SparkyFitnessMobile       | `XoTMobile`       | `xot-mobile`                 |
| SparkyFitnessGarmin       | `XoTGarmin`       | Python service, outside pnpm |
| `docs`                    | `docs`            | `xot-docs`                   |

The server entry module is `XoTServer/XoTServer.ts`; startup still runs `index.ts`. The shared chat-history schema/type exports use `TrackbotChatHistory`. Android Kotlin source folders use `com/xot`, while declared native package names remain compatible. Widget layout/provider XML files use `xot_` filenames. Source folders in the old brand-asset archive also use XoT names.

Workspace importers, package filters, Dockerfiles, compose source mounts, CI paths, Nix expressions, maintenance scripts, localization tooling and documentation were updated together. The unused `frontend` workspace entry was removed. `pnpm run repository:check` checks tracked names, workspace identity, build-script paths and native resource destinations; CI runs it after dependency installation. Shared/workspace changes also trigger web/mobile validation.

Watch build targets/products are now `XoTWatch` and `XoTWatchWidget`. The Watch simulator helper builds the target directly into a unique temporary directory instead of scanning unrelated DerivedData. It passes executable arguments directly and waits for simulator boot before installation.

## Upgrade/build requirements

After switching from the old directory layout, run a frozen pnpm install and regenerate native projects with **clean prebuild** (`pnpm run prebuild` from `XoTMobile`). This avoids retaining duplicate Kotlin classes or obsolete Apple target products from an older generated project. Generated iOS/Android projects are not source-of-truth files and were not committed. Use `XoTMobile/docs/testflight-release.md` for release signing/export.

EAS credentials are keyed by the signed target bundle IDs. After prebuild, verify the downloaded credentials cover the five actual targets before a future signed build; do not change bundle IDs to match source/product names.

## Compatibility boundaries

The remaining legacy strings inside files are deliberate where externally meaningful:

- `com.cg.phi` and its extensions; `group.com.cg.phi`; Android app IDs and Kotlin package declarations.
- Existing URL schemes, OAuth callback/origin values, widget kinds/receivers, keychain/local-storage keys and notification action IDs.
- Database tables/columns, historical migrations, API routes, environment variables, cookie names, health source tags and backup/production service names.
- The Expo project ID/`personalbest` slug, upstream repository/translation URLs, license and copyright attribution.
- Historical test output, screenshots and revision evidence. These records are not rewritten to pretend they were captured with the new layout.

No health records, goals, credentials, catalogue or live deployment configuration were migrated. The old-brand localization replacement remains so legacy source copy still renders as X on Track.

## Local cleanup and archives

19 inactive merged/equivalent worktrees and 20 old local branches were removed. Three artwork commits were patch-equivalent rather than ancestors of main; local `archive/merged-patches/*` tags retain their exact history. Remote branches were not deleted.

Two old checkouts contained useful uncommitted material. Before removal, their private source snapshots were archived, verified and checksummed; staged/unstaged web patches and the patch base were also preserved. The reverse-apply check passed for the staged patch. Private archives and the detailed machine inventory are outside this public repository, under `XoT-local-archive/2026-09-29`.

The primary checkout and two merged worktrees (`xot-progression`, `xot-serving-sizes`) remain because development tools still have them open. The primary checkout also owns Git metadata and contains local reference/import files. They were not force-deleted or renamed underneath running tools. A newly appearing `feat/serving-sizes-ui` branch and `xot-serving-ui` checkout were retained as active work. The deployment checkout and live production directory names remain bound to existing operational configuration.

Seven superseded UI reviews moved to `archive/ui-2026-09-26/`; links were repaired and the records are explicitly historical. Their evidence remains intact. The [implementation index](README.md) points to current runbooks and still-pending upstream feature evaluation. Private FDDB exports and original reference archives are explicitly ignored.

## Validation

- Frozen/offline dependency installation: passed; dependency versions and resolved packages unchanged. Lockfile changes only rename three importer paths.
- Repository layout and workflow YAML syntax: passed. No tracked filename contains `Sparky`.
- Web/server/mobile validation wrappers: passed (typecheck, lint, formatting and package-specific localization/Knip checks).
- Web Jest: 161 suites / 1,423 tests passed. Web production build and VitePress documentation build passed; existing chunk-size warnings remain.
- Server Vitest: 434 files / 5,182 tests passed; 9 files / 316 tests skipped. The initial sandboxed run could not bind HTTP test ports; the unrestricted rerun passed. Live database integration checks represented by skipped tests were not performed.
- Mobile targeted native/config/auth checks: 9 suites / 163 tests passed.
- Full mobile Jest: **507 suites / 7,392 tests passed** on the final rerun. The first run passed 506 suites / 7,391 tests and exposed one stale Diary label assertion. The component and test were byte-identical to main. The existing UI uses the short `Net carbs` label; the assertion was updated and now also verifies the 50−15 = 35 g calculation through its accessible label. The corrected 13-test suite passed.
- Root PR-policy tests: 11 passed. `git diff --check`: passed.
- Expo iOS/Android prebuild without dependency installation: passed; generated bundle IDs/app groups remain unchanged. Apple team selection was not supplied for this unsigned verification.
- Direct unsigned simulator build of `XoTWatch` and `XoTWatchWidget`: passed. The generated all-target scheme failed on the phone's missing `ExpoWidgets` Pods; it is not recorded as a full iOS build pass.

No signed phone build, physical-device upgrade, simulator installation/launch, Android Gradle build, production Docker image build or deployment was performed for this cleanup. The ongoing release remains separate.

The maintained cleanup checkout is at `Projects/XoT` on `chore/xot-repository-cleanup-20260929`. Existing open checkouts are not automatically switched to this branch; use its renamed package paths for the next build after review/integration.
