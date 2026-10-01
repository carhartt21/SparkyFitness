# MCP saved measurement values — 2026-10-01

## Request and cause

The connected assistant could see that a weigh-in was recorded but could not read its value. `sparky_get_measurement_reminder_status` queried only a timestamp; Daily Progress's `measurement_recorded` reason describes completion, not the measurement itself.

## Contract

The existing read-only reminder tool now returns `measurement_recorded`, `measurement_id`, `value`, `unit`, `recorded_at` and `source` alongside each reminder's configuration and due state. Weight is a finite number in canonical kg. Custom measurements retain their stored text and category unit. Zero is recorded; absence is false with null fields. Only values saved on the requested calendar day are returned, with no prefills. The account's timezone resolves `today` and the default date.

Custom rows are selected by latest update/entry timestamp with deterministic ties; value, source and timestamp come from that row. Weight has no stored provider provenance and reports a null source. `recorded_at` describes the saved row's last update, not proof of a device measurement time.

`recordedMeasurementValuesOn` centralizes this read; the existing `recordedMeasurementsOn` projects timestamps for Daily Progress. Reminder configuration REST responses and the Daily Progress contract remain unchanged. This tool reads configured reminders, not arbitrary measurement history. MCP read-only API keys and OAuth `mcp:read` use the same pure-read tool implementation.

## Access-change checklist

1. Migration: not applicable; the existing tables store all fields.
2. RLS: existing application-role policies retained; fixed authenticated owner and calendar-day filters. No system pool, target-user argument, delegation or grants added.
3. Startup: booted the exact source on an isolated PostgreSQL database, applied migrations and reapplied RLS; `/api/health` returned UP.
4. Schema backup: unchanged; no local regeneration.
5. Shared contract: added `RecordedMeasurementValue` and a separate `measurementReminderMcpStatusResponseSchema`; existing export covers them. Table schemas are unchanged.
6. Documentation: updated MCP feature/developer guides, sharing and security-tier notes, and server/shared source maps. Database index unchanged because no domain/table was added.
7. Downstream: web/mobile consume the unchanged reminder REST contract; both full validation scripts passed.
8. Validation: focused MCP/repository/progress tests passed; five real-database measurement cases and 283 RLS permission-matrix cases passed. Server, web and mobile full validation scripts and the docs build passed. The full server coverage suite passed: 438 suites and 5,224 tests; 11 suites and 375 database/environment-gated tests were skipped in the default run. The five measurement integration cases and the RLS matrix were run separately against the isolated migrated database.

## Release scope

The fix is isolated from the pending coaching batch and based on the running OAuth frontend source revision. Deployment changes only the backend image, retains the current frontend and database, and requires an authenticated MCP read after rollout. Production status and exact revision will be recorded after verification.
