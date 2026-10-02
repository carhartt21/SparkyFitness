# Caffeine and hydration correction — 2026-10-02

Branch: `feat/caffeine-hydration-20261002`, based on the reviewed v38 corrections at `bd7e85b2d`.

## Evidence and scope

The Todoist caffeine attachment (task `6hgHqv6Xp45M2gJ7`) shows a September 30 curve with an October 2 rise. The implementation plotted from the earliest dose in the three-calendar-day lookback, and reported threshold crossings before the displayed day. This is a verified presentation defect; the screenshot alone does not prove that the latest drink failed to load. Food mutation invalidation, focus refresh and foreground refresh exist and need regression coverage.

The hydration attachment (task `6hgJ2hv6vp6FpMHf`) shows separate summary/logging and container/preset cards. The detail modal reads only `water_intake_entries`. Food water is gated by a legacy preference, and supplement water is absent from that projection. Range totals read a different base table from daily totals. These are verified source mismatches.

Owner decision: drinks always count toward the hydration goal. Water in solid food belongs only in the details. Keep the existing goal amount and stored nutrition snapshots. Do not create another intake ledger, duplicate food/supplement entries, or infer drinks from product names.

## Ordered implementation

1. **Caffeine first:** show the selected account-local day, retaining older doses only in the residual calculation; scope the crossing caption; distinguish historical day-end figures from current values; expose refresh failure/retry. Share the day-window calculation with web and verify midnight/DST, September/October boundaries and refetch after food logging.
2. **Hydration sources:** use one read projection for daily totals, range totals and detailed history. Reconcile direct/imported water with drink food snapshots and actually taken supplement water; exclude linked container foods from a second credit. Keep solid-food water visible but outside the goal. Preserve original IDs, nutrient scaling, source attribution and unknown values. No schema migration or historical data rewrite is planned.
3. **Hydration interface:** combine the dashboard amount, controls, container selection and presets into one full-width card. Replace the ledger-only details with goal progress, source breakdown, dated source history, explicit food-water separation and access to original entries. Keep offline/sync state visible and retain current logging paths. Provide reviewed German copy including “Wassergehalt”.
4. **Verification:** focused source/contract/cache tests, relevant package validation, normal production exports, and one batched native review in German dark/light and enlarged text; correct findings and confirm once. Use synthetic records only in evidence. Document physical-device/server checks that remain unverified.

## Plan review

Use existing routes/services/repositories and account-scoped clients. The detailed combined view is owner-only because it contains food and supplement source identities; existing aggregate permissions remain unchanged. Additive shared contracts must be validated in mobile, web and server. Persisted identifiers, goals, schedules and health records are unchanged. Existing water writeback and reminders must consume the same included total without double-crediting linked drinks. The obsolete solid-food goal switch must not continue promising behavior that contradicts the new policy.

## Delivered behavior and data contract

- Caffeine displays the selected account-local day, with explicit 24-hour ticks and a dated heading. Earlier doses still contribute residual caffeine. Historical values are labelled day-end; old threshold crossings cannot masquerade as today's caption. Mobile exposes retry on refresh error. Large text stacks the three values and legend.
- `hydrationSourceRepository` projects water logs plus their per-source daily aggregate reconciliation, unlinked drink snapshots and taken/prn-taken supplement water. It performs no writes. `hydrationTotalsService`, range reporting and reminder planning use this projection. Linked food IDs are excluded from a second credit. Existing hydration factors are not applied again.
- Goal water includes drinks; solid-food nutrient water is informational only. `food_ml` remains the backward-compatible included derived-water field. New optional `exportable_food_ml` contains only manual derived water so provider nutrition is not re-exported through HealthKit/Health Connect. Existing older-server behavior remains the fallback when that field is absent.
- Details are built from one row snapshot, so the source list and displayed totals reconcile. Unknown water stays `null`; missing times stay unknown. Daily aggregate adjustments are labelled without inventing a time. No goal amount, historical food/supplement snapshot, outbox, scheduler or stored ID is changed.
- Dashboard hydration is now one full-width card: amount/progress, add/remove, containers, presets and existing offline/sync controls. Details show the recorded total, source breakdown, separate solid-food water and history. Food sources link to that day's diary; supplement sources link to their existing detail screen.
- The obsolete web opt-in switch is replaced by the fixed counting policy. Water-content labels use the reviewed German “Wassergehalt”. All new mobile copy has English fallbacks and reviewed German overlays.
- Food, supplement, water and durable-outbox updates invalidate details and range caches. Both local and remote reminder anchors recognize the included source timestamps.

## Validation and review

- **Server:** 121 focused tests across eight suites, including actual SQL against a disposable PostgreSQL database. Fixtures verify scaling, volume fallback, linked-food deduplication, selected dates, per-source reconciliation, unknown nutrients, taken versus skipped supplements, imported-water export exclusion, owner-only details and delegated RLS identity propagation. No production database was used.
- **Mobile:** 132 tests across twelve suites: caffeine day/DST/refetch, unified details, source navigation, error/retry, water mutations, cached query invalidation, hydration reminders, range history, offline actions, nutrition fixtures and both health writeback paths.
- **Web:** 20 caffeine card tests. Browser visual review of the small settings-copy change remains unverified.
- Full mobile, server and web validation wrappers passed (typecheck, lint and package-specific checks). Mobile localization audit: no structural, placeholder, missing-key, missing-fallback or dynamic-key errors; German coverage 100%.
- German iOS simulator navigation/render tests passed at **390×844 dark**, **390×844 light** and **430×932 accessibility-extra-large**. [Screenshots and run results](evidence/caffeine-hydration-2026-10-02/) contain synthetic data only. The review corrected large-text caffeine overflow, stacked hydration breakdown rows and put recorded totals ahead of the explanatory copy. Existing horizontal “Today at a glance” scrolling is outside this targeted pass.
- The caffeine and hydration screenshots came from Todoist and were visually inspected, but are not committed because they contain owner data. The prior split hydration implementation is documented in the issue evidence above. Committed review PNGs are synthetic after captures, not fabricated before/after comparisons.
- Production iOS JavaScript export and web build passed. The exported JavaScript contains none of the review-only network or fixture markers checked (`Review blocked network origin`, `ui-review.invalid`, `XOT UI Review`). The simulator review uses an existing native development binary; this is not a newly signed TestFlight archive.

## Requirements and remaining checks

No migration, catalogue replacement, credential change or extra service is required. Deploy the updated server before using the new mobile detail endpoint. This branch has not been merged, deployed or published.

Drink classification uses saved volume units (including the serving-unit snapshot), not mutable library names. Older gram-only records with no volume metadata cannot be reliably distinguished from solid food; their water remains in details until the record's units are corrected. Provider/group classification needs a future explicit snapshot field if broader historical recovery is required. Volumetric solid-food servings are inherently ambiguous in the legacy model; no name-based guess or historical rewrite is made here.

Supplement water is the explicitly saved nutrient amount multiplied by the taken dose. No water is invented from a supplement's name or a planned/skipped occurrence. Existing database zero/default water values mean unavailable; volume-based drink estimates are labelled as estimates. Independent imported water and nutrition records without explicit source links are not heuristically collapsed by matching amounts or names.

Physical-device checks remain: log the reported energy drink and electrolyte serving against the updated server; verify the selected-day caffeine curve, one hydration contribution per occurrence, undo/edit refresh, and actual HealthKit/Health Connect writeback. Watch behavior, physical notification delivery and signed iOS build were not tested in this pass.

## Reproduction

```sh
# Never point this opt-in test at an application database.
XOT_HYDRATION_TEST_DATABASE_URL=postgresql://127.0.0.1:55439/xot_hydration_test \
  pnpm --dir XoTServer test tests/hydrationSourceRepository.integration.test.ts
node XoTMobile/scripts/review-ios.mjs --app /absolute/path/to/development/XonTrack.app \
  --output /private/tmp/xot-hydration-review-new-run \
  --case '^(390-de-dark|390-de-light|430-de-large)$' --interactions --hydration-review
```

Use a fresh output directory for each native run because xcresult export refuses to overwrite its manifest. The SQL test rejects non-local hosts and any database name other than `xot_hydration_test`; with no explicit URL it skips, never reports a live verification.
