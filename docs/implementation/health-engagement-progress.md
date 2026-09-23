# Health engagement implementation progress

Branch: `feat/health-engagement` (from `feat/bls4-food-source` at `20856c231`). This is local development; no production deployment or real health-plan changes are part of this work.

## Integration map and ownership

| Concern | Current owner | Engagement boundary |
| --- | --- | --- |
| Food/photo capture, completion, offline retry | `nutritionActionOutbox`, `nutritionActionSync`, capture APIs, diary projections | Read effective local/server state; never create a second action store |
| Food operation identity | nullable `client_operation_id`, scoped unique on server | Preserve original operation ID on retries |
| Medication plans and reminders | `MedicationReminderReconciler`, `medicationReminderService`, `medicationNotificationHandler` | Existing scheduler remains the scheduled-intake owner; its response handler is online-only and needs a separate idempotent offline intake contract before direct offline actions |
| Water reminders | `HydrationReminderReconciler` / `useHydrationReminder` | Existing water scheduler remains owner until explicitly transferred; it currently depends on server-derived totals |
| iOS Home widgets | `useWidgetSync`, app-group `ExtensionStorage`, `targets/widget` | Add a minimal versioned nutrition status snapshot; never expose notes/photos/credentials |
| Workout Live Activity | `expo-widgets`, `workoutLiveActivity.ios.ts`, `WorkoutLiveActivityLayout.tsx` | Reuse the same supported ActivityKit/Expo target mechanism for an explicit bounded wellbeing session; do not touch workout activities |
| Watch | `modules/watch-connectivity`, `useWatchCheckInBridge`, `targets/watch` | Current check-in transport is not a generic nutrition/water/medication action protocol |

The installed mobile stack is Expo SDK 57 / React Native 0.86; maintained native sources are `targets/`, `plugins/`, `app.config.ts`, and app code. Generated `ios/` and `android/` are not edited. `expo-notifications` is the existing local-notification adapter. Native build and physical-device validation remain separate gates.

## Contracts and staged approach

`HealthEngagementCoordinator` should derive domain-specific effective state, then pass small candidates through a deterministic, clock-injected discretionary policy. Candidate identity, domain record/occurrence identity, prompt identity, and action operation identity stay separate. Medication schedules are reserved, not arbitrated as optional wellbeing prompts. Hydration stays with its existing scheduler until its offline projection and action contract are ready. All new notifications use a feature-owned identifier namespace; never cancel another family's requests.

The first vertical slice is an opt-in meal-window reminder. Local photo actions count as capture immediately; completion and sync remain independent. A small iOS widget snapshot shows food-record count and incomplete photos without exposing food names or images, with account/day scope and freshness. The app-scope coordinator reads the existing nutrition outbox; local saves drive reminder and widget reconciliation. The photo action itself is already durable before network work. The first enabled window is an editable example (11:00–14:00, reminder at 12:30), not an inferred personal routine. The setting defaults off.

A separate persisted `movementBreak` session is presentation state only. An explicit 2-, 5-, or 10-minute start requests a Live Activity on iOS. The session is scoped to the active account/server, adopted on relaunch only when the matching ActivityKit instance exists, and never recreated after dismissal. `staleDate` marks suspended-app content stale; app foreground/active-JS expiry reconciliation sends the actual end request. The timer never records movement. There is no all-day activity or push update infrastructure.

## Dependency and blocker report

- Existing medication notification actions call the API directly. They cannot honestly be labelled offline-safe; changing them requires a scoped server operation ID and a local action extension with occurrence validation.
- Water intake has server aggregation semantics and a distinct existing scheduler. Direct offline volume actions require extending the established action/ingest path without double counting.
- The Watch bridge handles check-ins and selected quick logs, but no universal typed response contract. Extension actions must be introduced through its existing transport.
- Widget reloads and local notification delivery are OS-controlled. A successfully written snapshot/request does not prove a widget was viewed or a notification delivered.
- The current nutrition state counts grouped logged meals, standalone food records, and photos. It does not claim these are all eating events or infer that a missing record means a missed meal.
- The nutrition reminder is capped at one selected window, but the existing water reminder owner has not yet been migrated into a combined discretionary budget. Do not present the settings as all-domain coordination.
- The development Expo config lacks `ios.appleTeamId`; the simulator target built without signing, while physical-device provisioning remains unverified for this branch.
- ActivityKit has a maintained `expo-widgets` route and an existing workout Live Activity, so a separate bounded wellbeing activity is feasible without editing generated native projects. Entitlement/build/device checks are still required.

## Stage checklist and evidence

| Stage | State | Evidence / remaining gate |
| --- | --- | --- |
| 0 Audit | Completed | Source inventory above; package instructions and official SDK docs reviewed |
| 1 Shared state | Partial | Nutrition effective-state projection merges local and server records by stable IDs. Supplement/hydration/movement record projections pending |
| 2 Policy and scheduler ownership | Partial | Pure candidate/arbitration functions and serialized namespaced nutrition scheduler; existing medication and hydration owners unchanged |
| 3 Settings and combined budgets | Partial | Editable opt-in one-window meal setting. All-domain combined budget/preview pending |
| 4 Native responses | Partial | Capture notification action opens the existing camera route after account-scope validation and logs no intake; cold-launch device proof pending |
| 5 Nutrition reminder → widget | Partial | Versioned Home/Lock widget snapshot and native target compile; end-to-end airplane-mode reminder flow pending |
| 6 Hydration | Pending | Offline water contract/aggregation gate |
| 7 Planned supplements | Pending | Offline occurrence action and server idempotency gate |
| 8 Movement | Partial | Explicit local timer/session only; scheduled prompts and self-report contract pending |
| 9 Routine/Lock widgets | Partial | Nutrition status widget supports Home small/medium and privacy-minimal Lock accessory families; routine widget pending |
| 10 Live Activity | Partial | Movement-break compact/minimal/expanded/Lock presentation and lifecycle implemented; simulator/device presentation proof pending |
| 11 Watch | Pending | Transport/action extension gate |
| 12 Privacy/accessibility | Pending | Review each native surface |
| 13 Integrated hardening | Pending | Physical-device scenarios A–G not yet executed |

## Scope discipline

No other application owns nutrition. No second outbox, backend, AI service, or HealthKit writeback is introduced. Missing records remain unknown; finishing a presentation session never logs a domain action. The action outbox is untouched by the presentation-session store.

## Validation to date

- Mobile TypeScript typecheck, normal lint, React Compiler lint, i18n audit/generate check, native locale check, and Prettier check: passed after this change.
- Full mobile Jest suite: 454 suites and 7,037 tests passed. Targeted response-handling tests passed after the final notification changes; iOS export and simulator build passed after the Live Activity changes.
- `npx expo prebuild --clean --platform ios --no-install`, `pod install`, iOS Metro export, and Xcode simulator `CalorieTracker` scheme build: passed. Generated native output remains ignored, not committed.
- Physical iPhone was unavailable to Xcode during this task. No notification delivery, widget redraw, or Live Activity presentation on a physical device has been claimed.

Platform behavior was checked against the installed Expo SDK 57 notification API and Apple’s [ActivityKit lifecycle](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities) and [WidgetKit refresh guidance](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date). Scheduling and reload requests are not guarantees of delivery or immediate redraw. `staleDate` is not an ActivityKit end request; an expired timer can remain visible until the app next executes its reconciliation.

## Disable, upgrade, and rollback

Turning the meal reminder off causes its app-scope reconciler to cancel only `engagement:nutrition:` requests; the stored photo/food records remain. Finishing a break ends only the session and its Live Activity. The existing medication and hydration owners are unaffected. The new preference keys use the existing shallow default merge, so older preference blobs load with the reminder off. The session and widget snapshots are versioned; unreadable sessions surface an error rather than being treated as movement records.

Before downgrading to a build without this feature, turn the meal reminder off in the new build while it is running so its owned requests are cancelled. An old build does not know that namespace and cannot clean it up. A downgrade ignores the new local session and widget snapshot; it does not roll back any server schema because this slice added none.

The immediate next slice is migration of the existing hydration scheduler into the shared optional-prompt budget, paired with a durable water-action contract. The medication notification buttons remain online-only until their schedule-occurrence identity and offline idempotency are established. Watch action expansion follows those contracts rather than inventing another transport.
