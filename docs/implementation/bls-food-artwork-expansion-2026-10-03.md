# BLS artwork expansion — 2026-10-03

Branch: `feat/bls-artwork-expansion-20261003`, based on merged `main` at
`36166b9d6`. This batch changes display-only illustrations and source-code
assignments; it does not import or replace a catalogue, change nutrients,
persist images into food records, or rewrite diary snapshots.

## Evidence and scope

The read-only audit uses the official BLS 4.0 archive with SHA-256
`12b7a6ba62807ec9b301eb276f897dc85f99b2292311618dec3749a12d984c91`.
All 7,140 distinct public source codes remain mapped exactly once. The 7,090
core-nutrient-eligible records and 50 ineligible records are unchanged.

The initial mappings used nut artwork for seeds, cheese wedges for quark,
meat artwork for poultry/offal, and neutral artwork for yogurt and drinks whose
names mention powder as an ingredient. These were verified in the pinned
archive, not inferred from a live personal search history.

| Assignment basis        | Before | After |
| ----------------------- | -----: | ----: |
| Broad food group        |  5,642 | 5,174 |
| Reviewed subgroup/form  |  1,384 | 1,912 |
| Narrow food/preparation |     26 |    26 |
| Neutral                 |     88 |    28 |

584 source codes change their artwork assignment; 60 formerly neutral codes
gain a reviewed food/form image. Used artwork keys increase from 45 to 63.
This is representative coverage, not a unique photograph per catalogue row.

## Artwork and mappings

Twelve additional illustrations: seeds, flour, bran, starch, milk powder,
quark, tofu, olives, raw poultry, cooked poultry, cooked pasta and instant
coffee granules. Existing fresh-cheese, yogurt, offal, plant-milk, nut-butter,
pizza/quiche and pudding artwork is reused where supported by the source.

Primary food identity takes precedence over ingredient fragments. Yogurt with
milk powder stays yogurt; coffee prepared from instant powder stays a drink;
prepared soup/pudding is distinguished from its dry mix. Raw pasta and filled
pasta do not acquire the plain cooked-pasta image. A cooked ingredient named
later in a recipe does not establish the pasta's own preparation.

All mappings use retained `bls4` provider identities; German, English and owner
renames resolve identically. Real usable photos retain priority. Unknown codes,
other providers and meal templates retain their existing fallbacks. Existing
image failures, selection, multi-select, servings and logging flows are reused.

`x-on-track-design/food-artwork/prompts.json` preserves the shared directions and
per-asset briefs. `manifest.json` records dimensions, sizes and SHA-256 hashes.
Original full-size transparent outputs remain separate from the optimized
exports. The new PNG/WebP exports retain genuine alpha, inspected on dark and
light backgrounds. Files are in `XoTMobile/assets/food-artwork/` and
`XoTFrontend/public/images/food-artwork/`.

The batch adds 997,010 phone bytes and 198,374 web bytes. All 22 dedicated assets
total 1,933,805 PNG bytes and 385,944 WebP bytes. No image API, credentials,
hotlinking, new dependency, migration or runtime persistence layer is required.

## Validation

- Frozen offline workspace install passed.
- `XoTServer`, `XoTFrontend` and `XoTMobile` package `validate` wrappers passed.
- Focused server suites: 91 passed (`blsArtwork`, `blsFoodService`).
- Focused web suites: 66 passed (`foodFallbackImages`, `FoodResultCard`,
  `FoodListArtwork`).
- Focused mobile suites: 194 passed (`FoodThumbnail`, `SafeImage`, external food
  API, food entry and multi-select).
- The fixture adds 48 real source records covering every new asset and
  misleading alternatives, including raw/filled pasta, cooked vegetable in a
  pasta recipe, instant coffee versus prepared coffee, powder-added yogurt,
  processed cheese, meat substitutes and non-poultry game.
- The source audit regenerated mapping version 2; a subsequent read-only run
  verified exact agreement, all codes and both platform files.
- Production Vite build passed; the existing PWA precache contains 367 entries
  (9,031.64 KiB including app code and existing assets).

- Browser review passed at 390/1100 pixels in both themes with 40/64-pixel
  thumbnails, no horizontal overflow and no unexpected external requests.
  All 141 fallback WebPs were present in the production service-worker cache
  and fetched successfully with the browser network disabled. Captures live
  in ignored `.visual-sample/bls-artwork/artwork-{width}-{theme}.png`.
- Expo production iOS export passed; all 22 PNGs were verified byte-for-byte in
  the exported asset files. Both optimized formats match the inventory's
  SHA-256 hashes. This verifies Metro packaging, not native signing or device
  rendering. Expo warned about an unset Apple team in the unsigned export
  environment; no signing configuration was changed.
- Documentation build passed. All 12 new illustrations were visually reviewed
  in the contact sheet and dark/light small-thumbnail browser captures.

## Remaining limits

Illustrations represent families/forms, not exact varieties, species, cuts,
flavors or recipes. Poultry breast represents the poultry family, and a seed
mix does not claim that an individual seed contains every pictured seed.
The literal food name and nutrient record remain authoritative. Offal uses the
existing family image rather than exact organ/preparation artwork; quark can
represent flavored quark. Prepared/filled dishes and specialized powders still
need further curation. Broad group images remain common for fruit, vegetables,
seafood and prepared meals.

Cached food identities can resolve bundled artwork offline. The phone does
not have the BLS catalogue offline. Web images become offline-available after
successful service-worker installation. Historical rows without retained BLS
identity continue their photo/name fallback; no extra lookup is performed.

No production deployment, TestFlight build/upload, signed native archive,
physical iPhone/Watch check or live catalogue check was performed. Next useful
artwork passes: common individual fruits/vegetables, prepared tofu/dumplings,
then major mixed-dish families. Add exact identity/form regression examples
before refining another broad group.
