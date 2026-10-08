# Dashboard brand header — 2026-10-08

The owner approved the right-hand stronger-outline E8 variant in [the comparison board](evidence/dashboard-brand-header-2026-10-08/approved-E8-comparison.png). The phone's dark and AMOLED Dashboard now show the outlined **X ON TRACK** lettering with a filled, localized tagline. Other page titles and the light Dashboard retain their native typography.

## Implementation

`XoTMobile/src/components/brand/DashboardWordmark.tsx` renders a static vector authored from the actual Space Grotesk 700 glyphs. Reference size is 28 points, tracking 0.05 points, outline 2.8% of font size (0.784 points), color `#ddf4e8`, and no fill. A decorative `#14e89a` halo uses blur 6 and opacity 0.52. The German tagline remains “Jeden Tag ein Stück besser.” at system Medium 13.5 points, tracking 0.1 points and color `#bbcfc5`.

The existing SVG renderer supplies proportional fitting inside the available title column. Dynamic Type increases the graphic height up to the existing 1.4 title multiplier cap; the one-line tagline retains its existing 1.6 cap and ellipsis behavior. `AppHeaderRow.tsx` accepts optional display artwork and subtitle styling, while its accessible header retains the complete localized brand and tagline. The decorative SVG is hidden from accessibility and cannot intercept taps. Logo, Settings, sync indicator and date actions retain their existing behavior.

Vector lettering avoids asynchronous font loading, platform font substitution and an additional runtime font asset. `assets/brand/dashboard-wordmark.geometry.json` records its upstream Google Fonts URL and font-file SHA-256. The upstream SIL Open Font License is retained alongside it in `space-grotesk-OFL.txt`. Regenerate on macOS with:

```sh
swift scripts/generate-dashboard-wordmark.swift \
  /absolute/path/to/SpaceGrotesk\[wght\].ttf \
  assets/brand/dashboard-wordmark.geometry.json
```

The generator is an asset-authoring script, not app runtime code. No dependency or native configuration changes are required.

## Verification

- Mobile `pnpm run validate` passed, including typecheck, lint, German overlay/copy checks, i18n audit, Knip, native locales, geometry, branding and formatting.
- Four focused header tests passed, covering dark/AMOLED accessible identity and Home/date actions, unchanged light typography, enlarged text and existing tab subtitle behavior.
- Normal iOS and Android exports passed. Neither bundle contains the isolated review origin or review-mode marker. The documentation build passed.
- The type detector found no findings before or after implementation.
- The existing development simulator app ran the current JavaScript through the isolated review transport. Four German native render checks passed at 390×844 dark/light, 402×874 dark and 430×932 enlarged text. [Results](evidence/dashboard-brand-header-2026-10-08/results.json) record the base revision; these captures include the implementation's working-tree changes.
- Batched visual inspection confirmed complete brand lettering, the approved contour weight, readable filled tagline, separation from the logo and Settings control, and no text overlap. [390 dark](evidence/dashboard-brand-header-2026-10-08/390-de-dark.png), [402 dark](evidence/dashboard-brand-header-2026-10-08/402-de-dark.png), [390 light](evidence/dashboard-brand-header-2026-10-08/390-de-light.png), [430 enlarged](evidence/dashboard-brand-header-2026-10-08/430-de-large.png).

The fixture values are synthetic. The iPhone 13 dark capture includes an OS return-to-app breadcrumb from the earlier standalone concept app; it is not part of X on Track's header. Render smoke checks are not visual approval for unrelated dashboard components. Physical VoiceOver, Android rendering and device performance were not exercised. This change does not include a TestFlight publication or production rollout.
