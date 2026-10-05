# v43 inbox corrections

## Reviewed implementation plan

Work on `feat/v43-inbox-corrections-20261005`, based on main `ea5110133`.
The seven inbox findings and the diary follow-up comments are one mobile batch.
Private screenshots and personal entries stay outside the repository.

1. **Serving retrieval and input.** Trace provider details through persistence and the unit picker. Keep gram input and provider portions separate, default new solid-food entries to grams, preserve explicit selections and logged snapshots, and carry known portion weight through every adapter. Verify old saved OFF imports refresh without replacing nutrient values. Liquids retain their declared metric dimension; do not invent density or an unknown portion weight.
2. **Diary.** Group foods by stable meal identity in collapsible timeline rows. Order meals by configured default times and keep individual occurrence times inside the group. Restore tap-to-cycle and long-press meal status actions. Show actual scheduled items for today/future, with existing explicit completion controls; past days contain recorded entries only. Make activity and sleep timeline details expandable without losing existing edit/navigation actions.
3. **Additional supplements.** Add explicit, unscheduled supplement intake using existing entry APIs/cache invalidation. Select supplement, quantity and occurrence time; keep medication/supplement distinction and scheduled-dose state intact. Show additional intake and existing undo/removal affordances.
4. **Quick add.** Add water and mobility actions using existing screens and selected-day routing. Retain workout, photo, barcode and measurement actions.
5. **Sync and mobility presentation.** Use shared controls, compact routine actions, legible stacked range selection and concise reviewed German copy. Preserve sync permissions, scheduler, cues, transitions and workout export semantics.
6. **Validation.** Add serving, diary scheduling/grouping, supplement and navigation regression coverage. Run the full phone tests for shell/navigation changes plus mobile validate; run focused shared/provider tests only if those layers change. Review isolated German fixtures at normal/enlarged type in dark/light, check empty/error/busy states, and document actual build/device limitations.

## Plan review

No new backend, persistence stack, notification scheduler or tracking domain is needed. Existing calendar-day/timezone helpers, meal status control, medication entries and local mobility history remain the source of truth. No migrations, live health-record edits, release or deployment are part of this batch. Contract changes require shared and web/server validation if evidence makes one necessary. Mechanical style checks follow native visual inspection rather than substituting for it.

## Results

Implemented on the feature branch; main and production remain at the previously released revision. Todoist was read for the seven findings and follow-up comments, without changing task status or posting messages.

| Inbox item         | Change                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `6hh2H2wJ8qWXcWp7` | Preserve provider serving metadata and refresh eligible older saved OFF foods, including imports that have only a barcode.                                                |
| `6hh4g4J57RRj3xc7` | Stack the sync range selector, use shared button sizing and theme surfaces, and replace misleading/mixed German copy.                                                     |
| `6hh4hpPmrCgXxxGf` | Group foods by canonical meal identity, collapse by default, retain meal-state tap/long-press controls, and show real scheduled or recorded items in chronological order. |
| `6hh4j2xjRXWW74V7` | Record additional supplement intake with actual quantity/time, without changing the plan or satisfying a scheduled occurrence.                                            |
| `6hh4j8Q685G463w7` | Compact mobility routine cards with a Start action and labelled edit/delete icons.                                                                                        |
| `6hh4jMprMwVPWF5f` | Add water and mobility to Quick Add, preserving existing logging routes.                                                                                                  |
| `6hh58HQhhMjWwhF7` | Start fresh food entries with metric input and retain named portions as separate selectable choices.                                                                      |

### Verified causes and behavior

- **Serving adapters dropped metadata.** The stored `metric_amount`, `metric_unit`, `serving_label` and `sort_order` were not carried through the local/detail adapters. A known household portion could consequently appear to have unknown weight. The adapters now retain those fields. External options no longer merge a gram basis and a named portion merely because their nutrient values match. Explicit selections remain authoritative after detail hydration; historical nutritional snapshots are not rewritten.
- **Legacy OFF refresh eligibility was too narrow.** Older saved imports without `provider_external_id` were skipped despite having a valid barcode. A bounded, account/locale-scoped refresh now uses that barcode when appropriate and appends missing portions. Provider failure keeps saved choices usable; active-account checks prevent stale responses from publishing into another account. There is no bulk catalogue rewrite.
- **Public source data was available.** The OFF v2 product API for barcode `80052760`, checked on 2026-10-05, returned `serving_size: "1 serving (21.5 g)"`, `serving_quantity: 21.5`, unit `g`, and package quantity `43 g`. This confirms the serving exists at the [public source](https://world.openfoodfacts.org/product/80052760/kinder-bueno); it is not verification of the owner's live XoT saved record. Synthetic native tests independently confirm two 21.5 g portions yield 43 g. Unknown weights and liquid density remain unknown.
- **Additional intake needed a narrow server correction.** The existing repository replaced every supplement quantity with the planned/default dose. Unscheduled `prn_taken` entries now accept a finite positive actual quantity in the supplement's existing unit. Planned occurrences still use the authoritative schedule dose, and nutrient snapshots remain server-derived. No schema or API contract changes are required.
- **Diary rows now preserve meal identity and chronology.** Today/future meals use configured default times, consistent with the reminder planner. Individual foods retain their occurrence times inside the group. Past days show only recorded groups, using recorded occurrence times rather than today's schedule. Real same-day habit/check-in timestamps display in 24-hour format; backfilled recording times do not become invented occurrence times. Activity, intake, water and sleep details expand independently. Existing swipe, multi-selection, photo, serving adjustment and edit flows remain available.
- **Planned is distinct from taken/completed.** Binary habits require an explicit check; count-based habits open their existing entry flow. Pending supplement occurrences require explicit intake confirmation and do not appear as taken. Future intake/habit completion is disabled. Incomplete photo captures remain separate captured entries. Partial query errors expose retry, and the new scheduled-items query cannot cause an early empty-day message while loading or failed.
- **Quick Add reuses existing behavior.** Water opens the existing hydration logger as a safe registered route, using the shared selected calendar day rather than a stale diary route parameter. Dashboard and Water Log share outbox retry and portion-label helpers. Mobility starts through the existing live phone runner, without backdating a session. Enlarged text uses full-width Quick Add rows. The app's existing queues, export consent, cues and HealthKit paths are unchanged.

### Validation

| Check                             | Result                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| Frozen offline dependency install | Passed                                                                                            |
| `XoTMobile validate`              | Passed: typing, lint, unused-code, localization, Watch/widget asset and formatting checks         |
| Full phone Jest suite             | 563 suites / 7,862 tests passed                                                                   |
| `XoTServer validate`              | Passed                                                                                            |
| Focused server Vitest             | 3 files / 85 tests passed: medication entry repository, medication schemas and routes             |
| Native v43 correction tour        | Passed German 390-point dark/light and 430-point enlarged-text cases                              |
| Native serving/detail tour        | Passed German 390-point dark and 430-point enlarged-text cases, including 2 × 21.5 g = 43 g       |
| Normal iOS Expo export            | Passed; review-origin, review-created and review-entrypoint markers absent from the Hermes bundle |
| Documentation build               | Passed: VitePress build and page rendering                                                        |
| Impeccable manual detection       | No findings on the changed UI roots; native images reviewed separately                            |

The blanket backend suite was skipped as requested. No shared/frontend implementation changed. The focused server tests use a mocked database; the native transport is isolated synthetic data, not evidence of production persistence. Native tours open the additional-intake form and mobility list without logging a dose or starting a workout. Supplement writes, failure draft retention, duplicate-tap guards and server actual-quantity validation are covered by focused unit tests.

Representative [screenshots and manifests](evidence/v43-inbox-corrections-2026-10-05/README.md) were reviewed in normal/enlarged text and dark/light themes. All names and nutrition shown there are synthetic fixture values. The final empty-state guard was verified by regression tests after the captures; it does not alter their settled layouts.

### Integration and remaining checks

No migrations, new environment settings, native entitlements or credentials are needed. Deploy the narrow server actual-intake fix with the mobile update; an older server still substitutes the default dose for the newly entered extra quantity.

Before the next release, verify on a signed physical device:

1. Open an older saved OFF food and confirm missing portions arrive from the real provider, metric input stays selected, and a subsequently logged portion persists after restart.
2. Log and undo one actual additional supplement intake; verify quantity, nutrient/hydration totals and unchanged planned adherence on phone/web.
3. Confirm meal tap/long-press state actions, habit confirmation and future/past chronology against real account settings.
4. Log water from Quick Add for the selected day, exercise the existing offline retry and reconcile it once, and verify Health/Watch behavior through the existing consent paths.
5. Check actual Apple Health/Health Connect permissions, background sync and mobility playback/export on physical hardware.

No signed archive, TestFlight publication, production deployment, paired Watch test or physical-device check was performed in this batch. Simulator tests used an existing development binary with current JavaScript. Further expansion of unknown provider portion weights should be source-backed; the app must not guess them.
