# Dashboard summary-card alignment

Work remains on `feat/v38-review-corrections-20261002`, following `bb008b096`. This is a focused follow-up to the owner's comparison of Calories and Daily Progress. The approved X geometry, progress timeline, energy calculations, task ordering and destinations remain intact.

## Findings and decisions

| Priority | Observed evidence                                                                                                                   | Correction                                                                                                                                                                                                                                                                                          | Verification                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Medium   | The gauge and X used different column widths and canvas sizes.                                                                      | One container-aware summary layout owns both columns and a 132–168-point visual footprint. The X uses a tightly framed viewport around its original paths, rather than changing its geometry.                                                                                                       | Native column/frame measurements and synthetic screenshots.                       |
| Medium   | Only the energy card used the neutral outline/glow. The headings, row heights, separators and task icons used different treatments. | Reuse the neutral card-glow token, 16-point inset, 18-point heading, 44-point heading target, 38-point icon holders and 64-point minimum rows. Both lists have matching separators and chevrons. Remove the duplicate flame in the energy heading; its activity row retains the real semantic icon. | German dark/light screenshots, enlarged-text capture and target/frame assertions. |
| Medium   | The first render of the shared rows exposed task text extending beyond the card edge.                                               | Bound the supporting column to the measured content width. Use a shrinking text container and allow names to wrap without imposing a character limit on personal data.                                                                                                                              | Native horizontal bounds, normal-size row measurements and enlarged-text review.  |
| Low      | The energy rail was green while the X's inactive outline was slate. The progress preview also used its dark baseline in light mode. | Pair both visuals with the canonical neutral baseline for the active theme. Preserve the existing colored progress paths, semantic action colors and category-specific task glyphs.                                                                                                                 | Theme captures and existing energy/brand regressions.                             |

The reading order stays title → large visual/count → three actionable supporting rows. Equivalent summaries share their structure, while calories remain an allowance calculation and daily progress remains one actual bounded task value. No aggregate health score, calorie policy, habit inference, extra scheduler or new data domain is introduced.

At ordinary text sizes, the measured body width determines the columns, with a 12-point gap and the same visual frame. A 192-point minimum visual column matches three normal 64-point rows. This is a minimum, not a fixed card height: long content may grow. At a font scale above 1.3 or body widths below 280 points, both cards stack in their existing reading order; enlarged energy text retains the previous accessible text presentation instead of shrinking a ring. Loading, failed, stale, resolved and no-applicable-task states retain their existing meaning and actions.

The X's `fit="track"` option crops empty reference-canvas padding to `52 52 216 216`; it changes no path, gradient stop, reveal mask, crossing or taper. Other brand placements retain their default canvas framing. Card glow remains neutral; row badges keep domain colors. The X stays crisp, while the gauge retains its already bounded faint fill halo. Different stroke shapes remain intentional representations of different data.

## Changed surfaces

- `XoTMobile/src/components/ui/DashboardSummaryCard.tsx`: shared frame, heading, adaptive columns and row chrome.
- `CalorieRingCard.tsx` and `DailyProgressCard.tsx`: compose that layout with their existing data and actions.
- `EnergyGauge.tsx`: optional neutral rail color, keeping its default for other usages.
- `brand/ProgressTrackX.tsx`: optional tightly framed canvas; correct light variant in the dashboard.
- `review/DashboardReview.swift`, `scripts/review-ios.mjs`, `review/README.md`: focused synthetic native alignment gate, isolated from keyboard/provider flows.

No new UI copy is introduced. Existing reviewed German keys are reused. User-entered task names are displayed literally; the English habit names visible in evidence belong to the isolated synthetic fixture.

## Evidence and checks

Validation and captures are recorded in [the evidence directory](evidence/v38-summary-card-alignment-2026-10-02/). Baseline screenshots come from the preceding committed refinement's native evidence, whose dashboard/card sources are unchanged through `bb008b096`; no private clipboard image is committed.

The first narrow native run failed because its broad task selector also matched the date navigator's `dashboard-next-day` button. The corrected selector explicitly excludes that real control. The first render also exposed the task-column overflow listed above, which was corrected before the final matrix. Failed runs remain failed; they are not evidence of acceptance.

All **25 regressions across 7 suites** pass, as do the 3 review-runtime tests, full mobile validation wrapper, layout detector and production iOS JavaScript export. Native layout/action checks pass in all four cases: 390×844 German dark/light, 430×932 English normal text and 430×932 enlarged German text. The canonical Watch geometry check passes; no Watch UI change is claimed.

At 390 points, both visual columns and both supporting columns measure **156 points wide**. At normal 430 points they measure **168 / 184 points**. Each supporting area and visual column is **192 points high** at normal text, with matching row separators. Enlarged text uses 168-point visual frames and 364-point full-width supporting areas; content heights grow independently so captions and values remain readable. Native tests check the actual balance, horizontal bounds, goal target size, three task targets and a real pending-task destination.

The bounded visual review inspected the common normal layout, light treatment, wider columns and enlarged stacked layout. The card and badge treatment, row/text bounds and canonical X framing are coherent. Existing larger date/header text and unrelated dashboard modules are outside this two-card pass.

Two harness assumptions required correction after the initial selector fix: OCR joined the arc with the balance digits, and XCTest's `StaticText`-only query missed RN's grouped balance text. The balance now has an actual native accessibility-label assertion. The enlarged viewport initially failed a smoke check that expected the task heading above the fold; its revised smoke check requires visible fixture energy content, while the native check still scrolls to and validates all task rows. The exact unsuccessful runs are retained in `validation.json`; none is labelled passed.

| Surface                | Before                                                                           | After                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 390 German dark pair   | [Before](evidence/v38-ui-refinements-2026-10-02/after-390-de-dark-progress.png)  | [After](evidence/v38-summary-card-alignment-2026-10-02/after-390-de-dark-progress.png)  |
| 390 German light pair  | [Before](evidence/v38-ui-refinements-2026-10-02/after-390-de-light-progress.png) | [After](evidence/v38-summary-card-alignment-2026-10-02/after-390-de-light-progress.png) |
| 430 normal pair        | No matching English baseline capture                                             | [After](evidence/v38-summary-card-alignment-2026-10-02/after-430-en-dark-progress.png)  |
| 430 enlarged task card | [Before](evidence/v38-ui-refinements-2026-10-02/after-430-de-large-progress.png) | [After](evidence/v38-summary-card-alignment-2026-10-02/after-430-de-large-progress.png) |

Full energy captures, a synthetic task destination, measured frames and source fingerprints are in the evidence directory.

### Repeatable checks

From `XoTMobile/`:

```sh
pnpm exec jest --runInBand --coverage=false \
  __tests__/components/CalorieRingCard.test.tsx \
  __tests__/components/DailyProgressCard.test.tsx \
  __tests__/components/progressTaskIcons.test.ts \
  __tests__/components/EnergyGauge.test.tsx \
  __tests__/hooks/useProgressActions.test.ts \
  __tests__/brand/progressionX.test.ts \
  __tests__/brand/watchProgressXGeometry.test.ts
pnpm run validate
node scripts/review-ios.mjs \
  --app /absolute/path/to/DevelopmentSimulator.app \
  --output /tmp/xot-summary-cards-unique-run \
  --case '^(390-de-dark|390-de-light|430-en-dark|430-de-large)$' \
  --interactions --summary-cards-review
pnpm exec expo export --platform ios --output-dir /tmp/xot-summary-export
```

These checks exercise production React Native components in a previously built development simulator binary with an isolated, in-memory synthetic transport. They do not establish production persistence, physical-device performance, Android rendering or signed archive compatibility. No native dependencies, project settings, backend contracts or migrations changed. Backend tests were skipped as requested. This batch does not merge, deploy or publish a release.
