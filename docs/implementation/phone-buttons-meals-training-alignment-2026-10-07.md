# Phone button theme and Meals/Training alignment

The phone app uses one rounded-rectangle action theme and compact Meals,
daily Training and weekly Training layouts derived from the approved V45 boards.
This is unreleased work on `feat/v45-diary-meals-training-refinement-20261007`,
following `b40a0ba38`. Separate web and Watch styling is outside this batch.

## Shared action theme

`XoTMobile/src/components/ui/buttonTheme.ts` is the canonical material adapter.
Actions use a 12-point corner radius and a minimum 44-point touch target.
Primary actions have a 16% semantic tint with a 65% tinted edge; outline actions
use a 7% tint and 40% edge. Secondary actions use the elevated-surface token at
76% opacity and a neutral edge. Dark-mode glow is a restrained 10-point blur;
light mode uses a small neutral shadow. Disabled and loading actions omit glow.

`Button` and the legacy `NeonButton` adapter apply that material after caller
styles. Callers may supply layout, icons, a semantic tint, accessible names and
action state, but cannot replace the radius, fill or glow. Header, link and ghost
variants remain quiet. Native navigation controls, camera shutters, semantic
state circles, progress graphics and tappable content cards retain their own
purpose-specific geometry.

The action tiles, creation tiles, snackbar action, forms, pickers, filters, quick
logging and other phone action callers now use the same material. The
`button-theme:check` script rejects conflicting surface utility classes and
inline surface overrides in shared-button callers; it runs inside `validate`.
The mobile repository instructions document the rule for future additions.

Example usage:

```tsx
<Button
  variant="primary"
  icon="add"
  onPress={addFood}
  loading={saving}
  accessibilityLabel={t('foodSummary.addFood')}
>
  {t('dailyMeals.foodAction')}
</Button>
```

Visible and accessible labels must come from reviewed localization keys.
`NeonButton` bounds its visible label while preserving the full accessible name;
`Button` permits two lines. Long translated labels must still be inspected in
their actual layout. Paired Training actions stack above font scale 1.3.

## Meals and Training composition

Meals now leads with a three-column energy table, a separately ruled macro row,
Food and camera actions, and compact collapsed meal headers. Expanded groups
show thumbnail, food name, portion, known nutrition and actual recording time.
Add Food and Meal details are 44-point icon targets beside the template action
in one footer; enlarged text reflows it. Meal state is an independent semantic
glyph in a transparent 44-point target, preserving tap-to-cycle and long-press
selection. Edit remains in the native header.

Daily Training leads with the weekly destination, paired recorded-session/minute
statistics, Start/Record and Mobility actions. Recorded and planned rows share
clock, activity glyph, title and useful available metadata. Unknown energy stays
explicit. Weekly Training has a seven-day selector, selected-day summary and
compact day rows with ruled session contents. Recorded state sits beside the
title at normal text size. Create plan and Daily details follow the itinerary. German uses the shorter
visible “Tagesdetails” while retaining “Tagesübersicht” as its accessible name.

`DailyMetricTable` accepts labeled scalar metrics, optional units, colors,
icons/dots and label-first or large-number presentation. It stacks metrics above
font scale 1.3. `TrainingSessionRow` accepts title, details, optional known clock,
activity icon and navigation action; its weekly `compact` and `inlineDetails`
options preserve a 44-point target and reflow at enlarged text sizes.
`DailyDetailScreen` and `DateBar` share the selected day, optional date label and
one-day/seven-day navigation step with the incumbent calendar controls.

## Semantics and reference adaptations

The approved targets are
[Home and Training](evidence/v45-diary-meals-training-2026-10-07/approved-home-training.png)
and [Meals, Diary and hydration](evidence/v45-diary-meals-training-2026-10-07/approved-meals-diary-hydration.png).
Mockup values and names are illustrative. Real counts, known nutrition and
configured allowance determine the production display. Pending nutrition gets a
notice only when present; photo-only meals are not rendered as completed zero.

Native headers, back/date controls and the established symbol library replace
the boards' illustrative chrome. Enlarged text reflows and scrolls instead of
shrinking to fit the ordinary-size board. Weekly recorded timestamps/durations
are absent from the planning response and remain absent here; selecting a
record opens the actual daily details. Empty days never become invented rest
days. The existing logging, editing, planning, offline saves and sync paths are
retained; no data schema, queue or calculation policy changed.

## Validation

- Full mobile Jest run: **572 suites / 7,904 tests passed** after the shared
  theme and first layout implementation.
- After the first independent review's four layout fixes: **5 focused suites /
  24 tests passed**, including material adapters, disabled/loading behavior,
  meal state cycling/long-press, meal editing and unavailable Training sources.
- Mobile `pnpm run validate` passed after those fixes, including TypeScript,
  lint, format, German localization, button-theme and native-asset checks.
- All three German iOS simulator render and navigation tours passed: 390×844
  dark/light and 430×932 accessibility text. These used the existing Debug
  development shell with current JavaScript and isolated in-memory fixtures.
  The [manifest](evidence/v45-diary-meals-training-2026-10-07/aligned-simulator-results.json)
  retains the source base and states the persistence limitation.
- Repository layout and raster provenance checks passed. The documentation
  build passed with its existing chunk-size warning. No HTML/CSS detector ran
  for this native interface.

The [independent review](evidence/v45-diary-meals-training-2026-10-07/finish-button-alignment.md)
scored all four corrections and the introduced label break resolved, returning
**ship for those fixes**. Thirty current captures use the `aligned-` prefix;
the [supplemental footer tour](evidence/v45-diary-meals-training-2026-10-07/aligned-footer-simulator-results.json)
fully frames both enlarged weekly actions. The full Jest run predates the
bounded review corrections; focused suites and native tours cover them.
The shared phone material and implemented layout patterns are recorded through
a bounded merge into `DESIGN.md` and `.impeccable/design.json`.

Not performed: physical iPhone/Watch interaction, Android builds/device checks,
signed release archive, TestFlight upload, production deployment, real-account
data verification, actual Health/Fitness export, or hardware offline replay.
Simulator navigation and local fixture writes do not prove backend persistence
or OS delivery. No backend or web source changed in this follow-up.
