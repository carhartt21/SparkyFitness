# Representative food artwork

These are illustrative fallbacks, not photos of a specific provider product.
Existing usable food photos take precedence. The fallback files must not enter
persisted food image arrays, nutrition metadata or historical photo snapshots.

`prompts.json` records the shared visual direction and per-asset subject brief.
`manifest.json` records output hashes, dimensions and byte sizes. The original
1254-pixel transparent outputs remain separate from the optimized exports.
Phone exports are 256-pixel PNGs; web exports are 256-pixel WebPs. The 22 exports
total 1,933,805 bytes on phone and 385,944 bytes on web. The second batch adds
997,010 phone bytes and 198,374 web bytes without replacing the original ten.

Assets deliberately distinguish raw/cooked/dried tomatoes, smooth tomato sauce,
dry/cooked white and brown rice, raw apple and the mushroom family. Button
mushrooms represent the broad family; they do not establish an exact species or
preparation. No labels, packaging, provider logos or calorie claims are baked in.

The second batch adds seeds, flour, bran, starch, milk powder, quark, tofu,
olives, raw/cooked poultry, cooked pasta and instant coffee granules. These
represent families/forms rather than exact species, cuts, grain varieties or
recipes. Poultry breast illustrates the poultry family, not the precise cut;
the cooked image is distinct from the raw image. Quark can represent flavored
quark too: its literal provider name describes the flavor. The seed mix does
not imply that an individual seed record contains all pictured seeds.

`prompts.json` preserves both batches' complete visual direction and subject
briefs. `manifest.json` contains the optimized assets' dimensions and SHA-256
hashes. Keep the source outputs separate; never upsample an optimized thumbnail
to replace a source output.

Catalogue-to-artwork assignments live in
`shared/src/foodImages/blsArtworkManifest.json`. Regenerate and check them using
the read-only audit described in `agent-docs/bls4-food-source.md`. Keep the BLS
source hash and source-code identities pinned. Add both platform exports and
tests before introducing a new artwork key.
