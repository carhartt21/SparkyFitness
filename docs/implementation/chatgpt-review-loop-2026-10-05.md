# Bidirectional ChatGPT review loop — 2026-10-05

Implemented on `feat/chatgpt-review-loop-20261005`, based on main `0c14fc15b`. The separate v42 corrective worktree/branch is untouched. This record describes implemented code, not an activated cloud schedule or production release.

## Approved scope and implemented stages

1. **Contracts and calendar:** additive protocol 2 settings/agents, one 08:00 account-local cloud task, independently completed daily/weekly/monthly/yearly slots, strict protocol-1 projections. Latest missed period per cadence; at most five sequential claims per cloud invocation. Manual requests queue work instead of claiming to trigger ChatGPT immediately.
2. **Trust and evidence:** OAuth owner read/propose consent required for binding; bound OAuth connections expose only six coaching tools, including with older broad write grants. Disable/revoke/flag-off fails closed. Current selected domains and independent supplement/notification permissions apply to frozen evidence and derived historical proposals/commitments/feedback before pagination. Medications/doses are excluded. Monthly/yearly SQL aggregates avoid raw annual diaries, keep null metrics unknown and mark recorded counts as counts, not adherence. Current server reminder settings and grouped delivery/action history omit tokens/subject identity and do not establish receipt.
3. **Durable publication and feedback:** successful report requires a typed recap and exact frozen feedback acknowledgment. Recap, staged proposals, cadence completion and cursor advance commit atomically; failure/invalid output publishes nothing. Later feedback remains for the next run. Declines stay suppressed until reconsidered. Per-cadence completion survives run cleanup or recap deletion; owner recaps/cited evidence survive run/snapshot/agent cleanup until explicit deletion.
4. **Phone/web:** Recaps default tab, no-change recap, detail/read/delete, existing typed preview/approval, active follow-up/outcomes, cloud connection discovery and copy-ready task instructions, calendar/24-hour settings, independent context consent and visible connection scopes. Insights/Reports links reuse real routes. Saved settings drive the setup prompt. EN source and reviewed German overlays are maintained; reminder voice uses emoji/du. Neutral existing cards and responsive controls remain in the current design system.
5. **Compatibility and documentation:** existing optional Mac runner now retains its summary as a recap and supports protocol-2 feedback cursors; it is not installed or activated as a fallback. Engagement v3 digest considers unread recaps or pending proposals, using existing daily cap/quiet hours/device ownership. Existing approval, logging, plan versions, offline flows and snapshots are preserved. Current setup, MCP contracts, table/security/sharing guides and package source-map pointers updated.

## Migration checklist

- `20261005120000_coaching_review_loop.sql` applied through normal server startup on a disposable PostgreSQL instance at 127.0.0.1:55443; RLS reapplied cleanly.
- `coaching_recaps` is Tier 1 owner-only in RLS startup list/policy, shared database schema, table index and both sharing/security guides.
- Protocol 2 shared/API schemas exported; REST/OpenAPI, both clients, MCP and compatibility tests updated.
- `db_schema_backup.sql` untouched; CI owns the schema-sync PR after merge.
- No populated-table replacement, live migration, deployment, credential edit, task creation, goal/plan/dose change or native publication occurred.

## Checks actually run

- Frozen offline workspace install passed, without new dependencies.
- XoTServer validate passed (TypeScript, lint, format).
- XoTMobile validate passed (locale generation/overlays/German copy, types, lint, i18n audit, knip, native locales, Watch geometry, widget assets, format).
- XoTFrontend build passed, including its full validate wrapper and production/PWA bundle.
- Documentation production build passed with internal links checked.
- **101 server tests passed in 12 focused files**, including PostgreSQL review/workflow, RLS/delegation, calendar boundaries, cursor read audit, scope/citation checks, transport/authentication and legacy MCP contracts. The disposable sample's `SPARKY_FITNESS_DEMO_MODE` was set false only for this test process: demo mode intentionally rejects the legacy full-access 1.5 MB request used by one test. Both base and changed routes passed that test outside demo mode. No blanket backend suite was run.
- **16 phone tests passed** (owner review contracts, coaching push response, notification copy). **16 web tests passed** (approval editor, recap/read/delete/error behavior, OAuth authorization-response validation).
- Repository layout and `git diff --check` passed. Impeccable detector ran once on the changed coaching web screens with no findings.
- [German web captures and exact native limits](evidence/chatgpt-review-loop-2026-10-05/README.md). The native XCTest host compiled, and Metro bundled/rendered the real app. Native Recommendations tour did **not** pass; final harness corrections remain unrerun. No new phone layout acceptance or signed/physical build is claimed.

## Release/activation gates and observed remaining gaps

1. Run the corrected phone tour at normal and enlarged German text; verify owner navigation, recap read/delete, settings, keyboard/time picker and account/server switch on device. Test review/preview/accept/decline and offline reconnect through real owner sessions.
2. With one opted-in test owner, authorize read/propose in normal ChatGPT, bind protocol 2, run a no-change and a proposal review, then verify a real unattended cloud task using that exact account/workspace. Task/plugin availability and the ten-minute leased review budget are not proven by local fixtures. Do not install an automatic Mac/API fallback or advertise the schedule as working until this succeeds.
3. Verify Engagement v3 digest with quiet hours, already-read recaps, pending suggestions, duplicate device handoff and the one-attempt daily cap on signed phone/Watch. Existing settings/actions do not establish physical notification receipt.
4. Monthly/yearly aggregates initially provide honest monthly counts plus core energy/activity/sleep/weight metrics. Supplement nutrient totals, full historical goal baselines and automatic explanation of causation are excluded; expand aggregates only after review evidence identifies useful missing metrics.
5. Validate rich/long recaps and an actual connected agent in native/web UI. Complete schema-sync review after merge. Existing chunk-size/knip hints are nonblocking. No production/TestFlight action is part of this implementation turn.

MCP Events, automatic medication/dose edits, autonomous approval and additional outboxes/schedulers are outside the approved scope. Owner recaps retain cited private evidence after connection revocation by design; explicit owner recap/account deletion is the erasure path.
