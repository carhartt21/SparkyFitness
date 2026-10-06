# Proposal and review MCP workflow

## Trust boundary

`/mcp` accepts owner-bound **mcp-agent** keys (`xotagent_…`). New cloud coaching connections use `/mcp/coaching`: a separate OAuth resource requiring `mcp:read mcp:propose`, current owner consent and an enabled protocol-2 owner/client binding. Its protected-resource discovery lists only these two scopes. Tokens addressed only to `/mcp/chatgpt` cannot access it; missing consent/binding never falls back to legacy tools. Existing bound coaching clients on `/mcp/chatgpt` continue to work. All coaching connections are restricted to selected wellness areas. Domain settings, expiry, binding and revocation are rechecked at tool execution. MCP-only keys cannot create REST sessions or approve actions, even alongside an owner cookie. Legacy direct-write tools are a separate opt-in contract.

The owner app-session API lives at `/api/v2/coaching`. Every route rejects family/delegated contexts and API keys. Strict shared schemas are in `Coaching.api.zod.ts`, `CoachingV2.api.zod.ts` and `MealPlanning.api.zod.ts`; PostgreSQL owner RLS independently enforces isolation. Activation uses canonical repositories/services within the proposal transaction, with revision checks, a five-minute preview fingerprint, library-reference validation and durable idempotency receipts.

## MCP tools

| Tool                            | Access   | Purpose                                                                                                                        |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `xot_get_coaching_context`      | Read     | Selected settings, due window, proposals, commitments, decisions, outcomes and cursors                                         |
| `xot_get_coaching_snapshot`     | Read     | Page through the frozen snapshot by snapshot ID; maximum 100 rows/page                                                         |
| `xot_get_planning_context`      | Read     | Accessible foods, serving variants, recipes, meal types, plans, exercises, presets, habits, reminders and mobility definitions |
| `xot_claim_coaching_run`        | Proposal | Claim one due/queued run using an operation UUID; returns run, snapshot and secret lease token                                 |
| `xot_submit_coaching_proposals` | Proposal | Stage up to 50 validated proposals/batch, at most 200/run, with a stable operation UUID                                        |
| `xot_report_coaching_run`       | Proposal | Renew the lease, publish all staged proposals on success, or discard them on failure                                           |

Follow all snapshot, proposal, commitment and event cursors. Reads create no dated plans, evidence snapshots or run leases. Claiming is an explicit write. Submit/report requests carry the returned `runId`, `leaseToken` and a fresh operation UUID; reuse that UUID and payload on a network retry. Leases last 15 minutes but the run's wall limit is ten minutes. Renewal never extends that wall limit. Failed runs may retry the same scheduled slot at most three times with a 15-minute delay. Partial proposals remain invisible until successful publication.

Every proposal includes a stable topic, selected domain, title/rationale, impact 1–5, benefit, effort, confidence, actual snapshot row IDs, account-local dates, units, honest coverage/limitations, a measurable success criterion, a strict typed action and expiry. Use planning IDs rather than invented library items. Adherence metrics use canonical ratios 0–1; success units are schema-validated. The server bounds coverage by cited recorded days and marks provider synchronization freshness unknown. Food zeros do not establish nutrient coverage; old template-generated foods are unconfirmed. Active calorie summaries already include workouts. Generic tasks have explicit owner completion; objectives and adherence use confirmed server evidence only.

Workout adherence shares the Weekly activities projection: all saved exercise requirements must be met in one session, or actual duration/distance must meet every whole-activity target. Started sets, prefills and timers do not establish completion. Optional, rest and skipped sessions are excluded; unknown prescriptions reduce coverage rather than counting as failures. Today's sessions remain open. Only elapsed days with `completionBasis: "saved_prescription"` enter workout outcomes; older attendance-only snapshots are ignored. Reviewed workout actions retain activity type, optional status, local time and duration/distance targets without recording Diary activity.

## Cloud calendar protocol 2

The primary setup is an owner-created ChatGPT cloud task. The application lists currently authorized OAuth read/proposal consents, binds a selected client and provides copy-ready schedule instructions; there is no verified public scheduling API installed. Eligibility follows [OpenAI automations](https://learn.chatgpt.com/docs/automations). MCP Events are outside this implementation.

In ChatGPT, add `https://<your-host>/mcp/coaching` as a new coaching connection, using the address copied from Recommendations. Its consent screen must show selectable review areas and proposal access, not just the older read/write permissions. Approving creates a protocol-2 binding for the selected areas. Refresh the authorized connections list in Recommendations; selecting that connection can then update the binding to the app's selected domains and optional context permissions. A generic reconnect to `/mcp/chatgpt` can retain the client's older scope request; refreshing tool metadata alone does not grant proposal access. The server registers the additional OAuth resource through its existing auth-provider initialization. No health-record migration or manual grant editing is needed. Dynamic clients registered before this resource was added may need fresh registration; never patch owner consent to simulate approval.

Settings, context and agent creation negotiate `?version=2`. Older clients receive strict protocol-1 projections; legacy settings patches retain new fields. The OAuth/key agent binding records protocol 1 or 2, selected wellness domains and independently scoped `supplement_adherence`/`notification_history` permissions. An OAuth binding requires current owner read and propose consent. Bound OAuth transport never exposes legacy direct-write tools, including after disable/revocation or feature-flag shutdown.

`calendarCoachingSlots` uses account-local boundaries and a saved `HH:mm` review time (default 08:00). Latest prior year, month, week and day are independently tracked; manual queued work comes first. Successful slot keys are retained in `coaching_settings.completed_slots`, independently of 90-day run cleanup. Old agents cannot claim protocol-2 calendar work. A protocol-2 agent uses the calendar policy even if a legacy settings row has not yet been saved through the new UI.

A protocol-2 claim adds `instructions`, `feedbackCursor` and `feedbackThrough` to its frozen snapshot/lease. Context event pages are bounded by that run's frozen feedback endpoint. Read every page from `feedbackCursor`, and follow all proposal/commitment and snapshot pages. The server retains later events for the next run.

A successful `xot_report_coaching_run` requires:

- `recap`: title (160 characters), summary (4,000), up to 12 observations with actual frozen row IDs, and up to 12 limitations.
- `processedEventCursor`: exactly the claimed `feedbackThrough`, acknowledged only after reading all frozen feedback.
- The existing run ID, lease token, succeeded status and stable operation UUID.

The transaction validates current domain/context permission, retains only cited recap evidence, inserts the recap, publishes staged proposals, advances the agent cursor and completes the cadence slot together. An invalid recap/cursor or failed run publishes nothing and acknowledges nothing. A repeated operation returns its original result. No-change success still needs a recap. Permission revocation cancels running reviews and staged proposals; visible evidence also respects current permissions. Recaps are intentionally retained until owner deletion, including after connection revocation; revocation is not a data-erasure operation.

Monthly/yearly retrieval aggregates before reading into memory (at most 12 rows per existing projection). Food energy excludes unconfirmed planned entries and preserves unknown nutrients; supplement nutrient totals are explicitly excluded from that aggregate. Daily active energy already includes workouts. Optional supplement adherence requires an extant explicitly marked supplement definition; medications/doses never enter it. Optional notification context includes current server settings and bounded grouped occurrence/provider/action counts. It excludes push tokens, subject identities and phone-only history; accepted rescheduling requests are distinct from delivery and receipt.

Every plan, goal and notification change remains a typed staged proposal needing the owner's app-session preview and acceptance. The existing future-effective plan versions, library references, scope, receipts and confirmed outcome rules remain authoritative. A declined topic requires explicit reconsideration. A digest considers unread recaps or pending proposals, reuses Engagement v3 delivery/quiet-hours/quota, and remains at most one attempt per account/local day.

## Mac subscription runner

This is an optional, separately configured alternative, not an automatic cloud fallback. Each CLI invocation reviews one eligible period. The runner supports both protocols and persists its existing summary as a recap; protocol 2 acknowledges only the frozen feedback boundary after its read audit.

This reference runner uses the owner's **saved Codex ChatGPT login**. It does not use the app's AI provider, a server model worker or a paid API fallback. The server schedules work; the Mac polls every 15 minutes. It coalesces missed windows and resumes after sleep/network loss. Subscription availability and limits still apply; a quota/authentication failure publishes nothing.

Requirements: installed Node, the pinned pnpm workspace dependencies, a recent Codex CLI supporting `--ignore-user-config`, `--ignore-rules`, `--strict-config` and `--ephemeral` (verified with 0.160.0), and a saved ChatGPT login. Verify `codex login status` reports ChatGPT. Login changes must be completed by the account owner. Model choice is explicit in the private runner configuration; use a model available to that login.

Create `~/Library/Application Support/XonTrack/coaching/config.json`, outside the repository, with directory mode 700 and file mode 600:

```json
{
  "url": "https://YOUR_HOST/mcp",
  "key": "PROPOSAL_ONLY_KEY_FROM_RECOMMENDATIONS",
  "codexBinary": "/ABSOLUTE/PATH/TO/codex",
  "model": "MODEL_AVAILABLE_TO_YOUR_CODEX_LOGIN",
  "language": "de"
}
```

Replace the placeholders locally; never commit a key or put it in a command argument. The URL must use HTTPS, except for localhost samples. The runner rejects group/world-readable configuration. Use an absolute Codex binary path for LaunchAgent reliability. From `XoTServer/`:

```bash
pnpm coaching:runner --diagnose
pnpm coaching:runner --once
pnpm coaching:runner --install
```

An alternative configuration path can be supplied after the mode. `--diagnose` verifies login/connection without claiming work. `--once` processes a due or manually requested review. `--install` creates the current user's `de.ilmtech.xot.coaching` LaunchAgent, using absolute Node/tsx/script paths and a 900-second polling interval. Keep this checkout and its dependencies at their installed paths. A lock prevents overlapping runs. Generated output/schema files live in a private temporary directory and are deleted afterward; no model transcript is persisted by the wrapper.

```bash
pnpm coaching:runner --pause
pnpm coaching:runner --resume
pnpm coaching:runner --uninstall
```

Pause only the local runner with `--pause`; pause server scheduling in Recommendations. Uninstall removes the LaunchAgent, then revoke the connection in the app and remove the private config when no longer needed.

### Model restrictions

The child ignores user configuration/rules, uses an ephemeral session and a read-only sandbox, disables shell/unified execution, browser/computer use, apps, plugins, hooks, memories, image tools and subagents, and requires the one configured MCP connection. Its tool allowlist contains only the three read tools. The wrapper alone claims, stages and reports. API-key environment variables are removed from the child environment and ChatGPT login is forced. Missing MCP, invalid structured output, timeout, auth, quota or connectivity failures publish nothing. A heartbeat runs every minute; model work aborts before the server wall limit.

The CLI's `code_mode_host` must stay enabled to dispatch even the three allowed MCP reads. Shell, browser, apps, plugins, local goals, skill discovery, elicitation and other integrations remain disabled. The output schema narrows action kinds and metrics to selected areas. The wrapper checks successful completed tool events for every assigned snapshot, proposal, commitment and event page before publishing an empty or nonempty result. It keeps only paging cursors in memory. Failure output contains a bounded status and processing stage, never model content or health data.

Structured output uses the supported provider schema subset: discriminated unions become `anyOf`, object properties are required, and optional non-nullable values use a null placeholder. The wrapper removes those placeholders before full strict shared Zod validation. Nullable values retain their clear semantics; unknown fields stay rejected. Canonical metric/unit relationships and adherence targets of 0–1 are encoded in the provider schema as well as the shared validation. See [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Configuration mismatches report `configuration`; incomplete reads or invalid actions report `invalid_output`.

Official Codex references: [configuration](https://learn.chatgpt.com/docs/config-file/config-reference), [non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode).

## Owner REST routes

| Route (under `/api/v2/coaching`)                             | Methods           | Contract                                                                                    |
| ------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------- |
| `/settings`                                                  | GET, PATCH        | Feature availability, account timezone, schedule/domain/digest settings, expected revision  |
| `/connections`, `/recaps`, `/recaps/:id`, `/recaps/:id/read` | GET, POST, DELETE | Authorized OAuth metadata; owner-only recap paging/detail, read and explicit recap deletion |
| `/context`                                                   | GET               | Owner review/run status                                                                     |
| `/agents`, `/agents/:id/key`, `/agents/:id/revoke`           | POST              | Create binding, issue/rotate key once, revoke                                               |
| `/runs`                                                      | POST              | Explicit manual request, optional reconsidered topics                                       |
| `/inbox`, `/planning`, `/proposals/:id/evidence`             | GET               | Paged inbox, accessible references, retained cited evidence                                 |
| `/proposals/:id/preview`, `/proposals/:id/review`            | POST              | Validate edit and obtain fingerprint; accept or decline with operation UUID                 |
| `/actions/:id`                                               | PATCH             | Revisioned task completion/skip/stop with optional feedback                                 |
| `/proposals/:id`                                             | DELETE            | Owner deletes inactive recommendation history                                               |
| `/planned-meals`, `/planned-meals/prepare`                   | GET, POST         | Pure dated read; explicit rolling materialization                                           |
| `/planned-meals/:id/confirm`, `/planned-meals/:id/skip`      | POST              | Explicit consumption receipt or skip without intake                                         |

Consult the shared schemas for exact payloads. A preview is mandatory for acceptance; errors are 400 (invalid), 403 (wrong identity/access), 404 (not found), or 409 (stale/conflicting). Do not turn success metrics, reminders, taps or timers into diary writes. New meal/workout plans are prompt-only and historical diary snapshots are preserved.

## Verification and rollout

Start the isolated sample with `XOT_COACHING_ENABLED=true scripts/visual-sample.sh serve`. Database workflow tests require `XOT_COACHING_DB_TEST=1` and exactly the local disposable sample database; they never accept production configuration. Validate/test all three packages because shared-only edits do not trigger path-gated CI. Build the web and documentation sites. An iOS build and device push check remain separate from TypeScript/Jest gates.

Deploy server/shared migrations and compatible clients together, initially leaving `XOT_COACHING_ENABLED=false`. Reconcile the running release revision with the candidate, retain exact image/backup rollback references, boot migrations through normal startup, verify health/auth/legacy MCP, then opt in a test owner and configure/test one eligible cloud task (or an explicitly chosen private runner). Verify an unattended authenticated cloud round-trip before announcing cloud scheduling as active. Enable production scheduling after authenticated review/editor/meal flows and Engagement v3 delivery have been accepted. Disabling the flag stops new coaching processing; already accepted canonical configurations and diary logs persist. Roll back images with the forward-compatible schema retained; never drop populated coaching/version/receipt tables as a rollback.
