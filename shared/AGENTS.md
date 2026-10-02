# AGENTS.md

_Last updated: 2026-10-02_

`@workspace/shared` is a source-first TypeScript workspace library package for schemas, constants, and timezone/day helpers consumed by XoTServer, XoTFrontend, and XoTMobile.

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
- Changes to `src/schemas/database/` require a matching migration in the server (`XoTServer/db/migrations/`) and RLS policies. CI synchronizes the schema backup after merge; never regenerate it locally.
- Timezone/day-string helpers prevent bugs; prefer them over `toISOString().split('T')[0]`.
- Test any shared change from the consumer packages (`pnpm run validate` in XoTServer, XoTFrontend, and XoTMobile after modifying shared).

## Working Rules

- Keep this package export-focused and schema-focused; logic that scales should live in consuming packages.
- Never export stale or unfinished types; if a consumer is drafting code and needs a type not yet here, add it.

## Wellness activity logging

Wellness entries reuse `/api/v2/tracking/habits` and its dated completion logs with `category: 'wellness'`. They have an empty weekday schedule, no reminder, and no session metrics. They never count toward Daily Progress, exercise calories, or HealthKit/Health Connect workouts. The diary Wellness cards in web and mobile log presets or literal custom names, undo only the selected day, and read 30 days of history ending on that day. Definitions and logs retain the existing check-in permissions and RLS. Shared orchestration lives in `src/tracking/wellness.ts`; keep wellness activities out of the routine habit editors.
