# Bidirectional live strength-workout tracking

**Status:** Planned; this document does not implement or release the feature.  
**Recorded:** 2026-09-23.  
**Target:** SparkyFitness mobile application, native iOS/watchOS integration, shared contracts, and narrowly scoped server support.  
**Repository baseline:** [`carhartt21/SparkyFitness@3c84e8007fb4f2541c58238ec71a2dcbb7d458a4`](https://github.com/carhartt21/SparkyFitness/tree/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4).

## 1. Decision and product objective

Build **two interfaces to one ongoing strength-training session**. The iPhone and Apple Watch must both support entering weight and repetitions, adding/removing/editing sets, completing or reopening sets, and controlling rest periods. Changes should appear promptly on the other device when communication is available. Recording must remain possible during temporary disconnection and server outages.

HEVY-style live editing is a workflow reference, not a claim of complete HEVY parity, an integration requirement, or permission to copy another application's implementation, assets, or branding.

SparkyFitness remains the product and backend. Reuse its existing workout domain and native Watch infrastructure. Do not restart HealthIntel, build a separate Watch diary that is imported only after finishing, or route every in-gym edit through the production server.

**Priority:** Complete live set editing and recovery before optional engagement personalization, cosmetic redesigns, or new workout analytics. Preserve the existing nutrition, supplements, hydration, movement reminders, and workout features.

## 2. Evidence and implementation boundary

The source observations below were checked against the repository baseline. They are not a claim about an installed phone build, a deployed server, or uncommitted local work. Re-audit the actual implementation branch before coding; the earlier upstream assessment used a different revision.

| Existing foundation | Evidence | Consequence for implementation |
| --- | --- | --- |
| Persisted active-session snapshot, completion maps, rest state, unsaved-change flag, and prior/planned values | [Active workout store][source-store], particularly its state declarations | Extend the existing session model; do not create an unrelated workout tracker. |
| Weight/repetition edits, add/delete sets, complete/undo, rest controls, and exercise/superset operations | [Active workout actions][source-actions] | Adapt these behaviors to typed operations available from both devices. |
| Newly added sets can use negative temporary IDs; server autosave can replace them; render keys are maintained separately | [Set identity and autosave comments][source-store] and [reconciliation contract][source-actions] | Introduce stable logical set identities before multi-device editing. Array positions and transient render keys are not synchronization identities. |
| The inspected live-start flow creates a server session before entering the active workout and strips planned values into placeholders | [Live-start implementation][source-start] | Continuing an existing session offline and starting a new session offline are distinct milestones. |
| Native Watch navigation currently exposes goals, water, measurements, and trends | [Watch ContentView][source-watch-ui] | Add a workout experience without replacing existing Watch screens. |
| WatchConnectivity activation, immediate messaging, queued transfer, and retry infrastructure already exist | [WatchSessionManager][source-watch-transport] | Reuse transport ownership, but add durable workout acknowledgements and replay semantics rather than assuming existing handlers provide them. |

The current store also documents account/server-related context and positional autosave reconciliation. Both must be reviewed for multi-device safety. Existing comments or a persisted Zustand snapshot alone do not prove that an action survives a kill immediately after the UI reports success.

This plan is a proposed design. HealthKit mirroring, native background reception, conflict recovery, and device latency remain acceptance gates until tested.

## 3. Scope and first usable release

The first usable release must support all of the following on an already established shared session:

| Interaction | Required result |
| --- | --- |
| Start a routine on iPhone | Watch can join the same session; denied permissions or failed handoff are visible without losing the phone session. |
| Edit weight or repetitions on either device | The edit is durably accepted locally, then reflected on the peer without manual refresh when reachable. |
| Add a set on either device | Both devices retain one new set with the same logical identity. |
| Delete a set on either device | Deletion converges, respects existing last-set/exercise behavior, and cannot be undone by a stale snapshot. |
| Edit a previous or completed set | The correct set is updated without silently advancing the active cursor. |
| Complete or undo a set | Completion, adopted actual values, and relevant rest transition stay consistent. |
| Pause, extend, resume, or skip rest | Both devices render the same logical rest instance. |
| Lose connectivity temporarily | Recording continues locally; status distinguishes peer synchronization from server backup. |
| Finish on either device | Recording can stop locally; finalization preserves outstanding peer edits and produces one logical saved workout. |

A display-only Watch screen with a single Complete button is insufficient. Add/remove/edit sets belongs in the first release, not a distant enhancement.

### Subsequent scope

Starting an entirely new workout from a cached Watch routine with both phone and server unavailable is a later, explicit milestone. Preserve protocol compatibility with that goal from the beginning.

Initially defer full Watch exercise-catalogue search, training-program generation, historical HEVY migration, social functionality, and concurrent web editing of a live mobile session. Phone-side exercise changes must still project correctly to Watch, and unsupported concurrent writers must not silently overwrite active-session data.

## 4. Architectural approach

```text
Watch SwiftUI workout UI                    iPhone workout UI
         |                                         |
Durable local operations                    Durable local operations
+ local session projection                  + local session projection
         |                                         |
         +-------- Direct peer exchange -----------+
                  Same versioned protocol
                  Durable acknowledgements
                                                   |
                                        Existing server sync adapter
                                                   |
                                          SparkyFitness API / DB
```

Separate three responsibilities:

1. **Strength log:** exercises, sets, actual values, completion, notes, and revisions.
2. **Apple workout lifecycle:** start/pause/end, authorized physiological metrics, and a single HealthKit writer.
3. **Server persistence:** eventual durable backup and history in SparkyFitness.

The preferred Apple approach is to evaluate HealthKit workout-session mirroring for the live lifecycle and bounded session data exchange, while extending existing WatchConnectivity infrastructure for cached routines, handoff, and delayed reconciliation. Both transports must carry the same protocol and deduplicate the same operation IDs. Do not create two competing sources of workout truth.

Validate availability, entitlements, installed SDK compatibility, actual reachability, and background behavior against Apple's official material in [Platform references](#15-platform-references). Do not automatically raise deployment targets or assume mirroring solves application-level set synchronization.

Native iPhone reception must durably retain incoming operations before acknowledging acceptance when React Native is unavailable. Mounting a screen or running a JavaScript timer must not be required to prevent data loss. A native ingress journal is a boundary adapter to the shared action system, not a second independent server-sync engine.

### Offline guarantee levels

- **No internet, devices reachable:** direct editing continues; server synchronization waits.
- **Peer unreachable:** each device records locally and reports pending peer synchronization.
- **App suspended:** updates are subject to supported native lifecycle execution; no promise of continuous JavaScript.
- **App terminated or device restarted:** durable accepted records remain recoverable; transport/lifecycle resumption is explicitly verified rather than assumed.
- **No phone at session start:** supported only after the cached-routine/local-start milestone.

Distinguish `saved locally`, `received by peer`, `applied/converged`, `saved to server`, and `needs review`. A transport callback or lack of an error is not a server-save acknowledgement.

## 5. Stable identities, operations, and server compatibility

### Logical identities

Use durable client-generated identifiers for the workout, exercise occurrence, set, operation, and rest instance. Keep existing server IDs as mappings where required; do not change every database primary key merely to achieve stable identity.

An exercise occurrence is distinct from a reusable exercise definition. Two appearances of the same exercise in a session are not the same editable occurrence. A set identity must survive reorder, rest changes, autosave, restart, and server-ID assignment.

Retain positional order separately, with deterministic insertion anchors/order keys. Concurrent insertions at the same location must have a documented stable tie-break. Never target an edit by displayed row number.

### Operation envelope

A conceptual envelope contains:

```text
schemaVersion
operationId
sessionId
accountAndServerScope
authorDeviceId
authorSequence
baseRevision / causalDependencies
operationType
targetEntityId
payload
occurredAt
```

Exact types must follow existing shared schema conventions. Wall-clock timestamps preserve history but must not be the sole conflict-ordering authority. Carry bounded payloads; keep credentials and unnecessary physiological data out of peer messages.

Initial operations should cover explicit field updates, add/delete set, set completion, rest changes, finish requests, and conflict resolution. Completion should be `SetCompletion(true/false, ...)`, not a replay-unsafe toggle. Prefer a completion transaction that binds confirmed/adopted weight and reps to that completion and rest transition.

A stale Complete notification must target the intended set and expected session/rest revision, not whichever set happens to be active when its handler runs.

### Durable acceptance and acknowledgements

Persist an operation before reporting success. On receipt, deduplicate and persist the operation and acceptance metadata before acknowledging it. Keep transport acceptance distinct from application success or a pending conflict.

Support duplicate, delayed, reordered, and interrupted delivery. Hold operations whose referenced set creation or revision has not arrived yet; request missing context rather than dropping them. Retry the same action under the same ID, but give distinct deliberate edits distinct IDs.

Latest-state snapshots can accelerate recovery, but must include a covered-operation/revision watermark. Replacing an application-context snapshot must not discard unapplied edits. Compact journals only after a validated checkpoint and an explicit acknowledgement/retention policy; do not keep a fire-and-forget queue as the sole copy.

### Authority and conflicts

Use one convergent logical session, not two snapshots with arbitrary last-writer-wins replacement. The phone is the default server-upload coordinator, but not an unconditional winner over Watch edits. Watch can be the primary Apple workout recorder without becoming the only editable strength log.

| Case | Proposed resolution |
| --- | --- |
| Different sets edited | Merge both. |
| Independent fields of the same set edited | Merge field patches if their preconditions and completion semantics remain valid. |
| Concurrent conflicting edits to the same field | Preserve alternatives, flag the conflict, and request explicit resolution. Do not silently choose by device timestamp. |
| Duplicate operation delivered by both transports | Apply once and return the prior acknowledgement/result. |
| Set deleted before a delayed edit arrives | Preserve a deletion tombstone; do not resurrect. Retain a conflicting edit for review when necessary. |
| Concurrent insertions or reorder | Use stable identities and deterministic ordering; flag incompatible structural edits rather than guessing. |
| Completion/undo races | Preserve causal ordering or flag a conflict; do not toggle blindly or double-advance rest. |
| Server response predates newer local edits | Retain the newer projection and merge ID/revision acknowledgements, not the stale whole session. |
| Two independent sessions are started | Keep separate identities and offer an explicit join/resume/discard decision. Never merge by date or routine name. |

Conflict state should not block unrelated set logging. Resolution itself is a durable operation referencing the competing revisions, preventing a late message from silently restoring the conflict.

### Server boundary

Extend route -> service -> repository layering and shared schemas rather than bypassing authorization or writing directly from native extensions. Inspect existing exercise/preset session endpoints and autosave before choosing a batch or mutation endpoint.

Require user-scoped idempotency and correct ownership validation. Reusing an operation ID with different payload content must produce a clear conflict, not an incorrect success. Store accepted results transactionally with their idempotency metadata.

Only one compatible write path should persist an active session at a time. Adapt existing whole-session autosave so it cannot overwrite newer peer operations. Use revision preconditions for legacy/web writers or reject stale writes explicitly.

Any migration must follow repository guidance for RLS, shared schemas, affected web/mobile contracts, documentation, and upgrade tests. Preserve existing history, Android behavior, cookie/API-key authentication, and client compatibility. Do not regenerate the schema backup locally when repository policy delegates that to CI.

## 6. Watch interaction design

Use a focused set-entry screen, with values below strictly illustrative:

```text
Bench Press
Set 3 of 4

Weight             Reps
80.0 kg              8

[ Complete set ]
Previous: 80 kg x 8

[ Sets ]          [ More ]
```

Allow selection of weight or repetitions, Digital Crown entry, and clear step controls. Make increments configurable and preserve canonical metric storage with explicit kg/lb display conversion. Reuse existing conventions for bodyweight, assisted movements, timed sets, and set types; do not force unsupported modalities into weight/repetition fields or treat a legitimate zero load as missing.

Provide an accessible set list supporting add, edit, delete, complete, and undo, including earlier sets. Use clear confirmation/undo for destructive operations. Preserve existing semantics when deleting an exercise's final set and make the consequence visible.

Keep planned/previous values visually distinct from actual performed values. Completing a set can explicitly adopt the currently shown suggestion, following the phone's rules; merely displaying a routine records no work.

A device's browsing position is local UI state. Changing screens on Watch must not unexpectedly scroll the phone. Synchronize the logical active set/rest cursor, with an optional follow-current-set behavior, rather than synchronizing every navigation event.

Avoid rebroadcasting every transient input digit. Keep editable drafts distinct from committed operations, with explicit or safe debounced commit boundaries. A success indicator must reflect durable acceptance, not an in-memory optimistic update alone.

Support VoiceOver, readable controls, contrast, reduced motion, locale formatting, dark/reduced-luminance states, and an explicit pending/conflict indicator. Do not crowd the Watch with full provider search or analytics.

## 7. Rest timer, lifecycle, and finalization

### Rest synchronization

Reuse absolute deadlines and paused remainder rather than sending a countdown every second. Include rest-instance identity and revision so stale extend/skip/pause messages cannot resurrect a prior break. Use monotonic local elapsed-time handling and a documented clock-skew approach; test wall-clock changes and peer clock differences.

Completing a set should establish its corresponding rest transition atomically in the logical operation model. Rest expiry is not evidence that another set was performed. Editing a completed set must not accidentally start a second timer.

During a Watch-led workout, prefer the Watch as the rest haptic authority. Define a phone fallback when applicable, cancel obsolete owned reminders, and prevent repeated callbacks from producing duplicate cues. Do not promise perfect cross-device suppression while the devices cannot communicate.

### Session ending

Model recording lifecycle and synchronization independently, for example:

```text
recording / paused -> ended locally -> reconciling -> finalized
                                        -> needs review
```

Stopping workout recording must remain possible without internet or a reachable peer. Do not keep collecting workout metrics merely because set reconciliation is pending.

An end operation preserves the original end time and known operation watermark. Drain/reconcile peer edits before claiming a fully reconciled final result. If the peer is unavailable, retain an explicit pending state and recovery path. Late edits should amend or require review of the same session, not create a duplicate or restart its Apple workout. Edits reported as performed after the end time need explicit review.

Distinguish finish, cancel/discard, and correct-history. Do not erase unacknowledged edits when a user closes a screen or ends a Live Activity.

## 8. HealthKit, native execution, and data ownership

For authorized Watch-led physiological recording, evaluate `HKWorkoutSession` with `HKLiveWorkoutBuilder` and mirrored phone sessions. Keep set/repetition truth in the SparkyFitness domain; HealthKit does not become the set database.

Designate a single HealthKit writer for the paired session. Record the logical workout ID and HealthKit sample association. The mirrored phone must not independently publish a duplicate workout. Reconcile the later Apple Health import with the existing SparkyFitness session and explicitly choose metric provenance; do not double-count duration or energy from estimated and measured sources.

The strength log must remain usable if optional heart-rate/HealthKit access is denied, while accurately describing reduced sensor/mirroring capabilities. Starting sensor recording requires the appropriate explicit action and permissions. Never run a fake workout merely to obtain background execution.

Persist native ingress before acknowledging it when React Native is suspended. Verify lifecycle recovery using the actual supported APIs, OS versions, and physical devices. Handle lock state, reboot, force-quit, battery loss, and activation races as distinct cases. Do not promise uninterrupted mirroring when the OS or connectivity prevents it.

Account/server scope must bind every session and operation, not only routines with a source preset. On account switch, preserve pending data in its original scope, detach live surfaces safely, and prevent old actions from entering the new account. Follow existing storage protection conventions and use an unlock fallback rather than weakening protection.

## 9. Integration with engagement and Live Activities

Extend the existing workout HUD, rest actions, and workout Live Activity using the same session identity. Do not create a competing generic wellbeing session that independently tracks set progress.

Display current exercise/set, elapsed workout time, rest countdown, and a direct route to the active workout where supported. A native Complete action must identify the intended set and revision. Closing the presentation is not finishing or discarding the workout unless explicitly chosen through the workout flow.

While a workout is active, the health-engagement coordinator should suppress redundant discretionary standing/movement-break prompts. Hydration remains a convenient explicit action, not another mandatory timer competing with rest alerts. Preserve planned supplement/medication reminder policies.

Do not create a new global notification scheduler or replace existing Watch transport. Make behavior robust when the broader engagement work is not yet implemented: expose a narrow active-workout signal and feature-detect integration points.

## 10. Staged implementation and exit gates

All stages below are **not started by this documentation change**. Update status only with evidence from the actual implementation branch. A simulator proof or documented API is not a physical-device pass.

| Stage | Deliverable | Exit gate |
| --- | --- | --- |
| 0. Baseline and native feasibility audit | Record source revision, SDK/OS support, current outbox/autosave/native target behavior, scope, and source-to-module map. | Known blockers and compatibility decisions recorded; no assumptions about uncommitted or deployed work. |
| 1. Identity and protocol foundation | Stable logical entity IDs, typed operations, durable acceptance/acks, conflict rules, and server/legacy-write compatibility. | Duplicate and reordered replay converges; edits do not depend on server-assigned IDs or list positions. |
| 2. Physical-device vertical slice | Join one phone-started session and edit one set in both directions through native reception. | Verified on a paired iPhone/Watch, including phone backgrounding and no internet. Measure local-save and peer-update latency. |
| 3. Full Watch set editing | Weight/reps, add/remove/edit sets, complete/undo, prior/planned values, set list, and shared rest controls. | Every required set action works on either device without manual refresh while reachable. |
| 4. Disconnection and recovery | Durable peer queues, missing-operation recovery, conflict UI, account scoping, restart, and server outage behavior. | Acceptance scenarios below pass without silent loss, duplicate sets, or resurrection. |
| 5. Lifecycle and integration | Finish reconciliation, optional HealthKit single-writer recording, deduplication, workout Live Activity, and reminder coordination. | One logical completed session and at most one intended HealthKit workout; remaining peer edits remain recoverable. |
| 6. Independent Watch start | Cached routines and locally created sessions without phone or server, later ID mapping and reconciliation. | Start, complete, restart, and import one offline Watch session without duplicates. |
| 7. Release readiness | Migration/device evidence, regression verification, feature flags, recovery runbook, and limited rollout. | Explicit release decision based on the exact build; no automatic deployment or HEVY-history migration. |

An illustrative connected-path objective is a peer update within roughly one second after commit under healthy reachability, with local persistence never waiting for the peer or server. This is a measurement target, not a guarantee. Record p50/p95 and operating conditions; do not trade durability for a misleading fast success indicator.

## 11. Source map and engineering constraints

Use the baseline source links as starting points, then inspect current module guides and real consumers before editing.

| Area | Starting point / expected responsibility |
| --- | --- |
| Phone session behavior | `SparkyFitnessMobile/src/stores/activeWorkoutStore.ts`; adapt current actions instead of forking their semantics. |
| Start/autosave flows | `src/hooks/useStartLiveWorkout.ts` and `src/hooks/useActiveWorkoutAutosave.ts`; audit lifecycle, revision handling, and clearing of unsaved state. |
| Phone workout interface | Existing active-workout screen, set rows, HUD, notifications, and workout utilities. |
| Watch UI | `targets/watch/Presentation/ContentView.swift` and adjacent native views; keep existing pages. |
| Watch transport | `targets/watch/Infrastructure/WatchSessionManager.swift` plus its mappers/payload types; retain one `WCSession` owner. |
| Native iPhone ingress | Locate the existing phone Watch bridge, app lifecycle, App Groups, and maintained plugins before adding a journal adapter. |
| Shared contracts | Existing exercise/session schemas under `shared`; add versioned operation DTOs and cross-language fixtures. |
| Server | Existing exercise entry/preset session routes, services, repositories, and migrations. |
| Web/Android | Validate compatibility of changed contracts and protection against stale writers; no UI rewrite required. |

Keep changes in maintained native targets/config plugins, not only generated `ios/`/`android/` output. Reuse infrastructure from nutrition work only when it actually exists and fits the domain; never treat an earlier prompt as implemented code.

Use synthetic fixtures only. Do not publish workout histories, health exports, credentials, server addresses, or personal device identifiers. Respect project licensing and preserve notices. No production deployment, app-store upload, force push, destructive reset, or real-data migration is authorized by this plan.

Before implementation, follow the package `AGENTS.md` files, [plan review checklist](../../agent-docs/plan-review-checklist.md), and [migration checklist](../../agent-docs/new-migration-checklist.md). Update affected guides when implementation introduces a new protocol or table.

## 12. Validation and mandatory acceptance tests

### Automated coverage

- Reducer/contract fixtures: explicit operations, field conflicts, causal dependencies, stable identities, unknown versions, bounded payload validation, unit conversion, and null versus legitimate zero values.
- Persistence: kill between acceptance/projection/ack, native activation race, journal recovery, checkpoint coverage, protected-storage failure, out-of-order delivery, duplicate delivery through two transports, and old snapshots after new edits.
- Server: user-scoped idempotency, mismatched-payload reuse, authorization/RLS, atomic result persistence, revision preconditions, legacy/web compatibility, upgrades, and orphan-free deletion mapping.
- Workout semantics: planned versus actual values, completion/undo races, exercise occurrence identity, final-set deletion, supersets, reordering, cursor behavior, and cross-device rest actions.
- Lifecycle: ending while disconnected, late operations, single HealthKit writer, import deduplication, permission denial, account changes, device re-pairing, and unsupported capabilities.
- UI/accessibility: Crown entry, increments, unit labels, draft/commit behavior, destructive actions, conflict/pending states, localization, and existing phone/Watch feature regressions.

Use shared golden protocol/reducer fixtures for TypeScript and Swift where practical to prevent independently implemented semantics drifting. Keep tests of actual database uniqueness/authorization separate from mocked repository tests.

### A. Core two-device workflow

1. Start a routine on iPhone and join the same session on Watch.
2. Change weight and reps on Watch; confirm the phone reflects the edit.
3. Change another set on the phone; confirm Watch reflects it.
4. Add a set on Watch and delete a different set on phone.
5. Confirm matching stable identities and order after autosave.
6. Complete and undo sets from both devices; verify actual values and rest transitions.
7. Finish and verify one reconciled workout.

### B. Temporary disconnection

1. Establish a shared session, then make the peer unreachable.
2. Add/edit/complete sets on Watch while making nonconflicting phone edits.
3. Restart an app and verify durable local state.
4. Restore communication; deliver duplicate and reordered operations.
5. Verify convergence, one copy per set/action, and correct pending status.
6. Repeat with internet unavailable but devices reachable.

### C. Conflicts and structure

Edit the same field differently while disconnected; delete a set concurrently with a delayed edit; insert and reorder near the same position. Verify explicit review where required, no tombstone resurrection, and no positional application to another set. Resolve the conflict and replay stale messages to verify the resolution survives.

### D. Finalization and HealthKit

Stop recording from one device while the peer has pending edits. Verify local end remains possible, pending reconciliation stays visible, late edits preserve session identity, and no second workout is created. With authorization enabled, verify one intended HealthKit sample and no duplicate SparkyFitness import. Repeat with authorization denied.

### E. Native lifecycle and account isolation

Test phone backgrounded/locked, Watch app exit/relaunch, device restart, activation race, protected-storage unavailability, and account/server switch with pending operations. Record actual behavior rather than extrapolating from simulator tests. No old session may write into another account.

### F. Cached Watch start (later gate)

Transfer a routine, then make phone and server unavailable before starting. Start, edit, finish, and restart on Watch. Reconnect and verify one mapped session with original timestamps, performed sets, and no duplicate HealthKit record.

### Validation commands

Use the checked-out package scripts and repository guides. Expected starting commands are:

```sh
cd SparkyFitnessMobile
pnpm run validate
pnpm exec jest --watchman=false --runInBand

# For actual server changes, from SparkyFitnessServer:
pnpm run validate
pnpm test
```

Run affected shared/web consumers and native build/tests as required. Verify commands before execution; discover schemes and destinations instead of hardcoding a developer's device. Native target/config changes require the repository's documented regeneration/build procedure, with local changes preserved first.

A documentation-only commit does not require claiming application test results. The implementation report must distinguish automated tests, simulator tests, signed physical-device tests, and unverified gates.

## 13. Decision log and open implementation questions

| Decision | State |
| --- | --- |
| One logical session with editable phone and Watch interfaces | Required. |
| Add/remove/edit sets in the first usable release | Required. |
| Stable entity/operation identities and durable acceptance before acknowledgements | Required. |
| Direct peer exchange; server not on the critical path for in-session edits | Required. |
| HealthKit mirroring plus existing WatchConnectivity as complementary transports | Preferred; validate availability and background feasibility in stages 0-2. |
| Phone as default server uploader; Watch as primary Apple sensor recorder when enabled | Proposed default; final ownership/recovery behavior must be documented. |
| Conflict resolution preserves alternatives rather than clock-based silent overwrite | Required. |
| Independent Watch start | Explicit later milestone, not silently claimed in the first release. |
| Exact journal storage, sequence/watermark representation, and server endpoint shape | Select after current-branch audit; reuse suitable existing infrastructure. |
| Explicit confirmation/undo detail for deleting a final set or resolving an offline finish conflict | Settle in the UI implementation with regression tests. |
| Minimum supported Apple OS versions and fallback behavior | Verify against installed SDKs and physical devices before changing targets. |

## 14. Completion, rollout, and handover

Keep this feature behind an appropriate flag until the paired-device gates pass. Disable new session entry safely without dropping pending operations; rollback must preserve journal/schema compatibility. Do not downgrade to a build that cannot read accepted pending records without a recovery path.

Before daily-use replacement of an established workout logger, require the exact candidate build to pass the core editing, disconnection, and finalization tests. Avoid simultaneous HealthKit writeback from multiple test loggers unless duplicate handling is controlled.

The implementation handover must include completed/deferred stages, exact source/build versions, protocol and migration details, native integration points, automated and physical-device evidence, latency observations, remaining conflicts/limits, recovery procedures, and an explicit release recommendation. Documentation approval is not implementation or production-release approval.

## 15. Platform references

Verify these official references against the current deployment targets during implementation; they guide feasibility and are not evidence that this feature already works:

- [Build a multi-device workout app, WWDC23](https://developer.apple.com/videos/play/wwdc2023/10023/).
- [Build a workout app for Apple Watch, WWDC21](https://developer.apple.com/videos/play/wwdc2021/10009/).
- [HealthKit workout sessions](https://developer.apple.com/documentation/healthkit/hkworkoutsession).
- [HealthKit live workout builder](https://developer.apple.com/documentation/healthkit/hkliveworkoutbuilder).
- [WatchConnectivity](https://developer.apple.com/documentation/watchconnectivity).
- [ActivityKit](https://developer.apple.com/documentation/activitykit).

[source-store]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessMobile/src/stores/activeWorkoutStore.ts#L123-L209
[source-actions]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessMobile/src/stores/activeWorkoutStore.ts#L260-L385
[source-start]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessMobile/src/hooks/useStartLiveWorkout.ts#L102-L200
[source-watch-ui]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessMobile/targets/watch/Presentation/ContentView.swift#L1-L115
[source-watch-transport]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessMobile/targets/watch/Infrastructure/WatchSessionManager.swift#L1-L129
