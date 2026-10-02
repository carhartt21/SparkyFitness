# Native widget brand alignment — 2026-10-02

## Scope and design decisions

This branch starts at `899ac67bc7f8a897179a87cf29fe378f2f7b99a0` and changes native widget presentation only. It covers the four existing iOS widgets (calories, macros, meal capture, routines), their existing Lock Screen families, the two existing Android Home Screen widgets, and Android picker previews. Workout Live Activities and Watch complications are separate surfaces.

- Generate the static Progression X mark from `shared/src/brand/progressionX.geometry.json`, preserving its paths, gradients, stroke caps, and taper geometry.
- Generate native light/dark palette roles from `XoTMobile/global.css`. The green action/glow accent is `brand-secondary`; `brand-primary` is cream in dark mode and is not the green neon accent.
- Preserve category meaning: energy slate, protein blue, carbs violet, fat amber. Nutrition rings/bars retain their existing data semantics. The identity X never acts as a completion score or calorie-intake meter.
- Use a dark green corner wash and narrow nutrient halos in full-color iOS widgets. Light widgets use cream surfaces. Reduce Transparency suppresses the iOS wash/halos. Android uses night-qualified surface drawables rather than unsupported RemoteViews blur.
- Use semantic monochrome foregrounds in iOS tinted/vibrant modes, with transparent OS-controlled backgrounds and no glow. Lock Screen accessories receive a small monochrome X detail beside the existing recognizable action symbols.
- Place iOS medium shortcuts in a horizontal row with 44pt targets, replacing the narrow vertical rail. Android uses 48dp shortcut targets, compact headers, the existing fixed calorie 2×1 / macro 2×2 footprints, and matching picker previews.
- Keep native system type, units, existing reviewed localized strings, widget identifiers, timeline cadence, snapshot checks, and destinations. Fixed frames cap text growth; accessibility-sized calorie/macro content replaces the decorative ring with the numeric summary. Meal/routine layouts prioritize status and action labels. Long headers and compact nutrient labels may ellipsize; their accessibility text remains complete.

No new data contracts, permissions, migrations, or translated keys are introduced. Android receivers still advertise Home Screen only; this work does not add Android Lock Screen support.

## Source and reusable checks

- `XoTMobile/scripts/generate-widget-brand.mjs`: native palette, static Swift X, Android vector, and surface drawable generation.
- `targets/widget/WidgetTheme.swift`: surface, title, glow, monochrome adaptation, shared actions, and accessory treatment.
- `targets/android-widget/kotlin/com/xot/widget/WidgetComponents.kt.tmpl`: shared native header and shortcut targets.
- `pnpm run widget-brand:generate` updates generated native assets; `pnpm run widget-brand:check` detects drift and is part of mobile `validate`.
- `pnpm run ui:review:widgets --output-dir /tmp/xot-widget-captures` builds a temporary native Simulator gallery using production SwiftUI bodies and synthetic entries. `--before` compares the current `origin/main` source. It requires Xcode, Apple Silicon, and an iPad mini A17 Pro Simulator device type with an installed iOS runtime. It creates and removes its own Simulator; it does not use a browser or an app account.

The gallery concatenates the actual native Swift sources, substitutes writable fixture environment keys for the read-only family and Reduce Transparency inputs, and supplies the surrounding widget frame. It is a **content layout preview, not a WidgetKit host**. Background placement, Liquid Glass/tint composition, OS accessibility-setting delivery, reloads, account isolation, touch delivery, and accessibility announcements still require the real extension.

## Verification completed

- `pnpm install --frozen-lockfile` passed.
- `pnpm run validate` passed: i18n/German checks, TypeScript, lint, i18n audit, Knip, native locales, Watch geometry, widget asset drift, and formatting.
- `pnpm run test:ci --watchman=false` passed: **523 suites, 7,559 tests**. Final native widget contract checks separately passed: **3 suites, 75 tests**. Tests now follow the shared shortcut implementation while retaining localization, destination, snapshot/timeline, and launcher-footprint contracts.
- `pnpm exec expo prebuild --clean --no-install` passed for iOS/Android. Prebuild's missing Apple team warning applies to signing; no signing or release build was attempted. Generated project/icon churn was excluded from the branch.
- All production widget Swift files passed `swiftc -typecheck -parse-as-library`, using the iOS Simulator SDK and an iOS 17 target.
- Native Simulator content captures reviewed at 158×158 and 338×158 frames with 16pt margins: populated dark/light, German Accessibility 1 input (bounded widget type), and German empty/accented modes. The preview caught status/action truncation; the final layouts retain counts and action labels. The gallery's inline accessory width is illustrative and not an OS measurement.
- Android resource XML is well formed; clean prebuild copies the new components, palette, vectors, and night resources. Android SDK/emulator is absent on this machine, so Kotlin/resource compilation and launcher rendering are **not verified**.
- Semantic contrast against flat widget surfaces: light foreground **16.85:1**, secondary **7.88:1**, action **7.64:1**; dark foreground **16.39:1**, secondary **10.46:1**, action **11.24:1**. Colored nutrient indicators exceed **5.9:1** in both themes. These checks do not measure OS tint/material compositing; ring tracks and glows are decorative, and values remain labeled.
- One static design detector pass returned no findings. Its native-language coverage is limited; native visual review is the primary presentation evidence.

## Native content captures

All images use synthetic data and the same native gallery. The baseline uses the original SwiftUI render bodies with a system tertiary background and their compiled AccentColor asset; neither baseline nor after captures are actual SpringBoard widgets.

| State                   | Capture                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| Before, dark            | [Baseline](assets/native-widgets-2026-10-02/before-dark.png)          |
| After, dark             | [Neon](assets/native-widgets-2026-10-02/after-dark.png)               |
| After, light            | [Cream](assets/native-widgets-2026-10-02/after-light.png)             |
| German, enlarged text   | [German](assets/native-widgets-2026-10-02/after-de-large.png)         |
| German, empty, accented | [Monochrome](assets/native-widgets-2026-10-02/after-tinted-empty.png) |

## Acceptance still required before release

1. Install a native iOS build. Add each Home Screen size and each supported Lock Screen accessory. Confirm the real OS margins/background removal, light/dark, accented/vibrant appearance, Increase Contrast, and Reduce Transparency.
2. Tap each camera/search/scan/routine destination. Check widget reloads, midnight/expiry behavior, account switching, and VoiceOver's names/values on actual hosted widgets. Confirm original widget placements survive the update.
3. Build/install Android with its SDK, inspect 2×1 / 2×2 placements on a launcher, both themes and German enlarged text, and exercise both shortcut destinations. Check preview/runtime alignment.

No web or production deployment, mobile release, signing credential change, or automatic publication was performed.

## Platform references

[Apple widget rendering modes](https://developer.apple.com/documentation/WidgetKit/WidgetRenderingMode), [Apple accented rendering and Liquid Glass](https://developer.apple.com/documentation/WidgetKit/optimizing-your-widget-for-accented-rendering-mode-and-liquid-glass), and [Android Glance UI guidance](https://developer.android.com/develop/ui/compose/glance/build-ui) informed the OS-mode and native resource treatment.

## Focused refinement audit — 2026-10-02

This follow-up reviews the first brand pass at `54f1fe18622cb276e223d40ef3399ddd46404567` and refines the existing branch. The visual target is a concept reference; native captures and source contracts determine what ships.

### Platform verdict and scope

The render bodies use SwiftUI/WidgetKit and Glance controls, native symbol families, semantic palette roles, and existing destinations. Source and iOS content previews read as native widgets. Actual WidgetKit hosting and Android launcher conformance remain unverified; this is not a release approval.

The content/source audit scores **17/20 (Good)**. Scores describe this bounded review, not measured runtime performance or full screen-reader acceptance.

| Dimension | Score | Evidence / limitation |
| --- | --- | --- |
| Accessibility | 3/4 | Complete metric announcements, decorative rings hidden, 44pt/48dp actions, enlarged-text branch; actual VoiceOver/TalkBack still pending. |
| Performance | 4/4 | Static shapes/text, unchanged snapshot/timeline work, no raster asset or new IO in widgets; no runtime profiling claim. |
| Appearance | 4/4 | Generated semantic palette, dark/light/tinted content reviewed, quiet action borders, transparency-reduction branch. |
| Platform conformance | 3/4 | Existing native families and controls retained; OS host and launcher review remains a gate. |
| Adaptivity | 3/4 | Small/medium frames, German normal/enlarged text, empty/tinted content reviewed; some compact enlarged labels still ellipsize. |

### Findings and implemented changes

Four findings: **0 P0, 0 demonstrated P1 defects, 2 P2, 2 P3**. Three are addressed; one compact-text tradeoff remains. The missing device verification is a separate release gate.

1. **[P2] Ring interiors constrain the key metric and localized unit.** In `widgets.swift` and `macroWidget.swift`, the 17/19-point fixed numerals competed with thick rings, and German calorie labels were constrained by the ring diameter. Move the numeric value and wrapping label outside a compact 44pt ring. `WidgetMetric` in `WidgetTheme.swift` now uses scalable native title styles, monospaced digits and a complete localized accessibility label. Rings remain data visualizations and are hidden from duplicate accessibility traversal. This improves scanability without changing the remaining/consumed meaning. **Addressed.** Category: accessibility/adaptivity. Refinement: typeset/adapt.
2. **[P3] Medium nutrition titles drift from the other widget headers.** Move the static X and title into the full-width top row in both nutrition sizes. Keep numeric summary and supporting rows below it, and preserve the horizontal shortcut row. **Addressed.** Category: hierarchy/consistency. Refinement: layout.
3. **[P3] Repeated action borders compete with data.** `WidgetActionStyle` used 35% accent borders and Android's `widget_action_background.xml` used an opaque accent stroke. Both now use approximately 22% accent outlines, with unchanged full-contrast symbols and touch areas. Add 6pt horizontal text padding on iOS so German action labels have breathing room. Android's outline color is generated from the theme, not maintained separately. **Addressed.** Category: appearance. Refinement: quieter/polish.
4. **[P2] Enlarged compact labels exceed the fixed small frame.** Small German meal/routine headers and some nutrient labels still ellipsize at the enlarged-text input. Counts, units and action names remain visible; full accessibility strings stay intact. Retain the numeric priority and bounded type growth rather than shrinking all text further or changing reviewed terminology. The medium size is more readable. **Remaining tradeoff**, pending hosted accessibility review. Category: accessibility/adaptivity. Refinement: adapt on the real host.

The recurring issue was coupling the number's readable area to chart geometry. The shared metric presentation now separates those constraints. The static identity X, category colors, account/day guards, refresh cadence, empty values, units and deep links remain consistent. No new translated strings, widget capabilities or data contracts were added.

### Visual target and capture evidence

[Concept target](assets/native-widgets-2026-10-02/widget-visual-target-v2.png) · [Exact prompts](assets/native-widgets-2026-10-02/widget-visual-target-prompts.md)

The concept's decorative routine illustration, divider lines, light energy-color variation and illustrative accessory proportions are excluded from production. Shipped widgets use native code and the approved vector mark, not the target bitmap. The concept's shortened English status wording is not copied into the app.

| State | Current native content capture |
| --- | --- |
| Populated dark | [Refined dark](assets/native-widgets-2026-10-02/refined-dark.png) |
| Populated light | [Refined light](assets/native-widgets-2026-10-02/refined-light.png) |
| Populated German, normal | [German normal](assets/native-widgets-2026-10-02/refined-de-normal.png) |
| Populated German, enlarged | [German enlarged](assets/native-widgets-2026-10-02/refined-de-large.png) |
| German empty/accented | [Empty tinted](assets/native-widgets-2026-10-02/refined-tinted-empty.png) |
| Reduce Transparency input | [Opaque branch](assets/native-widgets-2026-10-02/refined-reduced-transparency.png) |

The six states were reviewed across initial and confirmation captures. Frames remain 158×158 and 338×158 with 16pt content margins. The normal German capture confirms the full calorie unit wraps and all nutrient names are visible; the enlarged capture confirms the numeric fallback and action labels. The opaque fixture confirms suppression of the corner wash and halos. This fixture supplies a writable Reduce Transparency input because the OS environment property is read-only; it does not demonstrate delivery of an actual accessibility setting.

### Follow-up validation

- Mobile `pnpm run validate` passed.
- Relevant widget contracts passed: **3 suites, 75 tests**; the earlier full mobile suite result above belongs to the first brand pass.
- Production Swift files passed the Simulator-SDK typecheck targeting iOS 17.
- Clean iOS/Android Expo prebuild passed; generated project/icon churn was excluded.
- All Android widget XML parsed successfully. The updated outline remains decorative; icon/text colors and contrast ratios above are unchanged.
- Native gallery compiled and rendered all six states. The first attempt to set the OS read-only transparency key failed at compilation; the fixture was corrected to substitute a dedicated input key, and the corrected gallery passed.
- No Android SDK/emulator was available. Kotlin/resource compilation, launcher rendering, actual WidgetKit hosting/taps, OS tint composition, and VoiceOver/TalkBack remain the acceptance gates listed above.

Prioritized follow-up: verify real host/accessibility behavior and Android rendering, then adapt any confirmed clipping, then perform the final native polish check. No additional presentation defects were inferred from the concept artwork.
