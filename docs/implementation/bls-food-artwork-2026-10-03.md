# BLS artwork workflow — 2026-10-03

Implemented on `feat/bls-food-artwork-20261003`, based on `6dac8ddf1`.
No merge, production catalogue changes, deployment or mobile publication was
performed in this batch.

## Verified source and coverage

The local official BLS 4.0 archive was validated using the existing importer and
its pinned SHA-256:
`12b7a6ba62807ec9b301eb276f897dc85f99b2292311618dec3749a12d984c91`.
This was an archive audit, not a live database audit. The catalogue contains
7,140 unique records; 7,090 remain eligible under the existing core-nutrient
filter. No missing nutrient values were filled or altered.

All 7,140 codes now resolve to a shipped display-only fallback:

| Assignment basis          | Records |
| ------------------------- | ------: |
| Broad food group          |   5,642 |
| Reviewed subgroup/form    |   1,384 |
| Specific food/preparation |      26 |
| Neutral illustration      |      88 |

There are 45 artwork keys: ten new illustrations and 35 reused group images.
The mushroom family accounts for 82 broad-group assignments using the new
mushroom image. It does not promise species/preparation fidelity. Neutral artwork
is intentional for additives and isolated powders without suitable images.
Most other records have representative group artwork, not individual photos.

An initial code validator assumed a numeric suffix; the archive disproved that
assumption with 772 alphanumeric codes. Exact codes such as `M5B1600` are preserved
and regression-tested. The first letter alone is also insufficient: E includes
both eggs/pasta; K includes roots/mushrooms; H includes nuts/legumes/substitutes.

## Implementation and visual decisions

- `foodArtworkKey` shares a locale-independent BLS-code map across phone/web.
  Real photos remain first; OFF tags and the existing name classifier remain
  fallbacks for items without a known BLS identity.
- Search, saved-food lists, quantity entry and the mobile edit cover retain
  source identity when selecting fallback artwork. Images never enter saved
  food photo arrays, nutrient records or historical snapshots. Fallbacks cannot
  open as a real photo.
- Ten transparent illustrations distinguish raw/cooked/dried tomatoes, smooth
  tomato sauce, raw apple, dry/cooked white/brown rice and the mushroom group.
  Rice with onions and curry rice remain dishes; tomato soup remains soup; sauce based on a
  white base remains a broader condiment. No nutritional inference is made.
- Phone PNGs add 936,795 bytes; web WebPs add 187,570 bytes. Both are 256×256.
  Originals remain separate. Subject briefs and exported-file hashes are in
  `x-on-track-design/food-artwork/`.
- The existing web service worker now precaches all 129 bundled fallback images
  (10 new, 31 generic, 88 OFF). This adds approximately 2.2 MiB to the initial
  precache. It requires one successful online installation. The phone embeds
  its image files; neither path supplies an offline BLS search catalogue.
- Unsplash credentials were not consumed. No image download service, new cache
  database, external runtime image dependency or catalogue migration was added.

## Validation actually run

| Check                                                                                  | Result                                                        |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Frozen offline workspace install                                                       | Passed                                                        |
| Pinned archive audit in write and read-only check modes                                | Passed; 7,140 unique mappings and both asset inventories      |
| Server targeted artwork/BLS tests                                                      | 43 passed                                                     |
| Mobile thumbnail, image failure, API mapping, quantity entry and multi-selection tests | 194 passed                                                    |
| Web fallback, library artwork and search card tests                                    | 54 passed                                                     |
| Server/mobile/web `pnpm run validate` wrappers                                         | Passed                                                        |
| Production Vite/PWA build                                                              | Passed                                                        |
| Production iOS Metro/Hermes export                                                     | Passed; all ten new PNG hashes present in exported assets     |
| Isolated Chrome artwork/PWA review                                                     | Passed; 129 images fetched offline through the service worker |
| VitePress documentation build                                                          | Passed                                                        |

Visual review inspected transparency and representative identity, the large
contact sheet, and actual 40/64-pixel browser images at 390/1100 widths in both
themes. No horizontal overflow was detected in the isolated review. Tests retain
photo precedence, inert failed-photo fallbacks, locale independence, recycled
rows, OFF group resolution and serving/selection behavior.

Evidence remains ignored under `.visual-sample/bls-artwork/`: `coverage.json`,
`assignments.json`, `artwork-review.png`, four browser screenshots,
`browser-review.json`, validation/test logs and the iOS export. The browser
fixture uses public asset names only and does not sign into an account.

## Remaining checks and next priorities

1. Review representative samples from the broad families before expanding
   specificity, especially seeds, poultry/offal, cheese/quark and prepared
   dishes. Generate new images only where the existing group image is misleading.
2. Review the 88 neutral assignments for useful subgroups such as flour, milk
   powder and isolated ingredients. Keep unknown/inapplicable records neutral.
3. Check actual BLS search → saved food → quantity entry on a physical phone and
   an updated production PWA. No physical-device/native archive or live provider
   catalogue check was performed. The iOS export is a bundling check, not a
   signed-device acceptance test.
4. Historical diary rows without retained provider identity still use their
   existing photo/name fallback. Avoid per-row requests or rewriting history;
   consider retained identity in future read contracts only if needed.

Current maintenance instructions are in
`docs/src/developer/food-provider-images.md` and
`agent-docs/bls4-food-source.md`. The public BLS source remains attributed to the
Max Rubner-Institut, BLS 4.0 (2025), CC BY 4.0.
