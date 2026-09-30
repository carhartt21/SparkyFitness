# Notification, widget guidance and mobility corrective batch

Date: 2026-09-30. Branch: `feat/notification-mobility-corrective-20260930`.

The [post-review correction record](notification-mobility-review-corrections-2026-09-30.md) supersedes the original read-path and reminder-invalidation behavior and records full-package validation.
Base: `10286a29a` (German BLS display fix). Implementation is prepared for review; no production deployment, merge or mobile publication was performed.

## Findings and corrections

| Priority | Verified finding                                                                                                                                                                      | Correction and evidence                                                                                                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1       | Account push configuration lacked the configured check-in, habit and weigh-in subjects. A common optional-reminder budget could also suppress other reminders without explaining why. | Version 2 derives eight reminder kinds from real account-local schedules and unresolved subjects. Settings show the cap, quiet hours, spacing, registration problems and next eligibility. Policy and real database tests cover suppression and stable slots. This does not establish why a particular earlier physical notification was absent. |
| P1       | Local scheduling and remote delivery ownership were insufficiently explicit. Turning off one phone must not turn off other devices.                                                   | Phone-owned handoff registers locally, cancels optional local schedules, enables account delivery, then confirms remote ownership. A persisted device-off request retries on reconnect. Account and device controls are separate.                                                                                                                |
| P1       | Medication notification copy could remain scheduled in an older language, and the locale fingerprint collapsed German into English.                                                   | Actual resolved locale and copy revision refresh pending medication alerts. Reviewed German notification/action text and stronger fragment checks cover mixed copy. A German language-change regression passes.                                                                                                                                  |
| P1       | Guided mobility was phone-local while remotely configured reminders needed stable planned subjects.                                                                                   | Owner-only server routines, schedules, dated plans and immutable session snapshots; existing local runner/history import without changing IDs; revisioned idempotent sync and explicit conflict resolution. MCP manual results cannot overwrite an active phone session.                                                                         |
| P2       | Widget placement, Live Activity authorization and Watch support were not explained together.                                                                                          | Settings → Widgets & Live Activities provides placement steps, native authorization status and system-settings access. Existing Watch circular energy/water complications are documented honestly; this batch adds no Watch layout.                                                                                                              |
| P2       | Enlarged German header text collided with the back control in the first review capture.                                                                                               | Shared custom-header title reserves side space and caps its font multiplier at 1.4; body text retains scaling. Confirmation captures show the correction.                                                                                                                                                                                        |

## Behavior and compatibility

- Optional reminders support a daily cap from **1–50**, or **No limit** (`null`). Existing default remains three. Unlimited still respects quiet hours, 20-minute spacing, cadence, subject completion and duplicate suppression. Medication and rest-timer alerts remain separate.
- Check-ins, habits, weighing, meal capture/review, water, movement breaks and mobility use actual configured times and account time zone. Completed/skipped subjects suppress prompts. Missing required data produces an unavailable diagnostic rather than an invented missing activity.
- Provider acceptance and push-service receipt are displayed separately from physical presentation. Unknown send results are not automatically replayed. Focus and notification summaries remain outside server control.
- Version 1 contracts retain their strict projection. Version 2 settings expose schedule configuration, capabilities, delivery ownership and diagnostics. First mobile synchronization imports actual local scheduling preferences once using `schedule_initialized`; it does not repeatedly overwrite server edits.
- A phone master switch retires that installation. The account delivery switch affects remote optional reminders. Remote delivery needs a registered compatible phone; web does not silently claim it has established the phone handoff.
- Mobility library edits use owner-only access. Recurring plans are materialized once per account-local day; unstarted future generated plans can be regenerated while active/historical snapshots remain unchanged. Dated manual plans and recurrence are separate.
- The mobile store retains its existing account-scoped persistence and local timer, plus stable operation IDs and revisioned synchronization. Lost responses retry the same operation; conflicts preserve the local copy until explicitly resolved. Default phone snapshots retain the latest 100 sessions regardless of age; explicit web date ranges filter history. Offline execution remains available, but server planning/sync needs a connection.
- Web `/mobility` edits routines with ordered custom or existing-library exercises, schedules and dated plans, and reads session outcomes. Unreported manual outcomes remain unknown. New-plan draft IDs survive a failed request to prevent duplicates on retry.
- MCP `xot_get_mobility` is read-only. `xot_update_mobility` uses the existing write-scope and active-consent requirements. Manual completion/skip is allowed only for an unstarted planned session. Mobility completion does not create exercise calories or HealthKit writes.
- Native bundle IDs, URL schemes, app groups, authentication configuration and historical data identifiers were preserved. The optional native module reports Live Activity authorization; older binaries show unknown until rebuilt.

## Changed surfaces and source map

| Area                    | Main files                                                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contracts/policy | `shared/src/schemas/api/{Engagement,Mobility}.api.zod.ts`, `shared/src/schemas/database/{Engagement,Mobility}.zod.ts`, `shared/src/engagement/policy.ts`, `shared/src/mobility/planning.ts`                                                                                                             |
| Server delivery         | `XoTServer/services/engagement{Service,PlanningService,DeliveryService,Policy}.ts`, `routes/v2/engagementRoutes.ts`, `models/dailyTrackingRepository.ts`                                                                                                                                                |
| Server mobility/MCP     | `models/mobilityRepository.ts`, `services/mobilityService.ts`, `routes/v2/mobilityRoutes.ts`, `ai/tools/mobilityTools.ts`, `routes/chatgptMcpRoutes.ts`                                                                                                                                                 |
| Mobile scheduling/sync  | `XoTMobile/src/services/{remoteEngagement,remoteEngagementActions,mobilityRoutineStore,mobilityEngagementReminders,healthEngagementPolicy,medicationReminderService,engagementReminderScheduler,discretionaryPromptLedger}.ts`, existing coordinator/reconciler, hydration utility and preference store |
| Mobile UI/native        | `screens/{NotificationSettingsScreen,WidgetGuideScreen,GuidedMobilityScreen,LibraryScreen}.tsx`, `hooks/useScreenHeader.tsx`, navigation registrations, `modules/presentation-capabilities/`                                                                                                            |
| Web                     | `XoTFrontend/src/pages/Settings/NotificationDeliverySettings.tsx`, `pages/Exercises/Mobility.tsx`, existing Engagement API/hook and new Mobility API/hook, shared navigation                                                                                                                            |
| Localization            | English source catalogs, reviewed `localization-overrides/de/{mobile,web}.json`, generated German catalogs, static notification label map, fragment audit                                                                                                                                               |
| Review/documentation    | Mobile review fixture, native notification tour, nearby regression tests, package guides and database/sharing documentation                                                                                                                                                                             |

Navigation registration files were also formatted with the package formatter; their larger diffs include formatting of existing registrations.

## Migration checklist and rollout requirements

All eight repository migration checklist steps were completed:

1. Added `20260930100000_mobility_planning.sql` and `20260930101000_engagement_v2.sql` through the existing migration mechanism.
2. Added owner-only RLS for routines, schedules, plans, sessions, operation receipts and movement-start hints. Delegated/unrelated access is tested.
3. Booted the isolated visual-sample server: migrations and RLS applied successfully to its disposable database. Production was not modified.
4. Left `db_schema_backup.sql` untouched. CI's post-merge schema-sync workflow remains responsible for the snapshot.
5. Added/exported database and API Zod schemas. Routes consume the shared request contracts directly; no alternate contract is maintained.
6. Updated database index, security tiers, sharing docs and root/package guides.
7. Updated server, web, mobile and MCP consumers, including v1 compatibility.
8. Ran server typecheck/lint/format, nearby tests, isolated persistence/RLS tests, consuming-package checks and native simulator build.

For a separately authorized release: deploy the compatible server/migrations before the new clients. Existing v1 clients continue working. Build the mobile binary through the usual runbook to include the new native capability module; do not treat a JavaScript-only update as a native capability upgrade. Confirm device registration/ownership and inspect delivery diagnostics after upgrading. Migration adds the subject-slot unique index, schedule/day uniqueness, active-plan uniqueness and owner lookup indexes through SQL; no manual live-catalogue replacement or credential change is required.

## Verification

Package `validate` wrapper commands were not used because pnpm was unavailable. Their constituent checks were run with installed package-local binaries.

| Check                             | Actual result                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server regression tests           | 7 suites, **87 tests passed**: engagement policies, tool registry, MCP routes/read-only scope/authentication/connections. Non-demo environment used for MCP body-limit checks.                                                                                                                                                                                                     |
| Disposable PostgreSQL integration | **10 tests passed**: persisted original IDs, duplicate receipts, CAS, owner-only RLS, recurring snapshots, active-session protection, manual outcomes, imported reminder edits, old-history retention, v1/v2 settings, per-device disable, timer hints, slots/caps and completion suppression. Guarded to localhost:55432 disposable DB.                                           |
| Mobile regressions                | 16 suites, **197 tests passed**: settings, sync/remote handoff, local runner, reminder policies/actions, hydration, medication scheduling/reservations, budget ledger, review fixtures, locale pipeline/copy and shared headers.                                                                                                                                                   |
| Web regressions                   | 6 suites, **47 tests passed**: Settings, identity/localization, dashboard and widget layout contracts.                                                                                                                                                                                                                                                                             |
| Typecheck                         | Server and mobile `tsc --noEmit`; web `tsc -b`: passed.                                                                                                                                                                                                                                                                                                                            |
| Lint and formatting               | Full package ESLint with zero warnings and Prettier checks: passed in server, mobile and web.                                                                                                                                                                                                                                                                                      |
| Localization                      | Overlay check, German fragment/formality check, generated resources, native widget locales and mobile audit: passed. Mobile audit has zero missing static keys, missing fallbacks, dynamic keys, placeholder or hardcoded UI findings. Existing other-language coverage gaps remain reported, not presented as complete. German catalog includes seven existing stale unused keys. |
| Repository/dead-code checks       | Repository layout check and frontend/mobile Knip: passed; existing non-blocking Knip configuration hints remain.                                                                                                                                                                                                                                                                   |
| Web production build              | Vite/PWA build passed.                                                                                                                                                                                                                                                                                                                                                             |
| Native build                      | iOS Simulator Debug scheme `XonTrack` built successfully, including the local native module and companion targets. No signed physical/TestFlight build was performed.                                                                                                                                                                                                              |
| Mobile rendered review            | German dark, 390×844 normal and 430×932 enlarged text: render smoke and native notification-guide interactions passed in both cases. Review correction and confirmation captured.                                                                                                                                                                                                  |
| Web rendered review               | German notification settings and mobility, 1280×800 and 390×844: no horizontal overflow and no browser/runtime errors. Isolated synthetic account only.                                                                                                                                                                                                                            |

Native build command used:

```sh
xcodebuild -workspace ios/XonTrack.xcworkspace -scheme XonTrack -configuration Debug \
  -destination 'platform=iOS Simulator,id=704E411B-176B-40F8-AA05-BE0513B87C6D' \
  -derivedDataPath /private/tmp/xot-notification-native \
  CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES DEVELOPMENT_TEAM='' build
```

Mobile capture command, from `XoTMobile/`:

```sh
node scripts/review-ios.mjs --app /private/tmp/xot-notification-native/Build/Products/Debug-iphonesimulator/XonTrack.app \
  --output /private/tmp/xot-notification-ui-confirm-20260930 \
  --case '390-de-dark|430-de-large' --interactions --notification-tour
```

[Screenshot and machine-result index](evidence/notification-mobility-2026-09-30/README.md). Captures were taken against the uncommitted implementation based on the recorded base revision. Final static-key changes preserve the displayed German text; timezone formatting now uses the account setting. Screenshots establish render evidence, not physical push delivery. Native in-memory interaction fixtures and separate PostgreSQL persistence tests cover different layers.

## Reviewable commit sequence

1. `2793c4ccf` — shared contracts, server planning/delivery, migrations/RLS, MCP and data documentation.
2. `ef55dc414` — mobile/web clients, notification settings, localized copy, widget guidance and regression/review tooling.
3. Documentation/evidence commit — this handoff, synthetic screenshots and machine-readable verification results.

The isolated review stack was stopped after validation. Pre-existing `.impeccable/critique/` work was preserved and excluded from these commits.

## Remaining device/release checks

- On an upgraded physical phone: enable account delivery, verify local optional schedules are retired, receive each configured unresolved reminder kind, then complete/skip a subject before delivery and confirm suppression.
- Disable alerts on one installation while another remains registered; exercise an offline disable followed by reconnect. Check cap/quiet-hours/spacing explanations against actual device delivery, including Focus.
- Confirm German notification titles/actions after language changes and upgrading over already scheduled notifications.
- Add Home/Lock Screen widgets manually. Start/stop/reopen real workout, fasting, movement and mobility sessions; verify Live Activities and Dynamic Island on supported hardware, including authorization-off behavior.
- Verify the existing Watch complication placement/tap, phone–Watch workout synchronization and exactly-once behavior. No new Watch widget family is promised by this change.
- Exercise phone/web/MCP conflict recovery across devices and offline runner resumption. Server tests cannot prove OS background scheduling or physical timing.
- Android physical permission/exact-alarm behavior, light-theme device review, production migration application, APNs/Expo delivery and TestFlight upgrade remain **unverified**.
