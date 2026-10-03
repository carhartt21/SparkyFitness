# Representative food artwork

These are illustrative fallbacks, not photos of a specific provider product.
Existing usable food photos take precedence. The fallback files must not enter
persisted food image arrays, nutrition metadata or historical photo snapshots.

`prompts.json` records the shared visual direction and per-asset subject brief.
`manifest.json` records output hashes, dimensions and byte sizes. The original
1254-pixel transparent outputs remain separate from the optimized exports.
Phone exports are 256-pixel PNGs; web exports are 256-pixel WebPs. Ten exports
add 936,795 bytes on phone and 187,570 bytes on web.

Assets deliberately distinguish raw/cooked/dried tomatoes, smooth tomato sauce,
dry/cooked white and brown rice, raw apple and the mushroom family. Button
mushrooms represent the broad family; they do not establish an exact species or
preparation. No labels, packaging, provider logos or calorie claims are baked in.

Catalogue-to-artwork assignments live in
`shared/src/foodImages/blsArtworkManifest.json`. Regenerate and check them using
the read-only audit described in `agent-docs/bls4-food-source.md`. Keep the BLS
source hash and source-code identities pinned. Add both platform exports and
tests before introducing a new artwork key.
