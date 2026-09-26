# Dashboard redesign and repeatable iOS review — 2026-09-26

Scope: the mobile Dashboard mismatch reported against v9, affected German labels, and an executable simulator review pipeline. This is the first UI/UX implementation batch; web and the remaining mobile screens are not certified by this evidence.

[Before/reference/after gallery](evidence/dashboard-simulator-2026-09-26/index.html) · [Runner instructions](../../SparkyFitnessMobile/review/README.md) · [Machine results](evidence/dashboard-simulator-2026-09-26/results.json) · [Independent finish review](dashboard-finish-review-2026-09-26.md)

## Prioritized findings

| Priority | Evidence | Correction | Verification |
|---|---|---|---|
| P1 | User screenshot: large energy ring and detached 2×2 buttons push macros below first viewport | Compact energy/stat split, four embedded logging buttons, full-width macro rows | Two device sizes; scroll captures; four native hit-target assertions |
| P1 | User screenshot: German and English mixed; date shown in English | Locale-aware date header/navigation and German dashboard vocabulary | Real German simulator launch; locale/interpolation tests |
| P1 | User screenshot: numeric label over ring | Explicitly disable Skia debug canvas and respect reduced motion | No badge in synthetic simulator captures; physical cause/fix remains unverified |
| P1 | Previous reviews depended on user credentials and manual screenshots | Dedicated simulators, explicit synthetic routes, OCR readiness, runtime-error gate, XCTest navigation | Seven render cases, two native interaction runs |
| P2 | Reference: hydration/exercise and meals form a coherent daily overview | Paired cards at normal text size; real meal groups/totals below; assistant moved after core summaries | Scroll captures and meal grouping/reconciliation tests |
| P2 | Initial large-text capture: number and ring label overlapped | Switch from absolute ring labels to flowing text and stacked cards at enlarged text | Accessibility-extra-large capture; scrolling rather than shrinking content |
| P1 (caught during implementation) | Native renderer reported text outside Text; search capture initially showed loading | Remove stray JSX space, complete search fixtures, wait for loading, fail on renderer errors | Corrected matrix and runtime-gate regression tests |

## Design decisions

Reuse approved logo and “Keep getting better.”; do not reproduce the reference's alternate tagline or contradictory energy numbers. Keep the server's consumed/base target/activity expenditure/allowance calculation separate. The ring labels remaining allowance or over-target explicitly. Show actual meal totals without invented food photography, drink counts or completion badges. Preserve Library and its destinations rather than relabeling it Reports. Existing light and AMOLED themes remain supported.

Use semantic theme tokens, including a new energy track token, established nutrient colors, rounded cards, native safe areas, 44-point controls and scrollable content. `DashboardHeader` and `DashboardDayOverview` are reusable components. Compact variants are optional on shared hydration/exercise cards; Diary's existing variants remain available. Larger text uses stacked layouts. Details, chat, date selection, water presets and exercise logging keep their existing handlers.

## Verification

- Full mobile Jest suite: **479 suites / 7,215 tests passed**. Targeted Dashboard and hydration tests rerun after review corrections: **23 passed**.
- TypeScript, ESLint over changed components/fixtures, and formatting of changed mobile files: passed.
- Runtime gate unit tests: **3 passed**.
- Seven simulator render scenarios passed; native scroll → food search and 44×44 action checks passed at 390×844 and 430×932. `null` interaction results mean not run.
- Production iOS JS export passed; review wrapper markers absent from the normal output. This is not an EAS binary or a TestFlight release.
- Repository-wide validation remains blocked by existing unused `resetReorderDragPreview` in MealTypeSettingsScreen.test.tsx; Knip reports existing unused `GAP_USER_LABEL`. i18n audit retains existing dynamic-key failures and incomplete locales outside this work. No new hardcoded UI strings reported after corrections.

## Remaining gates

The independent review requested three corrections: German food-search text, selected hydration-chip contrast, and enlarged German Settings tab truncation. All three were implemented, the full simulator matrix rerun, and the reviewer returned **ship for the three scored fixes**. This is not whole-app acceptance. Simulator snapshots do not prove live persistence, HealthKit/Watch behavior, camera permissions, VoiceOver usability or the physical debug-overlay fix. The pipeline currently verifies Dashboard and navigation into search; it does not yet run search → portion → save/edit/delete, mutation replay, long notes/keyboard or all other screens. No deployment is performed by this task.

Next extend the same fixture/interaction infrastructure to Diary and Add Food (including German, long names and keyboard), then Nutrition/Exercise; add equivalent browser review cases for Dashboard and Reports. Keep a human visual comparison gate alongside automated checks, and only then use TestFlight for device integrations.
