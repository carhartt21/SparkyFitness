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

The gallery concatenates the actual native Swift sources, substitutes a writable fixture environment key for WidgetKit's read-only family key, and supplies the surrounding widget frame. It is a **content layout preview, not a WidgetKit host**. Background placement, Liquid Glass/tint composition, reloads, account isolation, touch delivery, and accessibility announcements still require the real extension.

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
