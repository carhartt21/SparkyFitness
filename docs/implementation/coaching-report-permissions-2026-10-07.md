# Coaching report permissions and diagnostics

## Problem and verified boundaries

A scheduled external review reported that it could read its frozen evidence but
platform action checks rejected report writes, including lease renewal. The
reported recap was not saved. A prior manual review had succeeded.

Production was healthy at `a9de03b7e`. Read-only inspection found no committed
report receipt or recap for the affected review. These facts establish no
successful write; they do not prove whether a particular attempted call was
blocked before transport, rejected by authentication/validation, or failed during
execution. The exact platform rejection remains unavailable. No owner records,
leases, feedback cursors, consent, account schedules or external tasks were
modified during investigation.

OpenAI documents separate confirmation of MCP writes, with remembered decisions
limited to a conversation. A manual success therefore does not establish that an
unattended invocation can write. Scope instructions can clarify an authorized
operation but cannot override built-in checks. Sources consulted on 2026-10-07:
[custom MCP confirmation](https://developers.openai.com/api/docs/guides/custom-mcp-server),
[scheduled tasks](https://learn.chatgpt.com/docs/automations), and
[action review](https://learn.chatgpt.com/docs/dots/controls).

## Scoped changes

- Clarify `xot_report_coaching_run`: heartbeat renews a lease; failure closes the
  review and discards staged proposals; success saves an owner-only recap and
  exposes proposals for owner review. It does not publish publicly, send messages,
  log intake or activate goals, plans, reminders or medical changes.
- Keep all write annotations, consent checks, leases, cursor validation and
  idempotency contracts unchanged. No new tool or alternate transport is added.
- Emit INFO diagnostics with only tool, authorization/argument/operation stage,
  and received/completed/failed outcome. Never log inputs, outputs, exception
  text, health data, identifiers or tokens. Read tools emit no new diagnostics.
- Update the shared English/German copy-ready task to name the three bounded
  writes and require all six tools before claiming. The owner reviews that scope
  when saving the task. Returned instructions require stopping after a denied
  write without retries that attempt to bypass it, connection/API substitution or
  autonomous schedule changes. A denied report must not be described as saved.
- Add user/developer guidance for locating a rejection, understanding the two
  permission layers and diagnosing server failures without payload logging.

Existing ChatGPT schedules retain their saved prompts. Refreshing tool metadata
or deploying these changes cannot silently update a task, grant a platform
permission, or prove an unattended recap will succeed. Do not resume a paused
task until its owner has reviewed the prompt/permissions and verified a run.

## Validation

- Frozen offline install passed; lockfile unchanged.
- Server, frontend and mobile `validate` wrappers passed.
- Server: `coachingAdapterValidation`, `coachingCalendar`, `coachingMcpOAuth`:
  3 files / 40 tests passed. Tests cover write annotations, bounded report
  forwarding, incomplete success rejection, authorization/lease boundaries,
  no-change success and absence of secrets/content in diagnostics.
- Web: `CoachingRecaps`, `CoachingOAuthSetup`: 2 suites / 6 tests passed.
- Phone: `coachingContracts`: 1 suite / 8 tests passed.
- Documentation build and whitespace check passed.

The full backend suite remains skipped at the owner's request. Focused tests use
isolated fixtures/mocks and do not constitute a real ChatGPT scheduled execution
or production write. No migration, index, credential or native target change is
required. A later mobile release carries the updated copied prompt on phone;
server/web deployment carries the descriptions, diagnostics and web prompt.

## Production rollout

Merged into main and deployed server/web source
`719b62e39176663e7b2b231c1f4c80e010a28454` on 2026-10-07. Both application
images are healthy. A fresh encrypted matched backup was checksum-verified
off-host before switching, and the prior v45 images/configuration remain
available for rollback.

- Public homepage, API health and both OAuth resource-discovery endpoints
  returned 200. Anonymous MCP initialization returned 401 on both OAuth routes.
- The deployed server adapter and shared calendar match the reviewed source.
  The public web asset containing the updated scoped German prompt matches the
  deployed image.
- Application HTML and all 28 entry/preload/style/service-worker-registration
  assets match the deployed image; all 22 food artwork exports match the source.
- The database image, persistent mounts, protected environment, private routing
  and feature gates were retained. Coaching remains enabled. All 270 migration
  ledger rows, 7,140 BLS foods, serving columns and checked owner policies were
  retained; no migration ran.
- Removed only six archive-matched duplicate extracted build contexts to make
  build space. Their source archives and release/rollback evidence were retained.
  Unused Docker builder cache was reclaimed between image builds; no image,
  volume or backup was pruned.
- Production's existing log threshold suppresses INFO. The new diagnostics are
  installed but are not emitted under that threshold; logging configuration was
  not changed. Missing INFO records therefore cannot establish a pre-transport
  rejection on this deployment.

Sanitized results are in
[the deployment verification record](coaching-report-deployment-verification-2026-10-07.json).
Private configuration and encrypted backups remain outside the repository.
No mobile build, coaching report, claim, proposal, health-data change or external
task/schedule change was performed during this rollout.

## Remaining verification

Obtain the exact rejection where available; distinguish a ChatGPT
permission/policy decision from server auth, schema or expired-lease failure.
Refresh metadata and review/update the saved task prompt as the owner. The
updated copy-ready prompt is available on the web; the phone needs a future
binary for that copy change. Verify one manual review, then one unattended review
saving its recap through the selected coaching connection. Authenticated tool
discovery, real coaching writes and physical-device checks were not performed.
A prompt clarification is not a verified fix for a platform denial.
