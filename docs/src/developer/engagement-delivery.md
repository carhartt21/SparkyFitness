# Notification delivery and assistant access

This page describes the implemented delivery boundary. For setup and troubleshooting use [Notifications and reminders](/features/settings/notifications); for MCP payloads use [Notification and engagement tools](/developer/mcp/engagement).

## Ownership and settings

Remote engagement is opt-in. The account owns revisioned settings; a phone registers an Expo push token only after notification permission. The token is encrypted at rest and its digest prevents two accounts sharing one active recipient. Initial activation happens on the phone: register the device with local ownership, cancel local optional requests, enable account remote delivery, then confirm remote device ownership. Foreground renewal uses the same cancellation-before-confirmation sequence. An incomplete handoff is not successful activation; inspect the error/status before retrying.

When remote ownership is active, local optional requests pause. Scheduled medication **and supplement** intake, rest and fasting timer notifications remain local. Web/OAuth MCP edits can change the account's optional schedule after phone activation, but cannot request OS permission or configure local intake follow-ups. Turning remote delivery off or changing account/server retires the previous device as part of the mobile flow.

Settings refresh/initialization and mobile edits share a serialized queue. An edit rereads the revision; on a 409 it makes one bounded refresh/retry of only the requested fields. A second conflict remains an error. Web/MCP callers must likewise reread/reconcile instead of overwriting a stale snapshot.

## Versioned contracts

`shared/src/schemas/api/Engagement.api.zod.ts` preserves strict v1 responses for installed legacy clients. Request settings version 2 with `GET/PATCH /api/v2/engagement/settings?version=2`.

V1 supports hydration, meal capture, meal review, movement break and mobility. V2 adds daily check-in, habit and weigh-in kinds, configurable 1–50/null daily limit, hydration interval 1–12 hours and explicit schedule windows/times. Check-in/habit/weight times and enablement come from daily tracking preferences and definitions. A device registration advertises protocol, supported kinds, delivery owner and language. Delivery checks capability; an older client cannot receive an unsupported new kind. Updating an older registration does not reset an existing v2 device's capabilities/ownership.

Owner-only routes also include device registration/retirement, `/status`, `/changes`, `/actions` and movement-start records. Push tokens must never appear in routine diagnostics. `/status` distinguishes server/provider states, devices and diagnostic reasons; the current MCP interface reads settings but has no occurrence/status listing tool.

## Planning and delivery

The shared `shared/src/engagement/policy.ts` selects slots in the account timezone. It considers current synced diary evidence, explicit resolved subjects, context pauses, quiet hours and twenty-minute spacing. Timed subjects are considered before hydration. The default optional quota is three per day; `null` removes the quota while retaining other eligibility rules. Already attempted and snoozed occurrences are included in accounting. Intake and timer alerts are outside this quota.

Meal capture resolves from food/photo capture in its window or an explicit complete/skipped meal state. Photo review resolves when no incomplete captures remain. Hydration requires a known unmet goal and anchors cadence to the latest actual drink. Movement uses its started subject. Check-in requires completed/skipped state; habit and weight use their configured due state and recorded evidence. Unknown facts are not converted into deficit claims or reminder eligibility. The planner rechecks evidence before delivery so a synced resolution can suppress a pending send.

The server planner and due-delivery jobs normally run every five minutes. A configured time is a preferred slot, not a second-exact alarm. Changes invalidate pending slots for replanning. Expired opportunities are not replayed indiscriminately.

An occurrence is claimed before sending. An uncertain Expo response is not automatically retried because the provider has no application idempotency key. A separate job checks push receipts. **Scheduled**, **accepted**, and **receipt confirmed** describe different stages; none establishes that the user saw the alert. Focus mode and summaries remain outside application control.

Snooze/Skip keeps immutable operation IDs across retries. Snoozing still requires an unresolved subject, available quota and a valid window. Local intake follow-ups are bounded to today's +10/+20/+30 minutes; stable identifiers plus cancellation checks prevent a reconciliation pass from appending another copy of the same pending request.

## Mobility is a separate planning domain

Owner-only `/api/v2/mobility` and `Mobility.api.zod.ts` hold routines, schedules, dated plans and revisioned sessions. `xot_get_mobility` is a pure read. Occurrence creation belongs to definition writes and the explicit periodic planner, not GET or MCP snapshot reads. Manual MCP results cannot override an active phone session. Missing step outcomes stay unknown, and mobility does not add exercise calories or HealthKit workouts.

Local retention of the most recent sessions must not generate server deletion operations. Persisted query columns for day/schedule/routine/plan identity must stay synchronized with changed JSON records. See the dated [correction/review records](https://github.com/carhartt21/SparkyFitness/tree/main/docs/implementation) for the implementation history rather than treating early branch proposals as current behavior.

## OAuth and proxy configuration

Set `SPARKY_FITNESS_MCP_OAUTH_RESOURCE` to the exact public HTTPS resource, for example `https://fitness.example.com/mcp/chatgpt`. The retained environment-variable name is a compatibility identifier. Keep `BETTER_AUTH_URL` on the public origin serving web login and `/api/auth`. Forward OAuth `/.well-known/oauth-*`, `/.well-known/openid-configuration`, `/api/auth/*` and `/mcp/chatgpt` through the proxy. The API-key `/mcp` endpoint remains separate. `EXPO_PUSH_ACCESS_TOKEN` is required when Expo push security is enabled for the project; otherwise it is optional.

OAuth requires `mcp:read`; selected writes require `mcp:write`. Better Auth verifies signature, issuer, audience and scope, and the endpoint checks current owner consent on every request. Disconnecting in web Settings revokes access and refresh grants immediately. OAuth tables use the database owner; the application RLS role has no access to them. Do not log OAuth credentials or push tokens.

## Verification boundaries

Contract/unit/database checks cover policy, ownership, conflict handling and operation receipts. A docs build or a successful push-provider response cannot substitute for an installed-device test. On a signed build verify:

1. OAuth authorization, tool discovery, an authorized write/read-back, and revocation with an otherwise-valid token.
2. Initial local-to-remote handoff, a push while the phone app is closed, Snooze/Skip and suppression after a real synced resolution.
3. Intake follow-ups enabled/disabled, taken/skipped cancellation and distinct medication/supplement copy.
4. Workout/fasting/movement/mobility Live Activities and compatible Watch complication slots.

Record actual build, source revision and outcome in the release evidence. Keep private accounts, tokens and health data out of committed screenshots.
