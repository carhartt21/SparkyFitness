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

## Caffeine validation so far

- Mobile: 19 tests passed across card, selected-day/DST calculation, hook refresh and food invalidation suites.
- Web: 20 existing caffeine-card tests passed.
- Native screenshots and full affected-package validation follow with the hydration pass.
