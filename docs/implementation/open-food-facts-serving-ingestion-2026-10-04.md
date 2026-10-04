# Open Food Facts serving ingestion — 2026-10-04

Branch: `fix/off-serving-ingestion-20261004`, based on `e19713b84`.
Implementation and local validation only; merge, production deployment and
TestFlight publication are separate release steps.

## Verified cause and reference

The public [Kinder Bueno record, barcode 80052760](https://world.openfoodfacts.org/product/80052760/kinder-bueno)
was read through the OFF v2 API on 2026-10-04. It declares
`serving_size: "1 serving (21.5 g)"`, `serving_quantity: 21.5`,
`serving_quantity_unit: "g"` and a separate 43 g pack quantity. Its nutrition
declares 572 kcal per 100 g and 123 kcal per serving. The sanitized subset in
`XoTServer/tests/fixtures/off-kinder-bueno-80052760.json` contains public product
metadata only. Source attribution: Open Food Facts contributors; see
[OFF data reuse and database licensing](https://world.openfoodfacts.org/data).
Product photographs are not copied into this fixture.

[OFF's serving-field documentation](https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_misc/)
defines the structured quantity as normalized weight/volume, rather than a count
of pieces. A pack's weight is not sufficient evidence of a serving size.

The request already included OFF serving fields. Information was lost further
along the pipeline:

1. Bulk hydration replaced the indexed product and could discard its serving
   declaration. Incomplete current records could also hide a fresh declaration.
2. Mapping only created countable variants for a narrow household-label format
   with a structured numeric quantity. Plain metric servings and text-only weights
   did not become usable portions.
3. With automatic scaling disabled, the old household variant copied 100 g
   nutrition into a smaller serving.
4. The normalized response schema and hand-enumerated client/save payloads omitted
   explicit portion weights. The web form also dropped them when grouping and
   expanding equivalent variants.
5. Mobile grouping could retain the gram representation while hiding the equally
   sized countable portion. Provider-owned canonical unit names needed localized
   presentation after persistence.

## Implementation

Search hydration keeps the serving declaration together as a bundle. Fallback
nutrition expressed only per serving retains its original serving basis; a newer
quantity cannot rescale an older serving-only nutrient value. Search retains its
one bounded bulk hydration request, timeout, rate-limit and outage behavior.

Mapping accepts positive finite structured quantities, decimal strings, and
explicit metric weights in `serving_size`. Household counts stay distinct from
metric weight, including `2 cookies (28 g)` and `1 cup (240 ml)`. Structured
quantities without a unit are interpreted in the normalized g/ml dimension.
Conflicting text/structured measurements and descriptions without a usable
weight do not produce guessed portion variants.

Every valid declaration yields both the existing metric variant and a countable
portion with its own independently scaled nutrition, `metric_amount`,
`metric_unit` and ordering. Automatic scaling still controls the metric default;
it never changes the portion's nutrition. Existing nutrient precision is retained.

The normalized server schema, primary food insert/list response, mobile mapping
and alternate-variant persistence, and web create/update/grouped-form save paths
preserve the existing serving metadata. Mobile prefers a countable portion of the
default's exact weight while honoring an explicitly requested metric selection.
Known canonical units render with existing German translations and decimal
formatting. Saved metric context appears once, including in the quantity picker.
Custom/provider names remain literal.

Simulator review also exposed the popover backdrop grouping its option buttons
out of the iOS accessibility tree. The backdrop no longer groups those children;
VoiceOver escape still dismisses the menu. The native review now selects a
saved OFF-shaped portion and verifies two portions weigh 43 g. The picker flips
above its trigger when necessary, respects safe-area bounds and scrolls long
lists at enlarged text sizes.

| Source declaration                             | Previously                                          | Corrected behavior                                        |
| ---------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| Kinder Bueno, 21.5 g                           | Metric amount or hidden/absent countable serving    | 1 portion = 21.5 g, 123 kcal; 2 portions = 43 g, 246 kcal |
| `28 g`                                         | No countable alternative                            | 1 portion of 28 g                                         |
| `2 cookies (28 g)` without structured quantity | No serving                                          | Explicit two-cookie serving with a 28 g weight            |
| `1 bar` without a weight                       | No safe gram conversion                             | Remains unknown; no inferred weight                       |
| Automatic scaling off                          | Household nutrition could equal the 100 g reference | 100 g reference and correctly scaled portion coexist      |

## Persistence and release requirements

The `food_variants` columns and inference trigger already exist in
`20260929120000_food_serving_portions.sql`. This change uses them and needs no new
migration, credentials or configuration. Older deployments still need the normal
existing migration chain applied.

Old imports are not bulk rewritten. On mobile, selecting a fresh provider result
and saving/logging it appends missing portions to a deduplicated saved food.
Previously logged nutrition snapshots and the existing default nutrient record
remain intact. A barcode that already resolves to a saved local food will keep
returning that local record; use the provider search result to re-import missing
servings. Cached pre-change responses require the normal refetch/expiration.

An automatic library backfill should be a separate, bounded, previewable operation
that appends missing portions with source identity and weight checks. It must
respect OFF rate limits and avoid altering diary snapshots or manually authored
servings. This batch does not perform production data writes.

## Validation

All three package `validate` wrappers passed (server, mobile and web), including
TypeScript, lint, formatting and applicable localization/native asset checks.
The frozen offline workspace install and documentation build passed.

- Server: 155 tests across ten suites, covering OFF mapping/hydration, alcohol,
  language, normalized schemas, provider integration, barcode contracts, primary
  metadata persistence and existing food queries/notes.
- Mobile: 318 tests across ten suites, covering normalized provider mapping,
  idempotent alternate-portion saves, localized serving labels, quantity entry,
  scans, selection/logging and the isolated review transport.
- Web: 49 tests across two suites, covering create/update payloads and form
  grouping/expansion. These are unit/hook tests, not a browser persistence check.
- German iOS simulator: native `testFoodDetailsLayout` passed at 390×844 normal
  text and 430×932 accessibility-extra-large text. It selects the portion, enters
  two, checks 43 g, verifies intentional drag versus scrolling, and opens the
  food/serving editor. The review host compiled successfully with Xcode.
- The UI mechanical detector reported no findings. `git diff --check` passed.

[Simulator captures and results](evidence/off-serving-ingestion-2026-10-04/README.md)
use synthetic in-memory nutrition, with one OFF-shaped portion of 21.5 g. They
demonstrate presentation/selection, not a live Kinder Bueno import. The API-derived
fixture separately verifies the real product's 123 kcal portion. Initial simulator
failures exposed the duplicate weight and inaccessible/off-screen menu rows;
the final captured run passed both cases after correction.

Physical-device/TestFlight ingestion, Android/tablet rendering, spoken VoiceOver
interaction, actual database restart persistence and production catalogue
backfill remain integration checks. The public OFF API record was verified live;
deterministic fixtures do not prove the private production deployment is running
the new code.
