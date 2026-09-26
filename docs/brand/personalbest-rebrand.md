# PersonalBest identity and migration (superseded)

This record describes the prior implementation. The current name, logo, and release checks are in [X on Track identity and migration](x-on-track-rebrand.md).

## Inventory and boundary

This fork has an Expo/React Native mobile app, React web/PWA, Express API, iOS Home/Lock widgets and Live Activities, Apple Watch app/widget, and Android widget. Existing blue theme roles, red flame logos, onboarding/About copy, email templates, PWA metadata, and native fallback strings are presentation identity and are replaced. Nutrient, workout, hydration, warning, and destructive colors retain their distinct data semantics.

The following names are **compatibility identifiers**, not presentation copy: the production `com.SparkyApps.SparkyFitnessMobile` bundle identifier; the `sparkyfitnessmobile` URL scheme; production App Group IDs; existing `@SparkyFitness/*` local-storage keys; Watch and widget target/product names and production bundle IDs; backend routes, database objects, upload paths, environment keys, and server package/file names. Changing these would risk installs, authentication, HealthKit permissions, deep links, offline records, or backup compatibility. The development iOS identifier is now `com.cg.phi` for Apple signing, and the Expo slug is `personalbest`; neither change migrates production storage. Upstream URLs, copyright notices, LICENSE, and historical migration comments remain as source attribution.

| Retained identifier family                                                                                                                                        | Why it remains                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `SparkyFitnessMobile`, `SparkyFitnessFrontend`, `SparkyFitnessServer`, Watch/widget target names, internal module/package names                                   | Source/build compatibility; their **display names** are PersonalBest.                          |
| Production `com.SparkyApps.SparkyFitnessMobile` bundle ID, Widget/Watch bundle IDs, and App Group                                                                    | Installed-app, extension, HealthKit, keychain, and shared-container continuity.                |
| `sparkyfitnessmobile://`, `sparkyfitness-watch://`, OAuth callback and notification deep links                                                                        | Existing shortcuts, callbacks, saved links, and native routing.                                |
| `@SparkyFitness/*`, `sparkyfitness:*`, legacy health-data source tags and sync identifiers                                                                        | Offline actions, saved preferences, imported/written health records, and duplicate prevention. |
| `SPARKY_FITNESS_*`, database names, server routes, provider IDs, upload and backup paths                                                                          | Deployment and API compatibility; no data migration is part of this rebrand.                   |
| Upstream `CodeWithCJ/SparkyFitness` URLs, license/copyright notices, technical installation guides, archived README, and historical HealthIntel migration records | Accurate source attribution and operational/historical documentation.                          |

The old brand appears in upstream-controlled translation catalogs; runtime localization replaces its product name in rendered strings. New PersonalBest copy uses new translation keys with English fallback so stale upstream wording (including inaccurate open-source claims) is not shown. Upstream installation and comparison guides remain explicitly identified as upstream references. Existing screenshots in those guides need editorial refresh before publication as PersonalBest marketing material.

## Upgrade and rollback

This identity change adds no database migration and keeps the production bundle identifiers and App Groups, URL schemes, account/session storage, HealthKit/Health Connect source identifiers, and backend API contracts. An in-place production application upgrade therefore uses the existing data and authentication state. The internal development build instead uses `com.cg.phi` and its derived extension/App Group identifiers; it is a separate install from the production identifier. Do not uninstall the old production app or clear its storage as part of the rebrand. Rolling back the production application binaries restores the former presentation while leaving records intact; this is separate from any future schema rollback. Web/PWA clients should allow the service worker to activate the new asset manifest, then refresh. Release sign-off still needs a physical-device check of the revised dark surfaces, large text, widgets, Watch and Live Activities, plus owner review of legal and store metadata. A signed in-place test upgrade preserved earlier synthetic diary records; this alone does not establish production upgrade behavior.

## Visual system

| Role                                 | Light     | Dark                  |
| ------------------------------------ | --------- | --------------------- |
| brandPrimary                         | `#102F29` | `#F2F7F3`             |
| textPrimary                          | `#102F29` | `hsl(220 15% 92%)`    |
| brandPrimaryDark                     | `#102F29` | `#102F29`             |
| brandSecondary / primary action      | `#1B5744` | `#77B394`             |
| brandAccent / meaningful improvement | `#FA842F` | `#FA9B56`             |
| supporting green                     | `#4B8C69` | `#86B99A`             |
| backgroundPrimary                    | `#F6F8F5` | `#0B1512`             |
| backgroundSecondary                  | `#EFF3EF` | `#141E18`             |
| surfacePrimary / elevated            | `#FFFFFF` | `#1C2921` / `#29372D` |

Semantic success, warning, destructive, information, and data-series colors remain separate. Platform-native typography supplies readable hierarchy; metric numerals use tabular figures where available. Primary actions are green. Orange is never a generic CTA or destructive color. A physical iPhone review found white text on the dark theme’s light green filled controls at only 2.42:1 contrast. Filled controls now use the semantic dark foreground at 7.66:1; muted text on the revised dark card surface measures 7.49:1. Dark and AMOLED cards use a clearer surface and border hierarchy.

`docs/brand/archive/personalbest/SparkyFitnessMobile/assets/brand/source-logo.png` preserves the supplied raster baseline. The earlier `pb-mark-light.png` and `pb-mark-dark.png` were technical, transparent variants made from it; the PersonalBest icon was the white full-bleed icon without a second rounded-square mask. These assets are historical and are not used by X on Track.

## Copy and surface rules

The canonical product name is **PersonalBest** and tagline is **Keep getting better.** Do not fabricate PersonalBest Score values until a real scoring model exists. Use “New PersonalBest” only for a verified personal improvement. Empty and error states remain useful rather than motivational filler. The former assistant mascot name is no longer presented as product identity; existing internal translation keys and assistant API contracts remain stable. About labels its source, documentation, and policy links explicitly as upstream material. Legal-policy URLs and upstream source attribution are retained until owner-reviewed replacements exist.

The Dashboard hydration card now presents recorded volume, a compact progress bar only when a target exists, an explicit configured-volume action, and quick drinks. It retains the same logging callbacks and food-water attribution. Food-entry occurrence notes use a plain field; food-definition markdown editing and stored markdown rendering remain intact. App Settings adds a fasting master switch that hides its Dashboard card and cancels fasting-goal reminders without removing historical or active fasting records. The existing Dashboard card-visibility preference remains separate.

## Validation and legal review

Check Expo configuration, mobile/web/server validation, generated iOS and Android projects, and the widget/Watch targets after changing assets or metadata. Physical-device visual and accessibility review remains a separate release check. Privacy/Terms documents and app-store listing need owner/legal review before publication; renaming does not alter their legal meaning.

Validation on 24 September 2026: mobile validation and 454 Jest suites passed; web validation, 147 Jest suites, and production Vite build passed; server validation and 401 Vitest files passed (seven skipped); VitePress build passed. Expo prebuild completed for iOS and Android. The combined iOS Release simulator build passed with Xcode selecting target SDKs; the Watch widget also built independently. The resulting app, iOS widget, Watch app, and Watch widget Info.plists report PersonalBest display names. Android Gradle compilation remains unverified because this Mac has no Android SDK. A signed physical-device build including the iOS widget and Watch targets succeeded, and the first signed build launched on an iPhone 17 Pro with synthetic diary data retained. The revised visual build has compiled but its second on-device inspection remains pending while the phone is unavailable.
