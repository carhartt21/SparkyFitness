# v40 localization audit and release preparation

## Scope and verified causes

Audited the phone's 5,668 active English source keys and corresponding German catalog, static-copy/source checks, notification actions, numeric/date/time presentation, Expo permission metadata, iOS widgets/Live Activities, 145 Watch app keys and 16 Watch complication keys. Literal food, provider and user-entered names remain unchanged. This is German acceptance; incomplete non-German catalogs continue to use the documented English fallback.

The structural audit alone was insufficient: existing keys could contain partially translated copy. The old lexical guard missed phrases such as “Typ Barcode Instead”, “Use Gestern” and “Nein matching exercises found”. Twenty-six legacy locale branches selected Polish or English and ignored German. Watch complication configuration/VoiceOver literals and the photo-library permission prompt were outside the earlier coverage.

## Corrections

- Corrected **714 phone German values** through the reviewed nested overlay, then regenerated the shipped catalog. Coverage includes food/search/scanning/servings, plans, synchronization, calorie settings, containers, health metrics, fasting, accessibility, cycle/fertility/pregnancy/sleep and validation/empty/error copy.
- Replaced all 26 Polish-versus-English date locale branches with the existing reactive `useAppLocale()` hook. German dates, weekday abbreviations and decimal separators now follow the selected app language. Existing 24-hour presentation remains enforced, including legacy 12-hour preferences.
- Localized water/energy complication names, descriptions and accessible energy text through `ProgressCopy` and native EN/DE resource keys. Watch app and complication coverage is 145/145 and 16/16 in German. Localized the missing photo-library permission explanation; all five source permission keys have non-empty German copy.
- Expanded the phone/Watch mixed-copy guard, rejected duplicate native keys, and added complication configuration metadata to static-copy checks. Regression tests reject the observed mixed phrases while preserving product names, interpolation, valid shared technical terms and notification `du` copy. App flows retain formal/neutral address; notification prompts/settings retain the approved personal voice.
- Corrected `cal`/`Kal` presentation to `kcal` in the affected food/meal and exercise-history values. This changes labels, not nutritional calculations.

| Before | After |
| --- | --- |
| Typ Barcode Instead | Barcode eingeben |
| Use Gestern | Gestern verwenden |
| Nein matching exercises found | Keine passenden Übungen gefunden |
| English dates outside Polish | Dates from the selected app locale, including German |
| English Watch complication picker labels | Wasserziel / Energieziel and German descriptions |

The release also includes the previously reviewed v39 owner corrections: category-based daily progress and real activity metadata, localized Watch daily goals with scoped confirmations, wellness capture from More with recorded entries retained in Diary, camera mode background removal and aligned Dashboard quick-action labels. The older weekly-activity branch's classification and date fixes are already integrated on main; remerging it would discard newer activity completion semantics. No unrelated feature branch was included.

## Validation

The final checks passed. Earlier failures were corrected before release: the CommonJS native-test importer could not evaluate an eager `import.meta` CLI path, and one exercise-history test expected the old `cal` label. No tests were disabled.

- Phone `pnpm run validate`: passed, including type/lint, source/locale audits, German copy, native resources, geometry/assets and formatting.
- Web and server `pnpm run validate`: passed. Broad server tests were omitted under the owner's standing instruction; the localization correction changes no server runtime code. The inherited v39 correction forwards optional activity metadata through the shared daily-progress projection; a server rollout is needed for that metadata to become live.
- Root German overlay/copy regression tests: 10 passed; overlay freshness and `git diff --check`: passed.
- Phone full Jest suite: **542 suites / 7,663 tests passed**, no failed or skipped suites (143 seconds).
- German phone simulator matrix: dark/light at 390×844 and accessibility text at 430×932; all three render and native interaction cases passed. Navigation, category destination, food selection, numeric/text keyboard, save and refreshed summaries used isolated synthetic transport. Screenshots were visually inspected.
- Watch synthetic host: 16 native assertions passed using actual Swift views and German resources. All Watch complication Swift sources typechecked against the watchOS simulator SDK.

[Screenshots and machine results](evidence/v40-localization-2026-10-03/README.md) document the checked surfaces. The simulator phone shell is a previously compiled development app; Metro loaded the audited v40 source. EAS rebuilds all native targets for the actual release. The evidence JSON records the pre-commit source base, not a signed v40 binary claim.

## Release boundaries and remaining checks

Prepare a clean committed main revision and follow [the TestFlight runbook](../../XoTMobile/docs/testflight-release.md). The remote iOS build number was 39 before this release; the production profile auto-increments the intended next build to 40 and uses automatic submission. Retain the existing production micronutrient/coaching gates and compatibility bundle/app-group identifiers. Do not infer submission or availability from queue acceptance.

Physical phone/Watch delivery, paired-device exactly-once round trips, hosted complications, VoiceOver, notification receipt/actions and native permission dialogs remain device checks. User-defined habit/food names can be English by design. Programmatic coverage and inspected representative screens are not proof that every possible personal record fits at every text size.

## Confirmed TestFlight publication

Released **1.7.2 (40)** from clean, pushed main `cdb1a345b6e9a65f3a5532c47ef90a19dc2692cb`. The frozen workspace install and repository-layout/overlay checks passed at that exact source. The main merge has the same source tree as the validated release branch and introduced no conflicts.

- [EAS cloud build](https://expo.dev/accounts/ilmtech/projects/personalbest/builds/ff58b010-18a9-4b56-9496-13e83fcabbad): **FINISHED**.
- [Automatic Apple submission](https://expo.dev/accounts/ilmtech/projects/personalbest/submissions/de80dddb-c76c-48ed-af8a-3a39ebd35ca4): **FINISHED**, no submission error.
- [App Store Connect TestFlight](https://appstoreconnect.apple.com/apps/6803564460/testflight/ios): build 40 **VALID**, internal state **IN_BETA_TESTING**; verified through Apple's API. External beta review was not requested.
- Downloaded the production IPA and verified all five signed targets: matching 1.7.2/build 40, correct team, retained `group.com.cg.phi`, production push on the phone, and HealthKit on phone/Watch. Inspected the actual German permission resources (5), Watch catalog (145) and complication catalog (16).
- IPA SHA-256: `7344dce9466f9a1e0edb30da3e1a4e1fe5b8a7264bf6326a5f3b91a37f24a259`.

[Machine release result](evidence/v40-localization-2026-10-03/release-results.json) and [binary verification](evidence/v40-localization-2026-10-03/ipa-verification.json) contain the observed result without credentials or personal data. The release package is private and retains the IPA/logs and duplicate-attempt guard. No GitHub workflow run was observed for the main merge; the local checks listed above and the cloud native build did run. No production server/web rollout was performed in this phone/Watch release task.

Publication confirms binary delivery, not the remaining physical-device checks above.
