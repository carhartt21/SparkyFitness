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

## Remaining verification

This branch has not been merged or deployed. Obtain the exact rejection where
available; distinguish a ChatGPT permission/policy decision from server auth,
schema or expired-lease failure. After a scoped rollout, refresh metadata and
review/update the saved task prompt as the owner. Verify one manual review,
then one unattended review saving its recap through the selected coaching
connection. A prompt clarification is not a verified fix for a platform denial.
