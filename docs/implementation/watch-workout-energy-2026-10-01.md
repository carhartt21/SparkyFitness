# Completed-workout energy export

Date: 2026-10-01. Branch: `fix/watch-workout-energy-20261001`.

## Verified cause and resulting behavior

The previous iOS exporter called `saveWorkoutSample` with an empty quantity-sample list and no energy total. It created a timed workout without recorded energy. The Watch companion mirrored sets and rest timers but did not run a HealthKit workout session or collect sensors. These are verified code defects; the reported Fitness screenshot is consistent with that path.

The new Watch workout screen offers **Record energy / Energie aufzeichnen** when Settings → Health Data Sync → Write to Apple Health → Completed workouts is enabled. After Watch permission and a durable ownership grant from the phone, a native `HKWorkoutSession` and `HKLiveWorkoutBuilder` collect active energy and heart rate. Recording begins at the actual Watch start; energy for an earlier phone-only interval is not invented. Apple estimates active energy from the recorded workout; this is not a direct calorimetry measurement.

Finishing the workout on the phone sends a durable finish command over the existing WatchConnectivity transport. The Watch saves one workout with its associated samples only when there is positive recorded active energy and at least one completed app set. If energy is missing, permission fails, or completion is unconfirmed, the app diary is retained and Health export reports that limitation rather than creating another zero-energy workout.

An opted-in phone-only finish asks for **known active calories**. A positive finite value creates a user-entered energy sample associated with the workout. Skip retains the app workout without exporting to Health. No MET estimate, activity adjustment, goal calculation, server workout calorie value, or historical Health record is changed.

## Ownership, retry and import safeguards

- The existing account-scoped export journal reserves the Watch writer **before** sending its start grant. Once reserved, the phone never falls back to its own writer, even offline or after an ambiguous save.
- Finish commands, recording state and phase-specific receipts survive disconnection/restart. Duplicate or reordered commands cannot start a second builder or overwrite the first finish timestamp. Receipts are retried on connection/context requests and phone foregrounding.
- watchOS recovery reattaches the existing session/builder. Ambiguous saves query the stable sync identifier instead of rebuilding. A successful locked-device save may return no workout UUID; that is treated as saved, following Apple's contract. An unreadable/unconfirmed outcome remains unconfirmed and does not trigger a duplicate export.
- New samples use the actual HealthKit metadata keys. Existing records written with the older custom `HKMetadataKeySyncIdentifier` name remain discoverable through a compatibility lookup.
- Own phone and Watch workout sources and writeback metadata are excluded from Health reimport. The workout reader now preserves the metadata needed by this guard. Existing set/rest exactly-once operations remain separate and unchanged.
- No API/schema changes, migrations, credential changes, bundle-ID changes or app-group changes. The Watch target adds HealthKit entitlement/framework, workout-processing background mode and bilingual permission descriptions. Provisioning must include that capability in the next signed build.

## Changed surfaces

| Surface                                  | Main files                                                                                                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Watch sensor recording and recovery      | `XoTMobile/targets/watch/Infrastructure/WorkoutHealthRecorder.swift`, `Domain/WorkoutHealthRecording.swift`, `Presentation/WorkoutHealthStatusView.swift`, `WorkoutView.swift`, `XOnTrackWatchApp.swift` |
| Phone/Watch coordination                 | `XoTMobile/modules/watch-connectivity/`, `src/hooks/useWatchCheckInBridge.ts`, Watch context mapper/session manager                                                                                      |
| Health ownership/export and phone finish | `XoTMobile/src/services/workoutHealthExport.ios.ts`, platform-neutral service, `src/hooks/useActiveWorkoutFinish.ts`                                                                                     |
| Permissions and reimport                 | `XoTMobile/src/services/healthkit/index.ts`, `dataTransformation.ts`, `src/components/HealthDataWriteback.tsx`                                                                                           |
| Native config and localization           | Watch target config, English catalogs, `localization-overrides/de/{mobile,watch,watch-metadata}.json`, German overlay script                                                                             |
| Regression checks                        | Health export/finish/permissions/import tests, native locale gate, `XoTMobile/scripts/tests/watch-workout-health.swift`                                                                                  |

## Initial implementation verification

| Check                                                                | Result                                                                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile `pnpm run validate`                                           | Passed: generated i18n, German overlays/copy checks, TypeScript, lint, i18n audit, Knip, native locale/geometry and formatting checks |
| Selected Jest regression suites                                      | **20 suites, 830 tests passed**                                                                                                       |
| Foundation-only Watch protocol executable                            | **18 assertions passed**                                                                                                              |
| Full iPhone + Watch Debug workspace, iOS Simulator                   | Build succeeded, signing disabled                                                                                                     |
| Watch Debug, watchOS Simulator                                       | Build succeeded                                                                                                                       |
| Watch Release, physical watchOS SDK                                  | Build succeeded, signing disabled; this is not a signed archive or device test                                                        |
| German Watch layout                                                  | Rendered and inspected on a disposable 42 mm Watch simulator with an isolated synthetic workout                                       |
| Signed Watch permissions, sensor energy/HR and Fitness result        | **Unverified**; requires physical paired devices and a new signed build                                                               |
| Enlarged Watch text, denied permission UI, interruption while locked | **Unverified on device**; protocol/permission branches have automated coverage                                                        |
| Production deployment / TestFlight publication                       | Not performed                                                                                                                         |

Jest coverage includes phone energy validation and German decimal input, skipped export, permission upgrades, failed save/retry, canonical and legacy metadata, terminal/late receipts, offline ownership, account isolation, duplicate finish, empty completed sets, Health import/writeback, background sync, active workout persistence, navigation and Android writeback regression suites. Fixture results do not establish real Watch sensor behavior.

Reproduction commands, from `XoTMobile/`:

```sh
pnpm run validate
pnpm exec jest --watchman=false --runInBand \
  __tests__/services/workoutHealthExport.test.ts \
  __tests__/hooks/useActiveWorkoutFinish.health.test.ts \
  __tests__/services/healthkit/index.test.ts \
  __tests__/services/healthkit/workoutPermissions.test.ts \
  __tests__/services/healthkit/dataTransformation.test.ts \
  __tests__/stores/activeWorkoutStore.test.ts \
  __tests__/hooks/useStartLiveWorkout.test.ts \
  __tests__/hooks/useActiveWorkoutAutosave.test.ts \
  __tests__/screens/ActiveWorkoutScreen.test.tsx \
  __tests__/config/watchLocales.test.ts \
  __tests__/config/nativeLocales.test.ts \
  __tests__/services/backgroundSyncService.test.ts \
  __tests__/services/healthDataApi.test.ts \
  __tests__/hooks/useSyncHealthData.test.ts \
  __tests__/services/healthConnectService.ios.test.ts \
  __tests__/services/healthkit/writeback.test.ts \
  __tests__/services/healthkit/writebackMappers.test.ts \
  __tests__/services/healthConnectService.test.ts \
  __tests__/services/healthconnect/writeback.test.ts \
  __tests__/services/healthconnect/writebackMappers.test.ts
swiftc targets/watch/Domain/WorkoutHealthRecording.swift \
  scripts/tests/watch-workout-health.swift -o /tmp/xot-watch-health-protocol-tests
/tmp/xot-watch-health-protocol-tests
xcodebuild -workspace ios/XonTrack.xcworkspace -scheme XonTrack \
  -configuration Debug -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
xcodebuild -project ios/XonTrack.xcodeproj -target XoTWatch \
  -configuration Release -sdk watchos CODE_SIGNING_ALLOWED=NO build
```

Run prebuild and CocoaPods installation when regenerating the ignored iOS workspace from source target configuration.

## Render evidence

- [First implementation before UI refinement](evidence/watch-energy-20261001/watch-record-energy-de-before-polish.png): this is an intermediate implementation capture, **not** an original-app baseline.
- [Final German Watch screen](evidence/watch-energy-20261001/watch-record-energy-de.png): workout identity comes first; the rectangular recording button has a 44-point minimum target and the hint states that collection starts now.

Captures use synthetic data in a disposable simulator. No real Health or account data is committed. The simulator was not paired and these images do not show measured calories or permission approval.

## Next signed-build checks

1. Install an updated signed phone/Watch pair without deleting the app. Confirm previous entries, set/rest sync and preferences survive. Verify the Watch provisioning profile includes HealthKit.
2. Enable Completed workouts, start a synthetic phone workout, open its Watch page, choose Record energy, and approve Watch Workout/Active Energy permissions. Heart-rate permission may be independently denied; the UI must show unknown rather than zero when unavailable.
3. Exercise long enough to record positive energy, complete a set, and finish once on the phone. Confirm exactly one X on Track workout with positive active energy in Fitness/Health and associated HR when permitted. Reopen both apps and verify it remains exactly one.
4. Repeat with a temporary disconnection and reconnect after phone finish; confirm the one workout and existing exactly-once set/rest behavior. Exercise a locked-device finish and interrupted-session recovery without another export.
5. Check permission denial and missing-energy handling. The diary must remain saved, export must explain unavailable/unconfirmed state, and no phone fallback or fabricated zero-energy workout may appear.
6. Phone-only: try a positive known value, invalid/zero input, and Skip. Verify known energy is exported once and Skip leaves only the app diary entry. Confirm Health reimport does not duplicate the native Watch workout in the app diary.

Existing zero-kcal Fitness records are intentionally unchanged. The feature is not active on installed TestFlight builds until a new signed release is published.

## Platform contracts consulted

- [Running workout sessions](https://developer.apple.com/documentation/healthkit/running-workout-sessions)
- [Stopping activity with an end date](<https://developer.apple.com/documentation/healthkit/hkworkoutsession/stopactivity(with:)>)
- [Finishing and saving a builder workout, including locked-device success](<https://developer.apple.com/documentation/healthkit/hkworkoutbuilder/finishworkout(completion:)>)
- [Associating samples with workouts](https://developer.apple.com/documentation/healthkit/adding-samples-to-a-workout)
- [Active workout recovery](<https://developer.apple.com/documentation/watchkit/wkapplicationdelegate/handleactiveworkoutrecovery()>)

## Readiness correction and focused review

The readiness review found four merge blockers. All four are addressed in this batch:

1. The phone finish flow flushes again after the calorie prompt and after Health export, reads the current saved state, and checks session/server/start identity before every final action. A failed or still-dirty save leaves the workout active. Watch edits received during either wait are not discarded. Stale discard dialogs cannot clear a replacement session.
2. Retry enters the same guarded finish handler as the original action. Concurrent retries share one flow and cannot open overlapping calorie prompts.
3. Native asynchronous operations retain a generation-specific recording lease. Cleanup and startup completion only affect that lease; late continuations cannot release a newer recording, including recovery of the same sync identifier. Startup/end-collection continuations check ownership before continuing. A HealthKit save that has already succeeded still updates its own durable receipt without releasing a successor.
4. Watch configuration emits `WKBackgroundModes` with `workout-processing`, rather than the iOS `UIBackgroundModes` key. A generated-plist regression also checks preservation of HealthKit and app-group capabilities. See [Apple's watchOS background modes contract](https://developer.apple.com/documentation/bundleresources/information-property-list/wkbackgroundmodes).

The two original failing review tests are retained in `__tests__/hooks/useActiveWorkoutFinish.persistence.test.ts`, with additional save-failure, late-export-edit, account-switch, still-dirty-save and stale-discard checks. The Foundation executable additionally exercises reordered failure/cleanup/startup completion and recovery lease generations. These are deterministic lifecycle tests, not evidence of physical sensor recording.

Fresh corrective validation and final integration results are recorded below before merge. Signed Watch permissions, sensor readings, locked/background recording and Fitness output remain physical-device release gates. No production deployment or mobile publication is part of this merge.
