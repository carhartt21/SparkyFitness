# Follow-up calendar review claim correction

## Verified cause and scope

Saved minimum/maximum nutrient-goal direction overrides return absent numeric
bounds as explicit `undefined` properties from `getEffectiveGoalTypes`. The daily,
weekly and manual evidence collector included that object directly in a strict
JSON snapshot. Valid saved preferences therefore caused a `ZodError` while
building the evidence. Monthly/yearly aggregation does not collect that goal row,
so a monthly review could succeed before a following weekly/daily claim failed.

The MCP adapter classified every `ZodError`, including service/output validation,
as invalid tool arguments. That message alone could not establish a malformed
request. Synthetic daily and weekly regression cases failed before the fix, while
the aggregate monthly case passed. This is a verified server defect matching a
reported monthly-success/follow-up-failure sequence; the original failed tool
payload is still needed to attribute that specific invocation conclusively.

The correction branch is `fix/coaching-followup-claim-20261006`, based on the
reviewed OAuth bootstrap branch. Changes are restricted to the server and docs:

- Project JSON-safe goal preferences into evidence, omitting absent bounds while
  preserving the direction and actual numeric bounds, including zero.
- Distinguish `invalid_arguments` from `internal_validation` in adapter errors.
  Internal validation logs contain only the tool and processing stage, without
  record values, account/run/operation IDs, lease tokens or raw schema issues.
- Clarify that claims accept only a UUID `operationId`: new operation for new
  work; reuse the operation only when retrying the same request.

No migration, permission change, calendar-policy change or canonical goal update
is required. Existing completed recaps/slots and feedback acknowledgements are
preserved. A failed evidence claim rolls back its transaction; it must not be
reported as a completed review or acknowledged feedback. Stop-on-error behavior
remains required; unattended execution is a separate acceptance check.

## Validation

- Server `pnpm run validate`: passed (TypeScript, ESLint, Prettier).
- 37 tests in five focused suites passed: goal evidence, adapter validation,
  calendar contracts, real OAuth transport and bound coaching authorization.
- One PostgreSQL-backed regression passed in the isolated disposable sample on
  port 55433. Three successive monthly/weekly/daily claims each published a
  no-change recap with saved unbounded direction preferences and a zero-inclusive
  target range. The next claim returned null; original preferences were unchanged.
  Nine unrelated cases in that file were intentionally skipped by the filter.
- No full backend suite, owner-account claim or new TestFlight build was performed
  for this correction.

After deploying the server correction, resume eligible work with a new claim
operation ID; do not delete the successful monthly recap or recreate its completed
slot. Obtain the failed tool invocation when available to distinguish this
data-validation defect from an independently malformed request. Verify an
authenticated sequential review and then one scheduled unattended review.


## Production rollout

The server correction deployed from `22f8f98058cec6cf4858ebd1da94314260c6cf4b`
at 13:54 UTC on 2026-10-06. A source-layer image uses the exact verified OAuth
hotfix base (`a38f44a3a`) and copies only the two reviewed TypeScript files. The
runtime executes TypeScript through the existing `tsx` entrypoint; dependencies,
shared contracts and runtime image configuration are unchanged. All runtime
TypeScript hashes were compared before/after, with exactly those two changes.
The small context retained the backup capacity guard on the space-constrained
host. Running and rollback images, source archives and backups were retained.

A fresh matched encrypted backup was checksum-verified off-host before switching
the server. The frontend image, PostgreSQL image, protected environment, private
routing, mounts, migration ledger, BLS catalogue count and mobility owner policies
were verified preserved. All services are healthy; public API health and both
OAuth discovery endpoints return 200. Coaching GET returns 405 and anonymous POST
returns 401 with the correct read/propose resource challenge. No new owner grant,
review claim, goal adjustment or scheduled ChatGPT task was performed during
rollout. Existing completed reviews were not rerun or deleted.

Resume eligible work through the existing authorized coaching connection; this
server correction needs no new phone build. The authenticated sequential and
unattended checks remain outstanding. Sanitized deployment facts are in
[evidence/coaching-claim-2026-10-06/production-verification.json](evidence/coaching-claim-2026-10-06/production-verification.json).
