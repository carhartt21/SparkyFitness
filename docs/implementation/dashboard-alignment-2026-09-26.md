# Focused Dashboard alignment

Scope: native mobile Dashboard refinement against the actual supplied `mobile/01-dashboard.png`. Before evidence is [the V12 follow-up](evidence/mobile-v12-followup-2026-09-26/). No goal calculations, API contracts, navigation destinations or persisted identifiers changed.

## Observed differences and corrections

| Priority | Evidence                                                                                                        | Correction                                                                                                                                                      | Verification                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| P2       | Date actions lack the reference’s visual grouping; brand header has an isolated square logo.                    | Retain approved logo with rounded image bounds, existing approved tagline, and outlined 44-point date controls.                                                 | 390/430 native top captures; large text; all date handlers retain existing wiring. |
| P2       | Energy icons differ in optical width; remaining value is weak relative to surrounding figures.                  | Fixed 28-point icon column, neutral separator, 144-point ring and 28-point central number.                                                                      | Native top captures; existing no-goal/over-target semantic tests.                  |
| P2       | Nutrient labels and values consume most of each row, leaving short rails.                                       | Rebalance columns; compact Carbs/KH and Net carbs/Netto-KH labels retain full accessible names. Dark percentages use nutrient colors; light keeps neutral text. | DE/EN captures; core dark text contrast 6.23–9.00:1, AMOLED 6.40–9.25:1.           |
| P2       | Section headings and padding compete with the primary energy metric.                                            | 16-point main headings, 14-point paired headings, 12-point card padding, consistent 16-point corners; quick actions remain at least 60 points tall.             | Light/dark and large-text captures.                                                |
| P2       | Reducing paired metric space to 76 points caused the two-line German empty-workout message to lower its action. | Shared 92-point minimum preserves the two-line message and aligns normal-state actions. Conditional hydration sync/container content remains free to expand.    | Focused review correction and native recapture.                                    |

The reference’s invented numbers, unsupported profile/notification controls, alternate tagline and stock food photos remain excluded. Existing accessible details links, serving controls, chosen date and calorie semantics remain authoritative.

## Verification and evidence

- 30 related Jest tests pass across DashboardReview, MacroCard and HydrationGauge.
- TypeScript, ESLint, full formatting and native locale checks pass. Translation audit has no missing static keys, fallback mismatches, placeholders or hardcoded strings introduced here.
- Aggregate validate still stops at three pre-existing dynamic translation-key findings in HealthDataWriteback/SyncScreen. Separately run Knip still reports pre-existing unused GAP_USER_LABEL. These are not represented as a clean aggregate validation.
- Native DE390 and EN430 full food save/edit/delete, hydration and exercise-details flows pass in the first corrected matrix. Initial image-request assertion failed because the simulator reused a cached image; the fixture now uses a unique synthetic image URL per creation.
- Final Dashboard-only matrix uses the new `--dashboard-only` switch with `--interactions`; this selects a focused native test covering scroll, water increment, both details destinations and return navigation, without rerunning food entry. Full food verification remains the default native test.
- Light390 and enlarged German430 are rendered checks, not full interaction passes. Physical devices, VoiceOver and every theme/locale permutation remain unverified.

[Final captures and results](evidence/dashboard-alignment-2026-09-26/results.json): all four render scenarios passed, both dark DE390/EN430 focused native interaction tests passed. [Full food-flow results](evidence/dashboard-alignment-2026-09-26/full-flow-results.json) were captured before the final paired metric-height adjustment. Review disposition: **SHIP for the focused Dashboard alignment**, after the sole remaining German paired-action correction was confirmed. Evidence is synthetic iPhone Simulator data, not physical-device acceptance.

Changed application files: DashboardHeader, CalorieRingCard, MacroCard, DashboardSectionHeader, DashboardDayOverview, HydrationGauge, ExerciseProgressCard and DashboardScreen. Review fixture/Swift runner changes keep image requests fresh and add selective Dashboard verification. DESIGN.md and its sidecar record the implemented dimensions.

Release status will be recorded after the internal build is accepted.
