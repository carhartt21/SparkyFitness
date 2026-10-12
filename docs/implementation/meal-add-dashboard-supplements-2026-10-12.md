# Saved-meal add action and Dashboard supplement access

## Scope and sequence

This focused phone refinement starts from main `a48f2e372`, after v50.

1. Restore the visible plus in saved-meal quick-add actions. The shared Button
   accepted an icon with null children, but rendered icons only alongside string
   labels. Fix that missing icon-only rendering path while retaining the existing
   themed material, accessible portion label, loading indicator and duplicate-tap
   guard. Keep custom child content unchanged.
2. Add Supplements to Home's lower detail-navigation list. Reuse the existing
   supplement title, semantic intake icon, row material and dated Supplements
   route. This opens the selected day's supplement flow; it never records an
   intake merely by navigating and does not open the mixed medication library.
3. Verify the food-search action's visible glyph, loading state and one-portion
   behavior; inspect both paths on iOS in German dark/light and enlarged text.
   Run the mobile validation wrapper and relevant tests. Backend tests remain
   outside this phone-only change.

## Acceptance criteria

- Saved-meal add actions show a plus before and after saving, with a spinner and
  disabled action while pending. A repeated tap still logs only one documented
  preset portion; incomplete presets retain their existing detail fallback.
- Home's bottom list includes Supplemente in German, aligned with its existing
  detail rows, with a minimum 44-point target and no clipped label at enlarged
  text sizes. Opening it retains Home's selected date.
- Existing labeled buttons and explicit custom button children retain their
  behavior and shared material. No new translation key is needed: the reviewed
  German supplement title and accessible meal portion label already exist.
- Implementation, integration, release delivery and physical-device acceptance
  are recorded separately. This batch does not start a new release.

## Verification

- Frozen workspace install passed. The complete mobile suite passed: 583 suites,
  7,952 tests. The 38 focused button/food-search tests also passed, including the
  visible plus before/after saving, disabled pending state and one-portion
  duplicate-tap guard.
- Final-source mobile validation passed, including localization, type checking,
  lint, dependency checks, native contracts and formatting. Explicit localized
  navigation labels preserve displayed amounts and exclude decorative English
  symbol names; native checks confirm the corrected label.
- German iOS native render and interaction checks passed at 390 points in dark
  and light themes, and 430 points with enlarged Dynamic Type. Both actions
  retain 44-point targets and their existing horizontal insets. Home opens the
  real Supplements screen with the same selected historical date. All three
  saved-meal captures visibly show the plus. The native scenario is repeatable
  through `--inbox-ui-review`; harness corrections and case results are in the
  [evidence record](evidence/meal-add-dashboard-supplements-2026-10-12/results.json).
- The documentation build and `git diff --check` passed. Backend tests were
  skipped for this phone-only change.

The native transport uses synthetic data and the saved meal is read-only. These
checks do not establish backend persistence, physical-device/Android acceptance
or actual VoiceOver interaction. At extreme Dynamic Type, existing food-search
filters truncate and meal names wrap; this bounded change does not redesign
those layouts. The implementation is ready for integration; release delivery
and owner acceptance remain separate.

Subsequent merge and delivery work is tracked in the [v51 release record](v51-release-2026-10-12.md).

| Case | Home lower list | Saved-meal action |
| --- | --- | --- |
| German dark, 390 pt | [Capture](evidence/meal-add-dashboard-supplements-2026-10-12/390-de-dark-dashboard-supplements.png) | [Capture](evidence/meal-add-dashboard-supplements-2026-10-12/390-de-dark-saved-meal-plus.png) |
| German light, 390 pt | [Capture](evidence/meal-add-dashboard-supplements-2026-10-12/390-de-light-dashboard-supplements.png) | [Capture](evidence/meal-add-dashboard-supplements-2026-10-12/390-de-light-saved-meal-plus.png) |
| German enlarged, 430 pt | [Capture](evidence/meal-add-dashboard-supplements-2026-10-12/430-de-large-dashboard-supplements.png) | [Capture](evidence/meal-add-dashboard-supplements-2026-10-12/430-de-large-saved-meal-plus.png) |
