# AGENTS.md

_Last updated: 2026-10-01_

`@workspace/shared` is a source-first TypeScript workspace library package for schemas, constants, and timezone/day helpers consumed by XoTServer, XoTFrontend, and XoTMobile.

## Weekly activity planning

`activity_plan_resolutions` is owner-only. `/api/v2/activity-planning` projects
immutable Workout Plan versions and existing dated Mobility plans without writes.
`include_activity=true` opts Daily Progress into version 2; preserve the default
version 1 contract. Workout links/skip/undo never mutate Diary or calories. Cache
activity queries under the Daily Progress family. See
`docs/implementation/weekly-activity-goals-2026-10-01.md` and
`docs/src/features/weekly-activities.md` for completion and history rules.

## Scope

- This package defines contracts and shared logic, not an app.
- Validate changes from consuming packages (server, frontend, mobile), not in isolation.
- Every schema change here potentially touches three packages.

## Structure

- `src/schemas/database/` - one Zod file per table (`Foods.zod.ts`, `Exercises.zod.ts`, ~60 files). Agent shortcut: to learn a table shape, read the matching file here instead of the SQL dump.
- `src/schemas/api/` - API request/response contracts (`*api.zod.ts`).
- `src/schemas/api/DailyTracking.api.zod.ts` - daily tracking REST contracts plus the separate MCP-only measurement reminder status response (recorded flag, saved value, explicit unit and row provenance); do not widen the reminder configuration REST response with these fields.
- `src/schemas/api/Engagement.api.zod.ts` and `src/schemas/database/{Engagement,McpOAuth}.zod.ts` - notification delivery/action contracts and auth-owned MCP OAuth table shapes.
- `src/constants/` - shared constants and enums (exercises, nutrients, meal types, fasting protocols, medication schedules, cycle phases, etc.).
- `src/utils/` - timezone helpers (`todayInZone`, `instantToDay`, `dayToUtcRange`, `compareDays`, `addDays`, `isDayString`), cycle/menstruation helpers, and unit/calculation utilities.
- `src/ai/`, `src/cycle/`, `src/medications/`, `src/mood/` - domain-specific helpers.
- `src/foodSearch/relevance.ts` - shared deterministic food-query normalization and candidate ranking for server, web, and mobile; keep provider I/O in each consumer.

## Naming Convention

- `X.api.zod.ts` = API request/response schema
- `X.zod.ts` = database table schema
- Export everything from `src/index.ts`; consuming packages import both types and values via `@workspace/shared`

## Cross-Package Contract Rules

- Changes to `src/schemas/api/` usually affect server routes and both frontend/mobile API clients.
- Changes to `src/schemas/database/` require a matching migration in the server (`XoTServer/db/migrations/`), RLS policies and downstream validation. CI creates the schema-backup sync PR; never regenerate or edit that backup locally.
- Timezone/day-string helpers prevent bugs; prefer them over `toISOString().split('T')[0]`.
- Test any shared change from the consumer packages (`pnpm run validate` in XoTServer, XoTFrontend, and XoTMobile after modifying shared).

## Working Rules

- Keep this package export-focused and schema-focused; logic that scales should live in consuming packages.
- Never export stale or unfinished types; if a consumer is drafting code and needs a type not yet here, add it.

## Reviewed MCP recommendations

- `src/schemas/api/{Coaching,MealPlanning}.api.zod.ts`, database `{Coaching,MealPlanning}.zod.ts`, `src/coaching/` and `src/fddb/` define coaching trust/action contracts, scheduling, confirmed outcomes, shared client/editor behavior and FDDB presentation. Engagement v3 adds coaching kinds; v1/v2 schemas remain strict. Validate all consuming packages.
