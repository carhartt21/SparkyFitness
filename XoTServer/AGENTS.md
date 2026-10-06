# AGENTS.md

_Last updated: 2026-10-06_

X on Track Server is the backend API package for the X on Track monorepo. Use this file as the primary guide for work inside `XoTServer/`.

**Quick Links for AI Tools:** See `../agent-docs/README.md` for:

- `file-and-domain-reference.md` — Where to find server code by feature
- `testing-patterns.md` — How to test routes, services, repositories, and RLS
- `architecture-permissions.md` — Permission types and RLS patterns
- `new-migration-checklist.md` — 8-step database change checklist

If a task also touches `shared/`, the frontend, or the mobile app, read the relevant package guide before editing outside this directory. Use `../AGENTS.md` for monorepo-level context.

## Weekly activity planning

`activity_plan_resolutions` is owner-only. `/api/v2/activity-planning` projects
immutable Workout Plan versions and existing dated Mobility plans without writes.
`version=2` (or the legacy `include_activity=true` alias) opts Daily Progress into
version 2; preserve the default HTTP version 1 contract. Workout links/skip/undo never mutate Diary or calories. Cache
activity queries under the Daily Progress family. See
`docs/implementation/weekly-activity-goals-2026-10-01.md` and
`docs/src/features/weekly-activities.md` for completion and history rules.

## Scope

- This file is for package-local work in `XoTServer/`.
- Keep changes inside this package unless the task clearly crosses package boundaries.
- This is the single source of truth for the package; `CLAUDE.md` just imports it via `See @AGENTS.md`.
- Do not invent alternate boot paths, duplicate route registries, or parallel migration flows when the current startup path already covers the behavior.

## Current Snapshot

- Dev boot path: `pnpm start` -> `nodemon` -> `tsx index.ts`
- `index.ts` loads `../.env`, applies file-backed secrets, runs preflight checks, calls `initializeDatabase()` for migrations and RLS policies, then imports `XoTServer.ts`
- Main app shell: `XoTServer.ts`
- Stack: Express 5, PostgreSQL via `pg`, Better Auth, Zod, TypeScript 6, Vitest 5, ESLint 10
- Module system: ESM with `type: "module"` and `moduleResolution: "NodeNext"`
- The package is now effectively TypeScript-first; almost all source files are `.ts`
- Main domains: food and meal tracking, exercise logging, health and sleep data, sleep science, fasting, medications, mood, menstrual cycle and pregnancy, reporting, AI chat, onboarding, identity, admin tooling, and external provider integrations
- Reviewed MCP recommendations add owner-only proposals, leased external reviews, typed activation, prompt plans and confirmed outcomes behind `XOT_COACHING_ENABLED`.
- Hydration container presses can create a water log and linked food entry in one user-scoped transaction; `water_container_actions` retains the retry receipt after either diary row is deleted
- Workout-plan reviews use immutable `workout_plan_template_versions` snapshots and a retained origin assignment ID on exercise entries so completed activity survives plan edits or deletion

## Verified Commands

```bash
pnpm start
pnpm run validate
pnpm run typecheck
pnpm run lint
pnpm run lint:fix
pnpm run format:check
pnpm run format
pnpm test
pnpm run test:watch
pnpm run test:coverage
pnpm run test:ci
pnpm exec vitest run tests/mealRoutes.test.ts
pnpm exec eslint routes/v2/foodRoutes.ts services/foodCoreService.ts
```

- `pnpm start` uses hot reload through `nodemon`; `nodemon.json` ultimately executes `tsx index.ts`
- `pnpm run validate` runs typecheck, lint, and Prettier check together
- `pnpm test` runs `vitest run`
- The backend default port is `3010` unless `SPARKY_FITNESS_SERVER_PORT` overrides it
- For targeted test runs, prefer `pnpm exec vitest run tests/<name>.test.ts`

## Source Map

- `routes/v2/coachingRoutes.ts`, `ai/mcp/coachingAdapter.ts`, `services/coaching*Service.ts`, and `models/coachingRepository.ts` - owner review, scoped proposals and frozen evidence. `tools/coachingRunner{,Schema,Reads}.ts` owns the external subscription runner and read audit.
- `routes/coachingMcpRoutes.ts` publishes public discovery and strict protocol-2 OAuth at `/mcp/coaching`, requiring the distinct resource audience, read/propose scopes, live consent and active binding. `routes/chatgptMcpRoutes.ts` retains legacy OAuth compatibility; never fall back to direct-write tools on the coaching address. Endpoint/scope constants are shared in `shared/src/coaching/oauth.ts`.
- `services/coachingWorkoutEvidence.ts` consumes the same immutable-prescription activity projection as Daily Progress. Started sets are not completion; whole activities require actual saved targets, and optional/skipped/rest or unknown prescriptions do not become missed sessions. Legacy attendance-only snapshots cannot establish a completion outcome.
- `index.ts` - real dev entrypoint; loads env, secrets, and preflight checks before booting the app
- `XoTServer.ts` - Express app shell, route mounting, Swagger/ReDoc, cron setup, graceful shutdown
- `auth.ts` - Better Auth configuration, plugins, session behavior, SSO provider syncing
- `routes/` - primary HTTP route surface
- `routes/v2/` - newer typed route surface; pair these changes with `schemas/`
- `routes/v2/dailyTrackingRoutes.ts` (`/api/v2/tracking`), `models/dailyTrackingRepository.ts` and `services/dailyProgressService.ts` - daily check-ins, user-declared injury/illness/vacation periods, habits (configuration columns on `custom_categories`, logs in `custom_measurements`), measurement reminders, explicit meal status and the Daily Progress projection from `shared/src/tracking/dailyTracking.ts`. Check-in/habit routes use the check-in permission, meal status the diary permission, supplements the medication permission; context, reminders, preferences and progress are owner-only. `ai/tools/dailyTrackingTools.ts` holds pure-read tools that are safe for read-only MCP keys; keep writes out of them.
  - `recordedMeasurementValuesOn` returns actual values for configured reminder keys on one calendar day; `recordedMeasurementsOn` projects its timestamps for Daily Progress. MCP status includes `measurement_recorded`, value, unit and row provenance. Weight is canonical kg, custom values remain stored text; never carry an older value forward or infer a provider source. The MCP-only schema is in `DailyTracking.api.zod.ts`; the reminder configuration REST contract is unchanged.
- `routes/v2/engagementRoutes.ts`, `services/engagementService.ts`, `services/engagementPolicy.ts`, and `services/engagementDeliveryService.ts` - owner-only notification settings/actions, scheduling, encrypted push delivery, and Expo receipts. `routes/chatgptMcpRoutes.ts` is the OAuth-scoped read/write assistant endpoint; `routes/v2/mcpConnectionsRoutes.ts` lists and revokes its grants, with `services/mcpConnectionService.ts` enforcing immediate consent revocation for signed tokens.
- `routes/fddbImportRoutes.ts`, `services/fddbImportService.ts`, and `models/fddbImportRepository.ts` - owner-only, batched import of FDDB diary snapshots and separately selected reusable items; the browser discards profile and transaction fields before calling this route
- `routes/v2/openFoodFactsContributionRoutes.ts` - owner-only single-food preview and explicit photo-backed publication; background contributions are disabled for this release
- `routes/v2/reportRoutes.ts` - weekly alcohol rollup and the zero-padded hydration/caffeine/alcohol range used by the Trends charts (`reports` permission)
- `routes/v2/nutritionKineticsRoutes.ts` - active-caffeine estimate and bedtime cutoff (`diary` permission)
- `routes/v2/waterIntakeRoutes.ts` and `services/containerWaterActionService.ts` - diary-permitted container action endpoint, immutable operation receipt, and atomic food/water effects
- `routes/exerciseStatsRoutes.ts`, `services/exerciseReviewService.ts`, and `models/workoutPlanTemplateRepository.ts` - recorded exercise reviews, dated plan adherence, and transactional plan-version capture
  - `WorkoutPlans.api.zod.ts` extends existing assignments with whole activities and optional local time/duration/distance. Owner-only activity preparation creates/reuses a private exercise definition; it never records completion. `models/dailyProgressObjectives.ts` reads immutable dated plan snapshots and configured objectives for opt-in Daily Progress v2. Keep GET read-only, rest/optional rules explicit, unknown values nullable and legacy v1 clients compatible. Import-only meal groups do not create routine meal tasks.
- `routes/auth/` - auth-specific route fragments mounted through `routes/authRoutes.ts`
- `services/` - business logic and orchestration
- `models/` - PostgreSQL repositories and persistence helpers
- `middleware/` - auth, permissions, uploads, and shared Express middleware
- `utils/uploadsPath.ts` - the uploads root plus the resolver and containment guard for stored `file_path` values; use it instead of re-deriving `SPARKY_FITNESS_CUSTOM_UPLOADS_DIRECTORY`
- `utils/oauthState.ts` - server-issued single-use OAuth `state` nonces for provider linking (`issueOAuthState`, `persistOAuthState`, `claimOAuthState`); use it instead of hand-rolling a state value
- `utils/outboundHttp.ts` - process-wide outbound HTTP defaults, applied from `index.ts`: the axios request timeout and the per-address-family connect attempt timeout (`net.setDefaultAutoSelectFamilyAttemptTimeout`). Both are fixed constants on purpose - do not add env overrides, and read the sizing note there before changing either, because the two values interact
- `utils/errors.ts` - `ValidationError` plus `describeError(error)`; prefer it over `error.message` when logging any caught value, because an `AggregateError` or a non-Error throw renders as an empty string
- `middleware/requireSelfMiddleware.ts` - `requireSelfActor`, which rejects a switched/delegated context outright; attach per-route to account-linking routes
- `integrations/` - provider adapters and ingest pipelines
- `schemas/` - Zod route schemas
- `types/` - TypeScript declarations, including `Express.Request` augmentation
- `db/` - pool management, grants, migrations, and RLS policies
- `config/` - logging and Swagger config
- `utils/` - startup helpers, CORS, permissions, timezone loading, OIDC helpers, migration helpers
- `ai/` - AI provider configuration (`config.ts`), the unified provider-dispatch helper (`providerDispatch.ts`), and the in-process chatbot tool registry (`ai/tools/`)
- `security/` - encryption utilities (`encryption.ts`)
- `validation/` - legacy express-validator rules for a few older routes (new routes use Zod schemas)
- `constants/` - shared constants and supporting package data
- `tests/` - Vitest suites plus a few utility scripts
- `devdocs/` - local notes and debugging artifacts when present

When searching, ignore noisy/generated directories unless you explicitly need them:

- `node_modules/`
- `coverage/`
- `uploads/`
- `temp_uploads/`
- `backup/`
- `mock_data/`

## Architecture

### Boot and App Shell

- `index.ts` is the true local boot path used by `pnpm start`; do not bypass it for normal development because it performs env loading and preflight work
- `XoTServer.ts` creates the Express app, configures static upload serving, mounts auth interception, registers routes, exposes API docs, schedules cron jobs, and handles graceful shutdown
- Startup order matters:
  - `index.ts`: await `initializeDatabase()`, which applies pending migrations and then reapplies `db/rls_policies.sql` under a PostgreSQL advisory lock, **before** importing `XoTServer.ts` (and therefore `auth.ts`)
  - upsert env-configured OIDC provider
  - mount Better Auth
  - sync trusted SSO providers
  - register cron jobs
  - optionally promote `SPARKY_FITNESS_ADMIN_EMAIL` to admin
  - start listening
- Public API docs live at:
  - `/api/api-docs/swagger`
  - `/api/api-docs/redoc`
  - `/api/api-docs/json`
- If you change public endpoints, keep Swagger JSDoc and `config/swagger.ts` coverage accurate

### Environment and Secrets

- Runtime `.env` is expected at `../.env`
- The tracked template lives at `../docker/.env.example`
- `utils/secretLoader.ts` loads `*_FILE` secrets before preflight validation
- Three layers decide whether a variable has to be set, and they are easy to confuse:
  1. **`utils/preflightChecks.ts` refuses to start** without these four, because none has a safe default:
     - `SPARKY_FITNESS_DB_PASSWORD`
     - `SPARKY_FITNESS_FRONTEND_URL`
     - `SPARKY_FITNESS_API_ENCRYPTION_KEY`
     - `BETTER_AUTH_SECRET`
  2. **`preflightChecks.ts` fills in a default** for `SPARKY_FITNESS_DB_HOST` (`sparkyfitness-db`), `SPARKY_FITNESS_DB_NAME` (`sparkyfitness_db`), `SPARKY_FITNESS_DB_USER` (`sparky`) and the two app-role variables, logging which one it defaulted. These matter only outside Compose, which supplies them itself.
  3. **`docker/docker-compose.prod.yml` supplies a value** for almost everything via `${VAR:-default}`, so a Compose deployment only ever has to set the four in (1). Keep the defaults in (2) identical to Compose's: a value that differs between them silently points the server at a database other than the one Compose created.
- `SPARKY_FITNESS_APP_DB_USER` and `SPARKY_FITNESS_APP_DB_PASSWORD` are soft-required: preflight defaults the user to `sparky_app` and mints a password when absent, and `utils/dbMigrations.ts` creates the role or re-syncs its password so the two always match. It probes a connection as that role first, so an externally pre-created role is left alone and the owner does not need `CREATEROLE` — but only while `SPARKY_FITNESS_APP_DB_PASSWORD` still authenticates. If it is absent, preflight mints a new one, the probe fails, and the `ALTER ROLE` does need `CREATEROLE`; an externally managed database should therefore set both app variables explicitly. The probe only reports failure for an authentication rejection (`28P01`/`28000`); any other connection error propagates rather than being misread as a stale password. Both assignments must stay in `preflightChecks.ts`, because `db/poolManager.ts` freezes its credentials at module load
- `BETTER_AUTH_SECRET` is mandatory. It signs session cookies and encrypts stored 2FA/TOTP secrets, so a value that changes between restarts logs every user out and permanently locks out anyone with 2FA enabled. Startup used to mint a throwaway one when it was missing, which made exactly that happen silently; it now fails preflight instead
- Preflight also refuses to start when `BETTER_AUTH_SECRET` or `SPARKY_FITNESS_API_ENCRYPTION_KEY` still holds a template placeholder (a value starting with `changeme` or `replace_with`, as shipped in `docker/.env.example` and `docker/.env.simple.example`), and only warns for `SPARKY_FITNESS_DB_PASSWORD` because Compose initialises Postgres with it. Keep new template secrets on one of those prefixes so the check covers them. It also fails when `BETTER_AUTH_SECRET` base64-decodes to an empty key (Better Auth accepts an empty Buffer) and warns under 32 decoded bytes
- Common operational toggles include `SPARKY_FITNESS_SERVER_PORT`, `SPARKY_FITNESS_ADMIN_EMAIL`, `ALLOW_PRIVATE_NETWORK_CORS`, `ALLOW_PRIVATE_NETWORK_AI`, `ALLOW_PRIVATE_NETWORK_FOOD_PROVIDERS`, `SPARKY_FITNESS_EXTRA_TRUSTED_ORIGINS`, and `BETTER_AUTH_URL`
- User-configured self-hosted food providers (Mealie/Tandoor/Norish) can point `base_url` at a private/internal address only for admins by default; a non-admin on a multi-user server is blocked unless the operator opts in, either with the admin `allow_private_network_food_providers` toggle (Admin > Global Provider Settings) or `ALLOW_PRIVATE_NETWORK_FOOD_PROVIDERS=true`. This mirrors the AI policy (a single-user self-host is an admin, so their LAN recipe server works with no config). Enforced by `utils/outboundUrlPolicy.ts` at provider save time in `services/externalProviderService.ts`. Separate from the AI toggle by design
- The admin `allow_private_network_ai` toggle (Admin > Global AI Settings), or `ALLOW_PRIVATE_NETWORK_AI=true`, lets non-admin users use custom AI service URLs (`custom`/`ollama`/`openai_compatible`) that resolve to private/internal addresses; default off is an SSRF guard enforced by `utils/outboundUrlPolicy.ts` at save/test time and again in the runtime guarded fetch path. Current admins and global admin-created AI settings can use private URLs for self-hosted providers like Ollama
- **Call `resolveAiNetworkPolicy` / `resolveFoodProviderNetworkPolicy`, not the `derive*` forms.** The sync `derive*` functions only see the env var; the async `resolve*` wrappers also consult the admin toggle (and only hit the database when the sync answer would be a denial). The `derive*` exports stay for unit tests and for the resolvers themselves

### TypeScript and Module Conventions

- This package is now almost entirely TypeScript; new source files should be `.ts`
- Keep local relative imports using `.js` extensions from TypeScript files, for example `import foo from './foo.js'`
- `eslint.config.js` enforces file extensions in imports
- `tsconfig.json` uses `NodeNext`, `noEmit`, and `allowJs: false`
- `@workspace/shared` resolves directly to `../shared/src/index.ts` here and in Vitest
- Avoid using `any` declarations in models, repositories, and integration services (e.g. `integrations/fatsecret/fatsecretService.ts`). Instead, use base datatypes (like `string`), proper types/interfaces, or import strict type schemas directly from `@workspace/shared`.
- New public endpoints should include TypeScript code, Zod validation, and automated tests

### Logging

- Use `log(level, message, ...args)` from `config/logging.ts`; levels are `'debug'`, `'info'`, `'warn'`, and `'error'`
- Never use `console.error` (or other `console.*`) in application code
- `SPARKY_FITNESS_LOG_LEVEL` controls verbosity (`DEBUG`, `INFO`, `WARN`, `ERROR`, `SILENT`)

### Database and RLS

- Use `getClient(userId, authenticatedUserId?)` from `db/poolManager.ts` for normal user-scoped queries
- `getClient(...)` sets `public.set_app_context(...)`; that is what makes row-level security work correctly
- Use `getSystemClient()` only for admin, migration, startup, or policy-management work that intentionally bypasses RLS
- Always release database clients in a `finally` block
- To learn a table's current shape, read `../shared/src/schemas/database/<Table>.zod.ts` (one small Zod file per table) instead of reading `../db_schema_backup.sql` or reconstructing it from the 185 migration files
- New migrations belong in `db/migrations/` and must use `YYYYMMDDHHMMSS_description.sql`
- **Never manually edit `../db_schema_backup.sql`** — after merge, CI regenerates it from the migrations and opens an automated sync PR (`.github/workflows/schema-backup.yml`). Do not commit copies generated from a local database.
- If you add a new table or change user-visible access behavior, follow `../agent-docs/new-migration-checklist.md`. In short, you MUST:
  1. Add/modify the RLS policies in `db/rls_policies.sql`.
  2. Update the user-facing documentation in `../docs/src/features/family-friends-sharing.md`.
  3. Update the developer-facing documentation in `../docs/src/developer/database-security-tiers.md` to define its security tier (Tier 1, Tier 2, or Tier 3).
  4. Add or update the matching Zod schema in `../shared/src/schemas/database/`.
- Keep future schema-startup steps in `utils/initializeDatabase.ts` and pass its shared client through all database work. The lock and schema work must use the same connection so initialization cannot continue on another connection after the lock-owning session is lost. Do not create alternate migration mechanisms.
- Migrations run from `index.ts`, **before any application module is imported**, and via dynamic `await import()`. Both details are load-bearing: Better Auth validates the schema eagerly at `auth.ts` module scope and caches a mismatch for the life of the process (issues #2469 / #2470), and `db/poolManager.ts` builds its pools at module load, so a static import would be hoisted above the env/secret loading. `tests/bootOrder.test.ts` guards this

### Uploads: Public vs Sensitive

- `XoTServer.ts` serves the uploads root publicly at `/uploads` and `/api/uploads`; both are in `publicRoutes`, so `authenticate` never runs on them
- Sensitive subtrees are **denied on the static mount** and served instead by an authenticated, owner-checked per-id route. Two exist today:
  - `check-in` -> `GET /api/measurements/check-in-photos/file/:id` (delegatable via the `checkin` permission)
  - `pregnancy` -> `GET /api/v2/pregnancy/photos/file/:id` (owner-only; deliberately **no** `checkPermissionMiddleware`, because reproductive-health data is never delegated)
- Adding a sensitive upload subtree means adding its directory name to `SENSITIVE_UPLOAD_SUBTREES` in `XoTServer.ts` **and** adding an authenticated file route; the deny rule matches the decoded, normalized path, because a prefix match on the raw URL is bypassable with `..%2f`
- Responses for these domains omit `file_path`: the on-disk layout is a server detail and clients address photos by id
- `tests/uploadsStaticMount.test.ts` guards both the deny behavior and the fact that the deny rule is registered before `express.static`

### Auth and Request Context

- Better Auth is configured in `auth.ts` and mounted under `/api/auth`
- `XoTServer.ts` intercepts `/api/auth*` requests before the normal request logger and has special handling for discovery routes and sign-out cookie cleanup
- `middleware/authMiddleware.ts` populates:
  - `req.userId`
  - `req.authenticatedUserId`
  - `req.originalUserId`
  - `req.activeUserId`
  - `req.user`
- `req.userId` is the active RLS target; `req.authenticatedUserId` is the logged-in actor
- New owner foreign keys reference `public."user"(id)`, the Better Auth identity table. Do not reference retired `auth.users`; a migration created after the auth transition is not repaired by that older transition migration.
- Family and delegated access flow through `middleware/checkPermissionMiddleware.ts`, `middleware/onBehalfOfMiddleware.ts`, and the auth middleware’s active-user switching
- `checkPermissionMiddleware(permissionType)` guards routes; permission types are `'diary'`, `'reports'`, and `'checkin'`
- If you change auth behavior, check both cookie-backed sessions and API key flows

### Dates, Day Strings, and Timezones

- Prefer the shared helpers exported by `@workspace/shared` for day-string and timezone-aware logic
- Common server-side helpers include `todayInZone`, `instantToDay`, `dayToUtcRange`, `dayRangeToUtcRange`, `localDateToDay`, `addDays`, `compareDays`, and `isDayString`
- Load the user timezone through `utils/timezoneLoader.ts` before deriving "today", bucketing events by day, or building date ranges from user context
- Treat `YYYY-MM-DD` values as calendar-day strings, not UTC-midnight timestamps
- Avoid `toISOString().split('T')[0]` for user-facing or business-logic dates; it silently shifts dates near timezone boundaries
- If you touch older code that still uses UTC split patterns, prefer migrating that path to the shared helpers instead of copying the pattern forward
- Timezone/date regression coverage already exists in:
  - `tests/timezone.test.ts`
  - `tests/dateShifting.test.ts`
  - `tests/measurementService.timezone.test.ts`

### Integrations and Background Work

- Provider-specific adapters live under `integrations/`; coordinating logic usually lives in `services/` and persistence in `models/`
- Current adapters span food/nutrition (OpenFoodFacts, FatSecret, Nutritionix, USDA, Mealie, Tandoor, Norish, SwissFood, Yazio), fitness devices (Garmin Connect sync plus FIT file import via `integrations/garminfit/` + `services/fitImportService.ts`, Withings, Fitbit, Oura, Polar, Strava, Hevy), exercise databases (Wger, FreeExerciseDB), and health-data import (Google Health, generic/mobile health data)
- Scheduled jobs currently include backups, session cleanup, and hourly sync loops for Withings, Garmin, Fitbit, Oura, Polar, and Strava
- Integration work often spans route, service, repository, cron, and external-provider settings code; inspect the whole path before calling the work complete
- **OAuth linking (`/authorize`, `/callback`) is self-only, and `state` is a server-issued single-use nonce.** Never derive a user id from a callback request body, and never gate an authorize route with `checkPermissionMiddleware('diary')` — on GET that resolves to `diary_read`, which would hand a read-only delegate the owner's decrypted OAuth client id. Use `requireSelfActor` plus `utils/oauthState.ts`. Withings and Polar follow this pattern; Oura, Fitbit and Strava are self-only but still send `state = userId` and ignore it on callback (tracked follow-up)

### AI Services

- AI calls go through the Vercel `ai` SDK (v6) with provider adapters for OpenAI, Anthropic, and Google, plus OpenAI-compatible, Mistral, Groq, OpenRouter, and Ollama service types
- `ai/config.ts` holds default model and vision-model selection per provider; `ai/providerDispatch.ts` is the unified dispatch helper used by chat, food-photo analysis, nutrition-label scan, and unit conversion
- Prefer routing new AI features through `providerDispatch.ts` instead of calling provider SDKs directly
- Chatbot tool calls run in-process through the registry in `ai/tools/`
- `ai/tools/index.ts` exposes `buildChatbotTools(userId, tz)`, composing the per-domain builders (`build<Domain>Tools` in `ai/tools/<domain>Tools.ts`); handlers close over the authenticated user — so two-actor services receive `(userId, userId, ...)` — and the user's IANA timezone, used for "today" defaults and day bucketing
- Tool handlers follow a fixed contract: publish a flat Zod schema, validate with a strict union `safeParse` inside `execute`, orchestrate through existing services and repositories, and never throw - errors come back as `ERRORS.*` strings from `ai/tools/errors.ts`
- Tool output text is a parity contract with the MCP tool set; golden tests in `tests/chatbotTools*.test.ts` assert exact returned strings, so do not reword tool output casually

## Testing and Validation

- Test runner: Vitest, not Jest
- Auto-discovered test files match `tests/**/*.test.ts`
- `tests/check_routes.ts` and `tests/*.script.ts` are utility scripts, not normal test suites
- For route or contract work, targeted `supertest`-based Vitest tests are the normal validation path
- Prefer `pnpm run typecheck` after touching `routes/v2/`, `schemas/`, `types/`, or shared request/response contracts
- Prefer `pnpm run lint` after multi-file edits; if unrelated package-wide issues make that noisy, run targeted `pnpm exec eslint <paths>` on the touched files before stopping
- Use `pnpm run test:coverage` after broad service, route, repository, middleware, or auth refactors

## Quick Routing

- Recommendations, scheduled MCP reviews or prompt meal consumption: start at `../docs/src/developer/mcp/recommendations.md`, then the coaching services and `services/mealPlanOccurrenceService.ts`. Check owner app-session identity before canonical writes.
- Startup, env, or deployment issue:
  inspect `index.ts`, `XoTServer.ts`, `utils/secretLoader.ts`, `utils/preflightChecks.ts`, and `config/logging.ts`
- Auth, session, MFA, or API key issue:
  inspect `auth.ts`, `middleware/authMiddleware.ts`, `routes/authRoutes.ts`, and `routes/auth/`
- Migration, RLS, or permission issue:
  inspect `db/migrations/`, `db/rls_policies.sql`, `db/poolManager.ts`, `utils/applyRlsPolicies.ts`, and the permission middleware/helpers
- Public v2 contract issue:
  inspect the matching file in `routes/v2/` plus the related Zod schema in `schemas/`
- Food, barcode, or external provider issue:
  inspect the relevant `integrations/*` code, then the matching service and repository files
- Open Food Facts publication:
  inspect `services/openFoodFactsManualContributionService.ts`, `integrations/openfoodfacts/openFoodFactsContribution.ts`, and `constants/openFoodFacts.ts`; retained automatic queue code is dormant and needs a new migration before a future release can activate its triggers
- Health data or date bucketing issue:
  inspect `integrations/healthData/healthDataRoutes.ts`, `services/measurementService.ts`, and `utils/timezoneLoader.ts`
- Water, hydration, caffeine, or alcohol issue:
  inspect `services/hydrationTotalsService.ts` (the single owner of the daily water formula), `services/containerWaterActionService.ts` and `db/migrations/20260924130000_add_water_container_actions.sql` (idempotent container presses), `services/measurementService.ts` (the legacy container "+/-" path), `services/caffeineKineticsService.ts` / `services/alcoholWeekService.ts`, `models/waterContainerRepository.ts`, and the shared maths in `../shared/src/nutrients/`
- Workout-plan review or adherence issue:
  inspect `services/exerciseReviewService.ts`, `models/workoutPlanTemplateRepository.ts`, `models/exerciseTemplate.ts`, and `db/migrations/20260925000000_add_workout_plan_review_history.sql`; plans before the first snapshot have unknown historical coverage
- Self-service "delete synced data by source" issue:
  inspect `routes/syncedDataRoutes.ts`, `services/syncedDataService.ts`, and `models/syncedDataRepository.ts` (the `SYNCED_SOURCE_TABLES` whitelist)
- AI chat or chatbot tool issue:
  inspect `services/chatService.ts`, `ai/tools/`, and the matching domain service and repository
- Fasting or mood issue:
  inspect `routes/fastingRoutes.ts` / `routes/moodRoutes.ts` and `models/fastingRepository.ts` / `models/moodRepository.ts`
- Medications, cycle, or pregnancy issue:
  inspect the matching v2 route (`routes/v2/medicationRoutes.ts`, `routes/v2/cycleRoutes.ts`, `routes/v2/pregnancyRoutes.ts`), its Zod schema in `schemas/`, then `services/cycleService.ts` / `services/pregnancyService.ts` and the `models/medication*Repository.ts` / `models/cycleRepository.ts` / `models/pregnancyRepository.ts` files
- Sleep or sleep-science issue:
  inspect `routes/sleepRoutes.ts`, `routes/sleepScienceRoutes.ts`, `services/sleepAnalyticsService.ts`, `services/sleepScienceService.ts`, and the sleep repositories

## Architecture Resources

Before adding a feature or changing auth/permission behavior, read:

- `../docs/src/developer/database.md` — Quick table index (all ~120 tables with purpose) + migration best practices
- `../docs/src/developer/database-security-tiers.md` — Security tier, permission type, and RLS rules for every table (authoritative)
- `../agent-docs/architecture-permissions.md` — Permission types, links to tier classification doc
- `../agent-docs/data-flow-patterns.md` — Data flow from frontend through server to database, safe RLS patterns
- `../agent-docs/new-domain-template.md` — Checklist for adding a major feature domain
- `../agent-docs/anti-patterns.md` — Common mistakes (using getSystemClient(), forgetting RLS, cache invalidation, timezone bugs, cross-package contract mismatches)

## Working Rules

- Match the existing service/repository/middleware layering instead of introducing parallel abstractions
- **Library Deletes vs Diary Snapshots:** `exercise_entries` and `food_entries` are snapshot-backed (`exercise_id` / `food_id` are `ON DELETE SET NULL`). `deleteExercise` and `deleteFood` (`mode: 'delete'`) must never delete past or today's diary entries; they cascade from templates/presets, clean up future scheduled plan entries (`entry_date >= today AND workout_plan_assignment_id IS NOT NULL`), and clean up empty parent preset entries. Only explicit `delete_with_history` (force delete) deletes diary entries for that user. If an item is referenced by others (`otherUserReferences > 0`), the delete must fall back to `hide` (`is_quick_exercise` / `is_quick_food`).
- If your change adds a new domain, route family, or table, update this file's Snapshot, Source Map, and Quick Routing sections (and the `Last updated` date) in the same change
- If you add persisted or user-visible data, think through migration, RLS, permissions, tests, API docs, and downstream client contracts together
- Validate shared-contract changes from the affected consumers, not just from this package
- Keep package-specific guidance here; use `../AGENTS.md` only for cross-package context

## File Naming Conventions

- Routes: `*Routes.ts` (e.g., `foodEntryRoutes.ts`)
- Services: `*Service.ts` (e.g., `foodEntryService.ts`)
- Repositories: `*Repository.ts` (e.g., `foodRepository.ts`, `mealRepository.ts`)
- Some domain model files predate the Repository suffix and remain without it (e.g., `food.ts`, `foodEntry.ts`, `exercise.ts`)

## Planning

- Before presenting a plan for server work, self-review it against `../agent-docs/plan-review-checklist.md` and fix any gaps first.

## Priority Rule

- For work inside `XoTServer/`, this file wins over repo-root guidance on package-specific details
- Use `../AGENTS.md` for monorepo context
- If a task spans multiple packages, combine this guide with the other affected package guides instead of relying on one file alone

## Notification delivery and mobility planning

Notification v1/v2 contracts and opt-in v3 coaching capabilities live in `shared/src/schemas/api/Engagement.api.zod.ts`; installed v1 clients retain strict projections. Mobile owns local-to-server handoff and device retirement in `remoteEngagement.ts`; shared `engagement/policy.ts` owns slot selection. Server `engagementPlanningService.ts` derives unresolved subjects; delivery rechecks completion, revision and device capability before sending. Settings display provider acceptance separately from physical receipt.

Mobility uses owner-only `/api/v2/mobility` and `Mobility.api.zod.ts`, account-local plans and revisioned idempotent mutations. Mobile `mobilityRoutineStore.ts` retains the original local runner and account-scoped operation queue; web `/mobility` edits definitions/plans and reads history. MCP manual results require existing write scope/consent and cannot resolve an active phone session. Mobility diary rows project confirmed terminal sessions without creating exercise entries or adjusting calorie goals. Explicit phone export may reuse `workoutHealthExport` for a HealthKit flexibility workout, with workout-recording consent, known active kcal or an explicitly confirmed mobility estimate, account guards and the existing idempotent export ledger. MCP/manual plan results never trigger HealthKit export automatically. Mobility snapshot reads are read-only; occurrence creation belongs to definition writes and the explicit periodic planner, never GET/MCP reads. Session provenance names a trusted API/MCP ingress, not proof of the device platform. Local history retention must never queue server deletions.

## Micronutrient ingestion and coverage

`services/nutrientObservationService.ts` resolves the bounded shared catalog in caller-owned transactions. Native ingestion is partial and preserves each source record independently; diary delegates write standalone snapshots without library mutation. `GET /api/reports/nutrient-coverage` and `models/nutrientCoverageRepository.ts` expose known/eligible counts separately from numeric trend keys. BLS imports reload trusted source values; `scripts/repair_bls_micronutrients.ts` defaults to a bounded, rolled-back dry run. See `../docs/implementation/micronutrient-coverage-rollout-2026-10-01.md` for flags, repair restrictions, replay and verification.

## Reviewed MCP recommendations

- `routes/v2/coachingRoutes.ts`, `ai/mcp/coachingAdapter.ts`, `models/coachingRepository.ts`, and `services/coaching{Run,Evidence,Planning,Review,Maintenance,Credential}Service.ts` implement owner-only leased proposals, frozen evidence, preview/activation and outcomes. `services/mealPlanOccurrenceService.ts` owns prompt occurrences and explicit consumption receipts; `tools/coachingRunner.ts` is the external Mac subscription runner. Agents never approve or log intake. See `../docs/src/developer/mcp/recommendations.md`.

## Wellness activity logging

Wellness entries reuse `/api/v2/tracking/habits` and its dated completion logs with `category: 'wellness'`. They have an empty weekday schedule, no reminder, and no session metrics. They never count toward Daily Progress, exercise calories, or HealthKit/Health Connect workouts. The diary Wellness cards in web and mobile log presets or literal custom names, undo only the selected day, and read 30 days of history ending on that day. Definitions and logs retain the existing check-in permissions and RLS. Shared orchestration lives in `shared/src/tracking/wellness.ts`; keep wellness activities out of the routine habit editors.

Calendar coaching protocol 2: read `../docs/src/developer/mcp/recommendations.md` before changing external review contracts. `CoachingV2.api.zod.ts` and `coaching/calendar.ts` define calendar cadence and independent context permissions; server `coachingCalendarEvidence` and `coachingRecapService` own bounded aggregates and durable owner-only recaps. Phone/web coaching screens expose cloud connection setup and recaps; approval remains an owner app-session action. Preserve strict protocol-1 responses, frozen feedback cursors and per-cadence completion through cleanup. Cloud task activation/device delivery require separate verification; never claim a connection proves a working schedule.
