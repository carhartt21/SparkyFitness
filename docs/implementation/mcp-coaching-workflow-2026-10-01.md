# Bidirectional MCP coaching workflow

Implementation branch: `feat/mcp-coaching-workflow-20261001`, based on
`53c7092ef` in an isolated worktree. The main XoT worktree contains ongoing Watch
changes and is not modified by this implementation.

## Approved contract

External agents read owner-selected wellness domains, submit evidence-backed
proposals, and read subsequent decisions and outcomes. Only the account owner,
using an app session, can edit, approve, decline, or stop an action. Approval
activates the displayed effects immediately in one transaction. Meals and
workouts remain planned until the owner explicitly logs consumption or activity.

The reference runner uses saved Codex ChatGPT authentication on the owner's Mac.
It polls every 15 minutes; the server schedules daily reviews at 08:00 and 20:00
and a weekly review on Sunday at 09:00 in the account timezone. All times are
editable. Model access is read-only; the wrapper stages and publishes proposals.

## Implementation tracking

- [x] FDDB read-only card; entry-based visibility and no empty layout slot
- [x] Shared strict contracts, migrations, owner RLS, and documentation
- [x] Proposal-only credentials, OAuth consent, and tool execution enforcement
- [x] Frozen evidence, leased runs, retention, publication and feedback
- [x] Preview, transactional activation, tasks/objectives and canonical mutations
- [x] Prompt meal plans, immutable versions and idempotent consumption logging
- [x] Web and mobile inbox, review editors and schedule settings
- [x] Engagement v3, review digests and accepted action reminders
- [x] Mac runner, installation commands, diagnostics and bounded recovery
- [x] Package validation, full automated suites and real database verification
- [ ] Authenticated visual acceptance and fresh finish review
- [ ] New iOS binary and physical-device Engagement v3 delivery check
- [ ] Production candidate build, matched backup and gated rollout

## Verification record

### Automated checks

The isolated PostgreSQL sample uses `127.0.0.1:55432` and
`sparkyfitness_visual`; its generated credentials and data stay in ignored
`.visual-sample/`. Migrations are applied through normal server boot:

- `20261001090000_coaching_workflow.sql`
- `20261001091000_engagement_v3_coaching.sql`
- `20261001103000_coaching_runner_configuration_status.sql`
- `20261001120000_workout_plan_version_owner_identity.sql`

The third migration adds a runner configuration failure classification without
editing an already-applied migration. The database schema backup is untouched;
CI owns its eventual sync. The fourth migration corrects the existing workout
version owner foreign key from retired `auth.users` to Better Auth's public
`user` table, preserving versions and diary history. Shared database/API schemas and exports, security
tier/sharing documentation, downstream clients and package guides are updated.

Final automated package checks:

| Check | Result |
| --- | --- |
| Frozen pnpm install | Pass |
| Web validate, full suite, production/PWA build | Pass; 165 suites / 1,438 tests |
| Mobile validate and full suite | Pass; 516 suites / 7,450 tests |
| Server validate and full suite | Pass; 441 suites / 5,232 tests; 11 suites / 381 optional tests skipped |
| Additional PostgreSQL/auth checks | Pass; initial 30 checks, then 11 final coaching database checks |
| Documentation site build | Pass |
| MCP initialization over HTTP | 200; JSON-RPC response, no HTML challenge |

Coverage includes owner RLS and schema parity for 13 changed tables,
selected-domain evidence, pure reads, leased/staged publication, forged citation
rejection, deduplication/decline suppression, failed-run cleanup, preview conflict
checks, atomic/idempotent activation, explicit meal consumption, legacy device
refresh compatibility and the once-per-local-day digest rule. The generic legacy
schema-parity suite reports 26 pre-existing missing schema aliases; the
changed-table parity gate passes separately.

Final hardening adds weekday controls in both review editors, existing-habit
type preservation, complete existing-workout set previews, retained receipt
cleanup on owner history deletion and a subscription evidence-read audit.
Targeted PostgreSQL, policy, runner, web review and mobile contract checks pass.
Retention cleanup runs with feature processing disabled while leaving accepted
actions unchanged. All four migrations have applied through normal server boot.

### Subscription runner verification

The installed Codex CLI is 0.159.2 and reports saved ChatGPT authentication. The
restricted CLI configuration executes without an API key. A synthetic-only
account verifies HTTP MCP and actual context/snapshot tool reads.

Testing found that disabling `code_mode_host` prevented even allowlisted MCP
reads. The host is now enabled while shell, browser, apps, plugins and other
integrations remain disabled. The wrapper audits completed CLI MCP events and
requires all snapshot, proposal, commitment and event pages before publication,
including an empty result. Only paging cursors are retained in this audit; model
transcripts and health contents are not persisted. Incomplete reads fail the run.
Canonical metric units and adherence ranges are included in the provider schema
because Zod's custom refinements are not otherwise represented there.

The full CLI → HTTP MCP → stage → publication run succeeds and publishes one
recommendation from seven synthetic nutrition days. Owner email/password sign-in
then verifies mandatory preview, acceptance, identical retry activation,
explicit task completion and completion feedback visible through MCP. Food
entry count stays unchanged. A mixed MCP-key/owner-cookie REST request is 403.
Another pending synthetic proposal remains available for manual owner review.
The private local login is in `.visual-sample/coaching-owner-login.json`; no
password, cookie, API key or health transcript appears in this record.
After verification, the synthetic runner binding is revoked (MCP returns 403),
its raw key and temporary CLI diagnostics/output are removed, and sample
scheduling is paused. The isolated owner login, synthetic diary and pending
review stay available at `http://localhost:8080/coaching` for manual acceptance.

The HTTP MCP check exposed legacy recursive null stripping that removed required
nullable proposal fields. Only legacy tools retain that compatibility behavior;
typed coaching calls preserve nullable references and explicit clears. Both
paths have regression coverage.

### Remaining acceptance gates

The computer-use tool continues to report a saved block for
`http://localhost:8080`, despite user screenshots showing **Always allow** and
application restarts. This blocks the Impeccable authenticated capture/finish
review requirement. No alternate browser or automation bypass was used. Code,
unit/database checks and builds do not establish visual fidelity.

Capture owner review, edited preview, stale/error/empty states, Active/History,
schedule/connections, planned consumption and FDDB entry/empty days in both
themes, English/German, enlarged text, reference and narrow widths. Verify
account switching and saved Dashboard layouts. Native acceptance also needs
the new installed binary, owner-scoped notification tap, shared quiet hours/cap
and a real Engagement v3 push.

Sequential workout templates do not expose a dated eligible-occurrence calendar
to coaching evidence. Their automatic adherence remains unknown; weekly dated
plans use confirmed completed sets. This avoids inventing an adherence score.

## Production handoff

Read-only verification found both running healthy frontend and server containers
at source revision `53c7092ef642154e2254d16ede70d2ff6ed02a6a`, matching this
implementation's base. Their image IDs are:

- Frontend: `sha256:2f3e9a9a58410e29cb84f09d981c452e9728b8f150ef81a21cb54ea983777ceb`
- Server: `sha256:81dedd835a42590c0918d34a044cfbab7402add3d57e693bd2b87ac0c614aadb`

No production deployment, credential change, scheduling enablement or installed
LaunchAgent was performed. `XOT_COACHING_ENABLED` defaults to false in the
tracked deployment template/Compose contract.

After acceptance, build the exact candidate server/frontend revisions, retain
the current release/image references and verify a matched fresh database backup.
Deploy with coaching disabled; normal boot applies migrations/RLS. Smoke-check
health, auth, legacy MCP and existing clients, then enable one test owner and its
private runner. Enable scheduling after owner review/consumption and device push
acceptance. Image rollback retains forward-compatible tables and historical
diary data; do not drop populated tables or restore over newer diary writes.
