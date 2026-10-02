# Proposal and review MCP workflow

## Trust boundary

`/mcp` accepts owner-bound **mcp-agent** keys (`xotagent_…`), while `/mcp/chatgpt` accepts an OAuth access token with current `mcp:propose` consent and an enabled owner/client binding. Both are restricted to selected wellness areas. Domain settings, expiry, binding and revocation are rechecked at tool execution. MCP-only keys cannot create REST sessions or approve actions, even alongside an owner cookie. Legacy direct-write tools are a separate opt-in contract.

The owner app-session API lives at `/api/v2/coaching`. Every route rejects family/delegated contexts and API keys. Strict shared schemas are in `Coaching.api.zod.ts` and `MealPlanning.api.zod.ts`; PostgreSQL owner RLS independently enforces isolation. Activation uses canonical repositories/services within the proposal transaction, with revision checks, a five-minute preview fingerprint, library-reference validation and durable idempotency receipts.

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

## Mac subscription runner

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

| Route (under `/api/v2/coaching`)                        | Methods    | Contract                                                                                   |
| ------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `/settings`                                             | GET, PATCH | Feature availability, account timezone, schedule/domain/digest settings, expected revision |
| `/context`                                              | GET        | Owner review/run status                                                                    |
| `/agents`, `/agents/:id/key`, `/agents/:id/revoke`      | POST       | Create binding, issue/rotate key once, revoke                                              |
| `/runs`                                                 | POST       | Explicit manual request, optional reconsidered topics                                      |
| `/inbox`, `/planning`, `/proposals/:id/evidence`        | GET        | Paged inbox, accessible references, retained cited evidence                                |
| `/proposals/:id/preview`, `/proposals/:id/review`       | POST       | Validate edit and obtain fingerprint; accept or decline with operation UUID                |
| `/actions/:id`                                          | PATCH      | Revisioned task completion/skip/stop with optional feedback                                |
| `/proposals/:id`                                        | DELETE     | Owner deletes inactive recommendation history                                              |
| `/planned-meals`, `/planned-meals/prepare`              | GET, POST  | Pure dated read; explicit rolling materialization                                          |
| `/planned-meals/:id/confirm`, `/planned-meals/:id/skip` | POST       | Explicit consumption receipt or skip without intake                                        |

Consult the shared schemas for exact payloads. A preview is mandatory for acceptance; errors are 400 (invalid), 403 (wrong identity/access), 404 (not found), or 409 (stale/conflicting). Do not turn success metrics, reminders, taps or timers into diary writes. New meal/workout plans are prompt-only and historical diary snapshots are preserved.

## Verification and rollout

Start the isolated sample with `XOT_COACHING_ENABLED=true scripts/visual-sample.sh serve`. Database workflow tests require `XOT_COACHING_DB_TEST=1` and exactly the local disposable sample database; they never accept production configuration. Validate/test all three packages because shared-only edits do not trigger path-gated CI. Build the web and documentation sites. An iOS build and device push check remain separate from TypeScript/Jest gates.

Deploy server/shared migrations and compatible clients together, initially leaving `XOT_COACHING_ENABLED=false`. Reconcile the running release revision with the candidate, retain exact image/backup rollback references, boot migrations through normal startup, verify health/auth/legacy MCP, then opt in a test owner and install its private runner. Enable production scheduling after authenticated review/editor/meal flows and Engagement v3 delivery have been accepted. Disabling the flag stops new coaching processing; already accepted canonical configurations and diary logs persist. Roll back images with the forward-compatible schema retained; never drop populated coaching/version/receipt tables as a rollback.
