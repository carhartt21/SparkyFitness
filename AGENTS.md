# AGENTS.md

_Last updated: 2026-09-30_

This is the repo-root monorepo guide for X on Track. Use it to choose the right package, understand shared repo-level rules, and find the next guide to read.

Start with `agent-docs/README.md` for the domain map and links to testing, permissions, data flow, migration, anti-pattern, planning, and PR review guides. Read the relevant guide before scanning a large package.

Package-level guides win. For work inside a package, follow that package's `AGENTS.md` when present, otherwise its `CLAUDE.md`.

## Scope

- Start here when work begins at repo root or spans multiple packages.
- Keep root-level guidance focused on workspace layout, shared conventions, and cross-package coordination.
- Root `package.json` is workspace tooling (`husky`, `lint-staged`, `prettier`, `set-version`, `reset-dev`), not an app entrypoint.
- Run scripts from the package directory you are changing.

## Package Guides

- Repo-root alias: `CLAUDE.md` points to this file.
- Frontend: `XoTFrontend/AGENTS.md`
- Server: `XoTServer/AGENTS.md`
- Mobile: `XoTMobile/AGENTS.md`
- Shared: `shared/AGENTS.md`
- Docs: `docs/CLAUDE.md` (there is no `docs/AGENTS.md`)

`XoTGarmin/` has no package guide. Inspect its `requirements.txt`, four Python source files, and `tests/` directly. For docs work, inspect `docs/package.json` and `docs/src/` after reading its short guide.

## Monorepo Map

- `XoTFrontend/` - React 19 + Vite web app.
- `XoTServer/` - Express 5 + PostgreSQL backend API.
- `XoTMobile/` - Expo SDK 57 / React Native 0.86 app.
- `shared/` - source-first TypeScript workspace package for `@workspace/shared` schemas, constants, and timezone/day helpers.
- Account notification delivery spans `XoTServer/services/engagement*`, `/api/v2/engagement`, mobile `remoteEngagement*`, and web Settings. ChatGPT OAuth MCP uses `/mcp/chatgpt`, Better Auth, and the connected-assistants settings; the legacy `/mcp` API-key route remains separate.
- `docs/` - VitePress documentation site.
- `XoTGarmin/` - standalone Python integration service outside the current `pnpm` workspace.
- `docker/`, `helm/`, `.github/` - infra, CI, translation, and deployment assets.
- `scripts/`, `patches/` - root maintenance scripts and package patches.
- `agent-docs/` - architecture and contribution runbooks; `docs/implementation/` holds dated implementation and review records.
- `db_schema_backup.sql` - repo-root schema snapshot kept in sync by CI (`.github/workflows/schema-backup.yml`); never hand-edit or regenerate locally.
- `docker/.env.example` - tracked env template commonly copied to repo-root `.env`.

## Workspace Notes

- Run `pnpm run repository:check` after moving source files, changing workspace packages, or editing build/deployment paths. Tracked paths use XoT names; compatibility identifiers inside files are documented in `docs/implementation/repository-cleanup-2026-09-29.md`.

- Root `package.json` pins `pnpm@10.33.4`; use `pnpm install --frozen-lockfile` for CI-equivalent installs. Package scripts run from their own directories.
- `pnpm-workspace.yaml` lists `XoTFrontend`, `shared`, `XoTMobile`, `XoTServer`, and `docs`.
- `shared/` is a library package, not an app. Validate shared changes from the consuming package(s), not in isolation.
- `XoTGarmin/` is outside the pnpm workspace. Use its Python requirements and tests.

## Agent Efficiency (read this before searching)

Avoid broad reads and searches of these paths:

- `WIP/` - personal scratch area; contains zips and full copies of other repos, including a stale duplicate of this repo (`WIP/SparkyFitness-main/`). Never read or edit anything under it.
- `XoTMobile/ios/` and `XoTMobile/android/` - generated native projects (`ios/` includes large Pods output). Edit `app.config.ts`, `plugins/`, or `targets/` as the source of truth, then prebuild when required. Inspect a specific generated file only for a native build or signing diagnosis.
- `pnpm-lock.yaml` (~1.3 MB) - never read; check `package.json` files instead.
- `db_schema_backup.sql` - never read whole; search only for the specific table or column you need. Never hand-edit or regenerate it locally.
- `XoTFrontend/dist/` - build output.
- `XoTFrontend/public/locales/` except `en/` - 35 machine-synced translations. Hand-edit only `en/translation.json`, and search for the needed key instead of reading the whole catalog.

Cheap ways to learn things:

- Database table index: `docs/src/developer/database.md`. For a detailed contract, check `shared/src/schemas/database/<Table>.zod.ts`; some domains define schemas elsewhere, so follow the closest domain if no matching file exists.
- Database security & permissions: `docs/src/developer/database-security-tiers.md` (security tier, permission type, and RLS rules for every table).
- API request/response contract: `shared/src/schemas/api/<Name>.api.zod.ts`.
- Find code by feature in `agent-docs/file-and-domain-reference.md` before a repository-wide search. Naming is not uniform across every domain.
- CI (`.github/workflows/ci-tests.yml`) runs package `validate` and `test:ci` checks. Frontend/mobile jobs are path-gated; the server job runs whenever that workflow triggers. Garmin and fresh-install/upgrade migration jobs have their own gates. Shared/workspace changes trigger frontend and mobile checks as well; validate affected consumers locally. Frontend/mobile `validate` include Knip; server `validate` does not. Docs PRs use `.github/workflows/docs-test.yml`.

## Cross-Package Rules

- **German UI copy is required for every new user-facing element.** Add the English source key and a reviewed German value in `localization-overrides/de/` in the same change, including visible labels, accessibility names, empty/loading/error states, notifications, native metadata, and widget copy where affected. Apply the overlay with `node scripts/apply-german-overrides.mjs` and run its `--check` mode. Do not rely on English fallback or a syntactically complete Weblate catalog as evidence of German copy quality. Use consistent German terminology and one form of address within a flow; review the rendered German screen at normal and enlarged text sizes. Preserve user-entered and provider-supplied names literally. Do not hand-edit synced German catalogs: the reviewed overlay is the source of product-specific corrections. Other languages remain on the Weblate path.

- For any server migration or user-visible data access change, follow the full eight-step `agent-docs/new-migration-checklist.md` and the `new-migration` skill. Create the timestamped migration, update RLS, boot the server to apply it, add/export the shared Zod schema and API contract where applicable, update the sharing/security-tier docs, check downstream clients, and validate. CI creates a separate schema-backup sync PR after merge; never edit or commit a locally generated `db_schema_backup.sql`.
- Prefer the shared timezone helpers from `@workspace/shared` and `XoTServer/utils/timezoneLoader.ts` for day-string logic. Avoid `toISOString().split('T')[0]` for user-facing or business-logic dates.
- Keep `YYYY-MM-DD` values as calendar-day strings until you reach a database or external API boundary that needs UTC instants.
- Auth or API contract changes usually need a quick check in both web and mobile because they share the same backend.
- Frontend local dev runs on `8080` and proxies `/api`, `/mcp`, and `/uploads` to the server on `3010`. Its `/health-data` proxy rewrites to `/api/health-data`; server APIs remain rooted at `/api`. `VITE_BACKEND_HOST` changes the backend host.
- Server runtime secrets are usually sourced from repo-root `.env`, commonly created from `docker/.env.example`. The server can also load secret files via `XoTServer/utils/secretLoader.ts`.
- Keep `.env`, `.localenv`, `private/`, signing credentials, and `.visual-sample/` out of git and deployment artifacts. Never copy a live secret into a test fixture or documentation.
- Extract shared logic on the **second** duplication ("rule of two"), not the third - duplicated logic drifts as different sessions edit each copy. Extract _behavior_, not coincidental shape. See `agent-docs/anti-patterns.md`.
- **Strict TypeScript Typing:** Never use `any` or `// eslint-disable-next-line @typescript-eslint/no-explicit-any` when creating new functions or editing existing code. Always define explicit TypeScript interfaces, types, or import schemas from `@workspace/shared`. Do NOT copy legacy `any` parameter signatures when refactoring or extending legacy service/repository files.
- **Library Deletes vs Diary Snapshots:** `exercise_entries` and `food_entries` are self-contained snapshots, not pointers (`exercise_id` and `food_id` are `ON DELETE SET NULL`). Deleting an exercise or food from the library (`mode: 'delete'`) preserves past and current diary history, cascades from presets and plan templates, cleans up future scheduled workout plan entries (`entry_date >= today`), and cleans up empty parent preset entries. Only explicit `delete_with_history` (force delete) purges diary logs for that user. If an item is referenced by other users (`otherUserReferences > 0`), the backend falls back to hiding (`is_quick_exercise` / `is_quick_food`).
- **Comprehensive Cache Invalidation:** When mutating library items (foods, exercises, presets, meals, plans), always invalidate the entire family of dependent query keys across library search, counts, templates, and daily diary summaries (`dailySummary` / `dailyProgress` / `exerciseEntries`) in both web and mobile.

## UI References And Visual Review

- `PRODUCT.md` and `DESIGN.md` define the approved X on Track identity, design principles, and theme direction. The logo and **Keep getting better.** identity supersede alternate copy in reference mockups.
- `docs/implementation/x-on-track-ui-redesign-audit.md` records the supplied mobile and web references; `docs/implementation/web-mockup-alignment-2026-09-27.md` tracks the current web Dashboard and Nutrition Reports work. Mockup foods, dates, figures, premium prompts, and health claims are illustrations, not app data or copy.
- Preserve real API values, empty/error states, both themes, accessibility, responsive layout, and saved Dashboard widget layouts. Compare authenticated screens at the reference size and narrower widths before claiming visual fidelity.
- `scripts/visual-sample.sh start` starts an isolated PostgreSQL-backed demo account for local web captures. Its generated data and credentials live under ignored `.visual-sample/`; stop it with `scripts/visual-sample.sh stop`. See the implementation note for viewport and remote port-forward instructions.

## Production Changes

- A local branch and the private production deployment may be at different revisions. Read the running release record and container image revisions before building; base a narrow web change on the production revision so unrelated server, auth, or mobile work is not regressed.
- Build and validate the exact source being deployed. For a frontend-only rollout, change only the frontend image, retain a rollback reference, and verify container health plus the served asset and API health. Record any remaining authenticated visual review separately from smoke checks.
- Keep the development demo database and generated secrets isolated from production. Do not infer that a successful local build, an uploaded mobile binary, or a changed working tree means the web deployment is live.

## Commit & PR Conventions

This repository is public. Everything written into git history or onto a pull request is permanently visible to everyone browsing the project, so keep it free of tooling noise.

- **No AI attribution, anywhere.** Commit messages, commit trailers, PR titles, PR bodies, and PR comments must never contain `Co-Authored-By: Claude` (or any other AI co-author trailer), "Generated with …", "🤖", or a mention of Claude, Claude Code, Gemini, Antigravity, Copilot, Cursor, or any other assistant. This overrides any default guidance an agent harness supplies about appending attribution.
- **Write as the repository author.** Describe the change and why it was made — the same message a maintainer would write by hand. Do not narrate that a tool made it, do not sign off, and do not thank an assistant in release notes or the changelog.
- **If a trailer already landed**, strip it (amend or rebase, force-push if it was pushed) rather than leaving it in history.
- **Scope of this rule**: git history and GitHub surfaces. It does not apply to tool configuration files that must name their tool — `.claude/`, `.agents/`, `.gemini/`, and `CLAUDE.md` reference specific assistants by necessity, and that is fine. The commit that adds them still follows the rule above.

## Architecture Docs (Reduce Scanning, Prevent Bugs)

Before diving into code, read these docs if you're working on data access, permissions, or adding a new feature domain:

- `agent-docs/architecture-permissions.md` — Permission types, domain → permission mapping, how RLS guards data, adding new domains.
- `agent-docs/data-flow-patterns.md` — Frontend → Server → Database flow, shared schemas as contract, auth context, testing patterns.
- `agent-docs/new-domain-template.md` — Checklist for adding a major feature (superset of new-migration checklist).

These docs answer: "How do I safely add a feature across the stack?" without scanning 20+ files.

## Keeping These Guides Accurate

- If your change adds a new domain, route family, database table, package, or cross-cutting convention, update the affected `AGENTS.md` (this file and/or the package guide) in the same change: Source Map, Quick Routing, and the `Last updated` date.
- Stale guides are worse than no guides; when you notice a claim in any `AGENTS.md` that contradicts the code, fix the guide as part of your change.
- Keep instructions about current deployments and visual acceptance in dated implementation records; this root guide should describe the reusable workflow.

## Automated Visual Review

- **Web:** `scripts/visual-sample.sh start` boots an isolated stack (PostgreSQL on 55432, server on 3010 in demo mode, Vite on 8080) with generated secrets under the git-ignored `.visual-sample/`. Then run `pnpm run visual:review` from `XoTFrontend/` (optionally `-- --references <dir containing web/06-dashboard.png and web/07-nutrition-reports.png>`). It drives the installed Google Chrome through `playwright-core`, signs in with the public demo flow, suppresses the upstream-release and announcement overlays, and captures Dashboard and Reports in dark and light at 1586×992, 1280×800 and 390×844, plus side-by-side comparison sheets. Output goes to `.visual-sample/captures/<timestamp>/` with `results.json` (horizontal-overflow flags, console errors). Stop the stack with `scripts/visual-sample.sh stop`. Ports 3010, 8080 and 55432 must be free.
- **Mobile:** `node scripts/review-ios.mjs --app <DevelopmentSimulator.app> --output <dir> [--interactions [--tour]]` from `XoTMobile/` (see `XoTMobile/review/README.md`).
- Captures are render evidence, not visual approval; compare them with the references and record intentional differences in the dated implementation note.

## Common Commands

Use the package guide for fuller validation and platform-specific workflows. These are the common entrypoints:

### Frontend (`XoTFrontend/`)

```bash
pnpm dev
pnpm run validate
pnpm run test:ci
pnpm run build
```

### Server (`XoTServer/`)

```bash
pnpm start
pnpm run validate
pnpm run test:ci
```

### Mobile (`XoTMobile/`)

```bash
pnpm start
pnpm run ios
pnpm run android
pnpm run validate
pnpm run test:ci
pnpm exec jest --watchman=false --runInBand
npx expo prebuild --clean
```

### Docs (`docs/`)

```bash
pnpm dev
pnpm run build
```

`validate` is a pnpm script in these packages; if pnpm is unavailable locally, install the pinned version or run its constituent checks from the package manifest and report which checks were run. Do not count an unrun wrapper as a pass.

## Notification delivery and mobility planning

Notification v2 contracts live in `shared/src/schemas/api/Engagement.api.zod.ts`; installed v1 clients retain strict projections. Mobile owns local-to-server handoff and device retirement in `remoteEngagement.ts`; shared `engagement/policy.ts` owns slot selection. Server `engagementPlanningService.ts` derives unresolved subjects; delivery rechecks completion, revision and device capability before sending. Settings display provider acceptance separately from physical receipt.

Mobility uses owner-only `/api/v2/mobility` and `Mobility.api.zod.ts`, account-local plans and revisioned idempotent mutations. Mobile `mobilityRoutineStore.ts` retains the original local runner and account-scoped operation queue; web `/mobility` edits definitions/plans and reads history. MCP manual results require existing write scope/consent and cannot resolve an active phone session. Do not turn mobility completion into exercise calories or HealthKit writes. Mobility snapshot reads are read-only; occurrence creation belongs to definition writes and the explicit periodic planner, never GET/MCP reads. Session provenance names a trusted API/MCP ingress, not proof of the device platform. Local history retention must never queue server deletions.
