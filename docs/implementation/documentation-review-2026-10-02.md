# Documentation review — 2026-10-02

Reviewed against merged application source `899ac67bc`, on `docs/current-guides-20261002`. This batch changes documentation and navigation only. It does not add MCP actions, alter reminders, publish a mobile build or deploy the documentation site.

## Corrections

| Priority | Observed documentation issue                                                                                                                                                            | Correction                                                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | MCP exercise examples described `log_workout_preset` as starting a workout. Weekly activity authoring and the tool's incomplete activity formatter were not explained.                  | Distinguish plans, diary writes and live phone/Watch sessions. Document the available preset edits, weekly-plan UI handoff, mobility operations and read-back/retry rules. |
| High     | Notification guide described five kinds and a fixed three-per-day limit; no practical permission/handoff/diagnostics guide existed.                                                     | Cover eight v2 kinds, configurable quota, spacing/windows, local intake/timers, follow-ups, status semantics and initial phone activation.                                 |
| High     | MCP docs blurred full API keys, reviewed read-only tools and OAuth permissions.                                                                                                         | Add endpoint-specific capability tables. OAuth notification tools are not advertised at `/mcp`; mixed tools need write access even for nested read actions.                |
| Medium   | Engagement docs named a mock user and called implemented queries “coming soon”. Vision accepted remote image URLs in prose despite handler rejection; coaching omitted evidence limits. | Document real owner-scoped inputs, implemented rules, base64 image handling, explicit photo logging and the legacy coaching fallback/unused target field.                  |
| Medium   | Mobile guide said X on Track branding was development-only and required an initial production logo/signing pass. Diagnostic guidance guaranteed no personal data.                       | Replace with internal TestFlight/setup instructions and current identity boundaries. Explain diagnostics redaction without guaranteeing a private-data-free export.        |
| Medium   | Settings and exercise-library pages were placeholders; current documentation lacked sidebar entry points.                                                                               | Add current overview/workflows, sidebar links and a docs ownership map. Clarify serving counts and unknown provider serving factors.                                       |
| Low      | Dated review index used “latest” for older reviews and the v37 release plan still read as a pending merge.                                                                              | Preserve historical evidence, label dated records accurately and add a factual merge/deployment update.                                                                    |

## Current guide locations

- `docs/src/features/exercises/weekly-planning.md`: whole-session schedules, prompt/prefill, real completion and advanced-editor boundaries.
- `docs/src/features/exercises/mcp-training.md`: practical workflow, German prompts, endpoint capabilities and limitations.
- `docs/src/features/settings/notifications.md`: user configuration/troubleshooting and OAuth update workflow.
- `docs/src/mobile-app/widgets-live-activities.md`: supported placements, permissions, live sessions and Watch slots.
- `docs/src/developer/mcp/`: endpoint-aware tool contracts; `engagement-delivery.md` owns delivery architecture.
- `docs/README.md`: evergreen vs package runbook vs dated evidence responsibilities.

The FAQ now describes internal TestFlight/current package names; two broken comparison→FAQ anchors were fixed. The docs header/hero and favicon reuse the canonical progression-X exports instead of the retired road mark. Original reference images and earlier release evidence are unchanged. The documentation's `/SparkyFitness/` base path, retained `sparky_` MCP names, upstream links and environment/bundle identifiers remain intentional compatibility/attribution references.

## Source verification

- Registry/API-key allowlist: `XoTServer/ai/tools/index.ts`, `ai/mcp/mcpAdapter.ts`, `routes/mcpRoutes.ts`.
- OAuth tools/scopes: `XoTServer/routes/chatgptMcpRoutes.ts`.
- Exercise/preset and weekly-plan tools: `ai/tools/exerciseTools.ts`, `workoutPlanTools.ts` and corresponding schemas.
- Activity plans: `shared/src/schemas/api/WorkoutPlans.api.zod.ts`, mobile plan screens/start hook, web `AddWorkoutPlanDialog.tsx`.
- Daily Progress: `dailyTrackingTools.ts` calls the legacy projection; app objectives use the expanded projection. Do not document them as identical.
- Mobility: `Mobility.api.zod.ts`, `mobilityTools.ts`, `mobilityService.ts`.
- Notifications: `Engagement.api.zod.ts`, shared `engagement/policy.ts`, server planning/delivery/settings services, mobile `remoteEngagement.ts`, `NotificationSettingsScreen.tsx`, intake scheduling and reservations.
- Native presentation: `WidgetGuideScreen.tsx` and existing Live Activity coordinators.
- Legacy coaching/vision: actual handlers and schemas, rather than the previous roadmap prose.

## Verification

Verification results and rendered guide captures are recorded in `evidence/documentation-2026-10-02/README.md`. A VitePress build validates site rendering/internal links, not app runtime behavior. No backend, mobile or frontend feature code changed, so their full test suites and native signing were not rerun for this documentation batch.

## Remaining limits and follow-up

1. General weekly-plan MCP creation/update, rich activity-plan readout, delivery-status/occurrence listing and the expanded Daily Progress MCP projection are not implemented in this merged source. Guides explicitly state the current limits; optional feature branches are not advertised as shipped.
2. Actual OAuth authorization, notification receipt/presentation, Watch placement and Live Activity behavior were not exercised during this docs-only review. Use the installed-build release gates for those checks.
3. Other inherited one-line feature pages and upstream installation guides remain outside this focused training/notifications review. Replace them when their domains are reviewed; no old screenshot or guide should be presented as proof of current X on Track UI fidelity.
4. Keep future release/build states in dated records, with Apple availability verified separately from EAS build or upload acceptance.
