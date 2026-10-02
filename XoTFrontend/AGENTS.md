# AGENTS.md

_Last updated: 2026-10-01_

X on Track Frontend is the React web app for the X on Track monorepo. Use this file as the primary guide for work inside `XoTFrontend/`.

If a task also touches the server, mobile app, or `shared/`, read that package guide before editing outside this directory. Use `../AGENTS.md` for monorepo-level context.

## Weekly activity planning

`activity_plan_resolutions` is owner-only. `/api/v2/activity-planning` projects
immutable Workout Plan versions and existing dated Mobility plans without writes.
`include_activity=true` opts Daily Progress into version 2; preserve the default
version 1 contract. Workout links/skip/undo never mutate Diary or calories. Cache
activity queries under the Daily Progress family. See
`docs/implementation/weekly-activity-goals-2026-10-01.md` and
`docs/src/features/weekly-activities.md` for completion and history rules.

## Scope

- This file is for package-local work in `XoTFrontend/`.
- `CLAUDE.md` just imports this file via `See @AGENTS.md`.
- Run scripts from this directory.

## Current Snapshot

- Stack: React 19, Vite 8, TypeScript 6, Tailwind CSS v4 (via `@tailwindcss/vite`), shadcn/ui-style Radix primitives, TanStack Query 5, React Router 7 (`createBrowserRouter`), i18next, Better Auth client, Zod 4, Recharts.
- `@/*` maps to `src/`; `@workspace/shared` maps to `../shared/src/index.ts` (also in Jest via `moduleNameMapper`).
- Dev server runs on port `8080` and proxies `/api`, `/mcp`, and `/uploads` to the backend on `3010`; `/health-data` is proxied with an `/api` prefix rewrite. Override the backend host with `VITE_BACKEND_HOST`.
- PWA (`vite-plugin-pwa`) is enabled in production builds only.
- `/coaching` contains owner-only recommendation review, commitments, schedules and proposal connections; prompt meals also appear in Diary/Dashboard.

## Verified Commands

```bash
pnpm dev
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm run format
pnpm run validate
pnpm test
pnpm run test:ci
pnpm run build
pnpm run visual:review   # needs ../scripts/visual-sample.sh start; see root AGENTS.md
```

- `pnpm run validate` runs typecheck, lint (`--max-warnings 0`), Prettier check, and Knip (`pnpm run knip` for unused files and exports) together.
- `pnpm test` runs Jest (`ts-jest`, `jsdom`); config is inline in `package.json`, setup in `src/tests/setupTests.ts`.
- `pnpm run build` runs `validate` first, then `vite build`.
- CI (`.github/workflows/ci-tests.yml`) runs `pnpm run validate` and `pnpm run test:ci` for this package when its files change; matching those locally means a green PR.

## Domain-Oriented Layout

Features are organized by domain across `src/pages/`, `src/api/`, and `src/hooks/`, but folder names and layers are not uniform. Start with the closest domain and follow its imports:

- Page domains: `Admin`, `Auth`, `Chat`, `CheckIn`, `Cycle`, `Diary`, `Errors`, `Exercises`, `Fasting`, `Foods`, `Goals`, `Integrations`, `Medications`, `Reports`, `Settings`.
- API domains add a few more: `AiConversions`, `Chatbot`, `Onboarding`, `Pregnancy`, `SleepScience`.
- Example: a Medications bug lives in `src/pages/Medications/` + `src/api/Medications/` + `src/hooks/` medication hooks. Start there, not with a repo-wide search.

## Source Map

- `src/pages/Coaching/`, `src/hooks/Coaching/`, and `src/api/Coaching/` - scoped inbox, typed editors, mandatory before/after preview, connections and planned consumption. Editor behavior/contracts live in `@workspace/shared`.
- `src/main.tsx` - app bootstrap; creates the shared `QueryClient` with global `QueryCache`/`MutationCache` handlers that render toasts from query/mutation `meta` (`errorTitle`, `errorMessage`, `successMessage`).
- `src/App.tsx` - route registry via `createBrowserRouter`, plus `PrivateRoute` and `PermissionRoute` wrappers (permission-gated areas include `reports` and `admin`).
- `src/pages/<Domain>/` - route screens by domain.
- Routes: `/` is the Dashboard summary (`src/pages/Dashboard/`); the full Diary lives at `/diary`. Legacy `/?date=` links and `openFoodSearchForMeal` navigation state are forwarded to `/diary` by `DashboardRoute`. Diary accepts navigation state `openFoodSearchForMeal` (+ `startWithScanner`) and `focusWidget` (`exercise` | `water`).
- Shared look: `src/components/ui/glow-card.tsx` (`GlowCard`, neon tones) and the `glow-surface` utility / `--neon-*` tokens in `src/index.css`; `ui/card.tsx` carries the same radius/border. Water logging logic is shared through `src/hooks/Diary/useWaterControls.ts`.
- `src/pages/Auth/McpConsent.tsx` and `src/pages/Settings/{NotificationDeliverySettings,McpConnectionsSettings}.tsx` - assistant OAuth consent and account notification/connection controls; their HTTP helpers live under `src/api/Auth/` and `src/api/Engagement/`.
- `src/api/Auth/mcpAuthorizationResponse.ts` normalizes OAuth redirects for both login continuation and consent. Better Auth browser responses use `{ redirect: true, url }`; do not confuse that response field with the OAuth request's `redirect_uri`. Keep signed authorization queries intact.
- `src/api/api.ts` - `apiCall(endpoint, options)` helper for normal app API requests: base URL `/api`, query `params`, JSON/FormData bodies, `responseType`, error toasts, `suppress404Toast`. Better Auth and specialized streaming paths have their own clients.
- `src/api/<Domain>/` - per-domain API clients built on `apiCall`.
- `src/hooks/<Domain>/` and `src/hooks/use*.ts(x)` - TanStack Query hooks and shared UI hooks (`use-toast`, `useDebounce`, `useAuth`, ...).
- `src/components/` - shared components; `ui/` holds the shadcn-style primitives (~37 files); domain component folders include `Foods/`, `FoodSearch/`, `FoodUnitSelector/`, `Onboarding/`, `ExerciseCharts/`, `ai/` (assistant-ui chat pieces).
- `src/contexts/` - `ActiveUserContext` (family-access acting-user switching), `PreferencesContext`, `ThemeContext`, `WaterContainerContext`, `ChatbotVisibilityContext`, `ChatToolCategoriesContext` (runtime chat tool-category selection, localStorage-backed).
- `src/layouts/` - `MainLayout.tsx` and `AddComp.tsx`.
- `src/utils/dashboardLayout.ts` and `src/components/widgets/WidgetGrid.tsx` - default Diary widget placement, saved-layout reconciliation, and drag/resize behavior. `src/pages/Reports/ReportsControls.tsx` owns report title, date controls, and category navigation.
- `src/lib/` - `auth-client.ts` (Better Auth React client), `utils.ts` (`cn`), scanner engines, sleep helpers.
- `src/services/` - pure calculation helpers (BMR, body composition, nutrient calculation), not HTTP clients.
- `src/utils/` - logging, user preferences, date helpers, misc.
- `src/tests/` - Jest suites mirroring `components`/`contexts`/`hooks`/`services`/`utils`, plus `test-utils.tsx`.
- `public/locales/<lng>/translation.json` - i18next resources, loaded over HTTP at runtime.

When searching, ignore `node_modules/`, `dist/`, and every locale except `public/locales/en/`.

## Translations (i18n)

- Edit `public/locales/en/translation.json` for source copy. The other locales are machine-synced through the `sync-translations.yml` workflow and a separate SparkyFitnessTranslations repo; do not hand-edit their generated catalogs. For every new or changed user-facing element, add reviewed German copy in `../localization-overrides/de/web.json` in the same change, then apply and check the overlay with `node ../scripts/apply-german-overrides.mjs` and `node ../scripts/apply-german-overrides.mjs --check`. Review the rendered German UI at desktop and narrow widths. Use formal `Sie` or neutral copy consistently within a flow; English fallback and passing key/placeholder checks do not satisfy this requirement. User-entered and provider-supplied names remain literal.
- UI strings go through `useTranslation()` / `t('...')` keys, not hardcoded literals.
- `en/translation.json` is ~120 KB - grep for the key or section you need instead of reading the whole file.
- Developer docs: `../docs/src/developer/translations.md`.

## Visual Review

- Use `../PRODUCT.md`, `../DESIGN.md`, and `../docs/implementation/x-on-track-ui-redesign-audit.md` for the approved identity and reference screens. The current web Dashboard and Nutrition Reports batch is tracked in `../docs/implementation/web-mockup-alignment-2026-09-27.md`.
- From the repository root, `scripts/visual-sample.sh serve` starts an isolated seeded demo account for authenticated local captures. Compare the actual `/` and `/reports?tab=charts` pages at the 1586 × 992 reference size, narrower desktop, and mobile widths in both themes. Preserve user-saved widget layouts and real-data semantics; do not copy the mockups' invented figures into product UI.

## Conventions

- Use `apiCall` (or an existing per-domain client) for backend requests; don't hand-roll `fetch`.
- Prefer declaring toast text via React Query `meta` on the query/mutation instead of imperative `toast(...)` calls where the global handlers cover it.
- Use `src/utils/logging.ts` helpers instead of bare `console.*`; verbosity follows the user's logging-level preference.
- Keep `YYYY-MM-DD` values as calendar-day strings; use the shared timezone/day helpers from `@workspace/shared` instead of `toISOString().split('T')[0]`.
- To learn a database table's shape, read `../shared/src/schemas/database/<Table>.zod.ts` - do not read `../db_schema_backup.sql` or the migrations.
- Auth flows go through `src/lib/auth-client.ts` and `useAuth`; acting-user (family access) state lives in `ActiveUserContext` and affects most data hooks.
- New UI should reuse `src/components/ui/` primitives and existing shared components before adding new ones.
- **Cache Invalidation on Library Mutations:** When mutating foods, exercises, presets, or plans, use the domain invalidation hooks from `src/hooks/useInvalidateKeys.ts` (`useExerciseInvalidation`, `useFoodInvalidation`, `useMealInvalidation`, `useDiaryInvalidation`) to invalidate the entire family of dependent query keys including search, presets, templates, and diary daily progress.
- **Library Deletes & Snapshots:** Deleting foods or exercises uses `mode: 'delete'` which preserves logged diary history (via snapshots) and drops items from presets/plans; only explicit `delete_with_history` deletes diary entries. Empty presets are guarded against starting/logging.

## Testing and Validation

- Test files live in `src/tests/`, mirroring the source area they cover; use `test-utils.tsx` for rendering with providers.
- Run the tests nearest the touched surface first, then `pnpm run validate` for cross-cutting changes.
- Lint is strict (`--max-warnings 0`); unused imports fail the build.

## Quick Routing

- Recommendation or planned-meal issue: inspect `src/pages/Coaching/`, the shared coaching client/forms and `../docs/src/developer/mcp/recommendations.md`. Keep drafts, queries and mutations bound to the owner account.
- Routing/navigation/permission issue: `src/App.tsx` (router, `PrivateRoute`, `PermissionRoute`) and `src/layouts/MainLayout.tsx`.
- API/error-toast issue: `src/api/api.ts`, then the domain client in `src/api/<Domain>/`, then the query/mutation `meta` in the calling hook.
- Auth/session issue: `src/lib/auth-client.ts`, `src/hooks/useAuth.tsx`, `src/pages/Auth/`, and the server's `auth.ts` if it crosses packages.
- Family-access/acting-user issue: `src/contexts/ActiveUserContext.tsx` and the hooks consuming it.
- Chat (Trackbot) issue: `src/pages/Chat/`, `src/components/ai/`, `src/api/Chatbot/`.
- Theme/preferences issue: `src/contexts/ThemeContext.tsx`, `src/contexts/PreferencesContext.tsx`, `src/api/Settings/preferences.ts`, `src/utils/userPreferences.ts`.
- Missing/wrong UI text: the i18n key in `public/locales/en/translation.json` and the `t('...')` call site.
- Chart issue: Recharts usage in the domain page plus `src/components/ExerciseCharts/` or `ZoomableChart.tsx`.

## Priority Rule

- For work inside `XoTFrontend/`, this file wins over repo-root guidance on package-specific details.
- If a task spans packages, combine this guide with the other affected package guides.
- If you add a new domain folder, route family, or cross-cutting convention, update the Domain list, Source Map, and Quick Routing sections of this file in the same change.

## Notification delivery and mobility planning

Notification v1/v2 contracts and opt-in v3 coaching capabilities live in `shared/src/schemas/api/Engagement.api.zod.ts`; installed v1 clients retain strict projections. Mobile owns local-to-server handoff and device retirement in `remoteEngagement.ts`; shared `engagement/policy.ts` owns slot selection. Server `engagementPlanningService.ts` derives unresolved subjects; delivery rechecks completion, revision and device capability before sending. Settings display provider acceptance separately from physical receipt.

Mobility uses owner-only `/api/v2/mobility` and `Mobility.api.zod.ts`, account-local plans and revisioned idempotent mutations. Mobile `mobilityRoutineStore.ts` retains the original local runner and account-scoped operation queue; web `/mobility` edits definitions/plans and reads history. MCP manual results require existing write scope/consent and cannot resolve an active phone session. Do not turn mobility completion into exercise calories or HealthKit writes.

## Micronutrient reports

`src/pages/Reports/MicronutrientCoverage.tsx` displays recorded averages and known/eligible entry counts through `useNutrientCoverage` in the Reports hook/API layers. Coverage has its own response contract and stays outside legacy dynamic numeric trend keys. Provider saves and diary mutations invalidate definitions, preferences, goals and dependent report queries. Local Vite supports `VITE_BACKEND_PORT` (default 3010) for isolated worktrees.
## Reviewed MCP recommendations

- `src/pages/Coaching/`, `src/hooks/Coaching/` and `src/api/Coaching/` own `/coaching`, review/edit/preview, owner schedule/credentials and explicit planned-meal consumption. Keep API/query imports in hooks; invalidate every dependent library/plan/diary family after acceptance. FDDB cards are read-only and empty imports are omitted before dashboard layout.
