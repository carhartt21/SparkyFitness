# Micronutrient coverage implementation and rollout

Date: 2026-10-01. Branch: `feat/micronutrient-coverage`. Base: published `main` (`53c7092ef`); the PR contains only the two micronutrient commits.

## What changed

The gap was in source mappings and transport, rather than the nutrient picker: BLS parsed 138 components but exposed a small fixed-column subset; native imports/writeback omitted most dietary identifiers and could reuse another same-name record's values. The implementation adds all 27 native vitamins/minerals, including chloride, and 23 compatible BLS components through existing custom nutrient snapshots. Six micronutrients continue using their fixed columns. No arbitrary nutrient-specific database columns are added.

The source manifest pins the official BLS 4.0 German archive, SHA-256 `12b7a6ba62807ec9b301eb276f897dc85f99b2292311618dec3749a12d984c91`, containing 7,140 foods and 138 headers. The existing importer validated 7,090 foods with numeric energy and all three macros. The manifest explicitly classifies supported, blocked and out-of-scope headers. Vitamin A RE/RAE, folate forms/equivalents, iodide, separate vitamin D/K components and niacin equivalents remain blocked; selenium has no supported BLS component. Raw reported components and qualifiers remain available for inspection and cannot enter loose alias matching. Copper, manganese and B6 source micrograms convert to their catalog milligram units.

Mass conversion is finite and nonnegative, recognizes µg/μg/ug/mcg, and rejects incompatible units instead of treating the raw value as converted. Vitamin D alone supports 40 IU per µg with explicit catalog identity, following the [NIH vitamin D fact sheet](https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/). Other IU quantities need a separately verified chemical form. Tiny values are not rounded out of native writeback.

## Identity, permissions and history

A nullable per-user unique `catalog_id` binds existing custom definitions. Imports adopt only an unambiguous canonical name with a compatible unit; arbitrary aliases cannot establish identity. Provisioning and snapshot persistence share a transaction and per-user advisory lock. The actual actor remains separate from the target account. Diary delegates may create definitions and standalone native snapshots but cannot edit the owner's food library. Reports-only and unrelated actors cannot import.

Omitted native quantities preserve the previous value only for the same source record. New records do not inherit another same-name record's micronutrients. Native authoritative-clearing payloads are rejected. HealthKit explicit zero is known; Health Connect unset zero cannot establish presence and remains unknown. Native individual read failures preserve the remaining partial observations.

Retained-history deletion archives the definition and reserves its name/unit. Reactivation does not reseed targets or unhide preferences. Orphaned legacy JSON keys without a recoverable unit fail closed, including records hidden by medication RLS. Existing definition names/units are immutable until an atomic conversion/rename workflow exists; aliases remain editable. Unbound historical keys are excluded from catalog coverage rather than assigned a guessed unit. Legacy fixed-column zeros cannot retrospectively prove whether the source measured zero; historical values are not rewritten.

BLS imports reload source quantities on the server, including while extended imports are disabled. Client-provided fixed/custom nutrients or dataset checksums cannot override trusted BLS data. Per-user custom keys stay in private imported foods; public BLS reference rows remain read-only to the application role.

## Reports, visibility and diagnostics

`GET /api/reports/nutrient-coverage?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&userId=UUID` validates dates/identity and applies existing report permission plus RLS. Its response is date → catalog ID → `{knownEntryCount, eligibleEntryCount, recordedTotal, unit}`. Unknown totals are `null`; explicit zero is known. Eligible entries are consumed food snapshots (including meal children) plus countable taken/prn-taken supplement snapshots, once per entry rather than per dose. Amounts scale by consumed quantity or dose count. Malformed legacy values are unknown, and days with no known values are excluded from recorded averages.

Web Reports and mobile daily nutrition details show all 27 categories, recorded values and partial coverage, with reviewed English/German copy. Coverage remains separate from legacy dynamic numeric trend keys. Import and food/supplement mutation paths invalidate definitions, preferences, goals, diary totals and reports.

BLS mapping diagnostics expose qualified, blocked, out-of-scope and invalid source component counts. Successful imports record mapped/persisted counts; health batch logs record record count, payload bytes and duration. Nutrition error logs omit food names, values and raw records. Conflicts fail the transaction; repair CLI prints counts/cursors and errors without health content. Monitor upload failures and durations through the existing service logs; no external telemetry destination is introduced.

## Safe deployment order and rollback

1. Apply the server migrations and normal RLS initialization first. Shared database/API contracts are updated. CI owns schema snapshot synchronization; do not regenerate `db_schema_backup.sql` locally.
2. If device acceptance has not completed, set `MICRONUTRIENT_IMPORT_ENABLED=false` on the server and build mobile with `EXPO_PUBLIC_MICRONUTRIENT_SYNC_ENABLED=false`. Both default to enabled for development. Server acceptance remains compatible with old clients.
3. Verify native permission/read/write/background checks below, then enable server imports and release a mobile build with expanded collection. Food writeback uses consumed snapshots and bound definition units, without attaching supplement totals to each food. Existing supplement aggregation remains separate.
4. Roll back collection with the same switches. This does not delete definitions or saved snapshots. Restore the previous application images separately if a deployment rollback is needed; no production deployment was performed for this work.

## Bounded BLS recovery

From `XoTServer/`, using the intended database environment:

```bash
pnpm exec tsx scripts/repair_bls_micronutrients.ts --user-id USER_UUID --limit 100
pnpm exec tsx scripts/repair_bls_micronutrients.ts --user-id USER_UUID --limit 100 --apply
```

Default execution rolls back both proposed values and temporary definitions. Each batch is limited to 1–500 variants, with a UUID `--after CURSOR` to resume when `nextCursor` is returned. It only considers private, imported, untouched 100-g variants with matching dataset provenance. Any existing custom key is preserved, including zero or malformed legacy data; manual edits, household portions and unknown source versions are excluded. Normal food/variant edits invalidate repair provenance.

Older imports without provenance are excluded by default. After reviewing that their source was the pinned BLS 4.0 archive, explicitly add `--include-unversioned` to both dry-run and apply. This only accepts the pinned dataset hash and untouched 100-g variants. Never infer provenance for another version. A binding conflict aborts the batch for review rather than guessing a unit. `scanned: 0` can mean variants were excluded by these guards; review their provenance and edit timestamps before widening any repair.

Repair is replay-safe and adds missing library keys only. Existing diary snapshots remain immutable. There is no automatic historical BLS diary rewrite; entries without original source/basis/version are unrecoverable through this operation.

## Native historical replay

After granting the new dietary permissions, use the existing Import History screen. Select the desired historical interval and use **Start Over** for a previously completed checkpoint. This resets the checkpoint, not diary data. The existing account-scoped runner processes newest-first, resumable 30-day windows and uploads nutrition in chunks of 50. Stable source IDs upsert original records; failures retain the cursor for retry. History access remains bounded by platform permissions/availability. The normal rolling lookback alone is insufficient to enrich older imports.

## Verification

- Server, frontend and mobile `pnpm run validate` passed (typecheck/lint/format and applicable Knip/i18n/native resource checks). Shared formatting and German overlay checks passed. Docs production build passed.
- Server full suite: 440 suites passed / 11 skipped; 5,257 tests passed / 381 skipped. The database-specific tests below ran separately and are not counted among those skipped tests. An unrelated cycle-route authentication assertion failed in an earlier full run, then passed in isolation and both subsequent full runs. All final checks were repeated against the published-main base.
- Frontend full suite: 164 suites / 1,435 tests passed; production build passed.
- Mobile full suite: 515 suites / 7,449 tests passed, including collection, actual-unit writeback, tiny amounts and failed-delete replay protection.
- Isolated PostgreSQL integration: eleven tests passed for same-name independence, zero/unknown counts, partial replay, delegated snapshots, denied actors, concurrent binding, immutable units, archive/reactivation, meal/supplement counts and bounded BLS repair dry-run/apply/replay, trusted-source injection rejection, orphan-unit guards and built-in delegated meal types.
- Existing RLS matrix: 283 checks passed on the disposable database; fresh and upgrade migration initialization passed. Tests are run sequentially to avoid unrelated shared fixture cleanup contention.
- Official workbook check and isolated import: 7,140 rows validated/imported. No production data used.
- Authenticated web inspection uses the isolated demo with synthetic magnesium and sub-microgram selenium samples; coverage shows 45 mg and 0.2 µg, each with 2 known of 13 eligible entries. Unknown categories remain explicit. German light/dark and narrow (375 CSS px) layouts were inspected; the narrow page had no horizontal overflow. Evidence is in `micronutrient-coverage-evidence/`. The baseline capture reproduces the previous report layout by temporarily omitting only the new coverage section; the final source was restored before validation/commit.

Physical iOS/Android permission prompts, denied/partial authorization, micronutrient-only background observer delivery, device writeback round-trips, and mobile visual checks remain unverified release gates. Mocks and SDK compilation do not prove OS delivery. Keep the PR draft until those gates and maintainer alignment are reviewed. A device check should cover explicit zero, duplicate/overlapping correlations, Health Connect unset zero, loss of write permission during deletion, resume/replay, own-app exclusion, and both language/theme variants.
