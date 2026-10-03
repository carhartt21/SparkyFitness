# Food Provider Images

How food photos flow from an external provider into X on Track, and how bundled representative artwork fills an empty image slot without changing the food's data.

## Bundled BLS artwork

BLS supplies reference-food names and nutrients, not product photographs. The
clients resolve a missing image through `foodArtworkKey` in `@workspace/shared`.
For `provider_type: 'bls4'`, the exact `provider_external_id` selects an entry in
`shared/src/foodImages/blsArtworkManifest.json`. German/English display names and
owner renames therefore do not change the illustration. Keep the complete code:
BLS 4.0 includes alphanumeric codes such as `M5B1600`.

Resolution order is an existing usable food/provider photo, then the BLS code
mapping, then existing Open Food Facts group tags, then the conservative name
fallback. Meal templates use dish artwork. A failed photo may display the
illustration, but the illustration never opens a photo viewer and is never saved
into `images`, `image_url`, nutrients, or historical snapshots.

The version-2 mapping covers the pinned catalogue's 7,140 records. It reuses
bundled group artwork and has 22 dedicated illustrations, including raw/cooked
poultry and pasta, seeds, olives, tofu, quark, flour, bran, starch, milk powder
and instant coffee. It also distinguishes raw/cooked/dried tomatoes, tomato
sauce, raw apple and dry/cooked white and brown rice. There are 28 neutral
assignments for additives and specialized powders without a reviewed image;
5,174 assignments still use broad groups. These are representative illustrations,
not exact species, cuts, pasta shapes, recipes or nutrient records. Mushroom
artwork represents the family, not a particular species or preparation.
The 50 nutrient-ineligible catalogue records remain ineligible for food search;
having artwork does not make their nutrition complete.

The audit uses the official German source names to classify preparation once,
then ships code-based assignments. Do not apply older BLS numerical suffix rules
to this dataset or infer a mixed dish's identity from one ingredient word.
The primary food takes precedence over a secondary ingredient: yogurt with
milk powder uses yogurt artwork, coffee prepared from instant powder uses a
drink image, and prepared soup is distinct from dry soup powder. A cooked
ingredient mentioned in a pasta recipe does not prove the pasta's own state.

```bash
cd XoTServer
# Read-only archive check; verifies the committed mapping and both asset sets.
pnpm exec tsx scripts/audit_bls_artwork.ts --archive /path/to/BLS_4_0_2025_DE.zip
# After reviewing rule changes, regenerate the derived manifest only.
pnpm exec tsx scripts/audit_bls_artwork.ts --archive /path/to/BLS_4_0_2025_DE.zip --write
```

Neither command accesses a database. The archive digest is validated by the
existing importer. Coverage and public-name assignments are written under
`.visual-sample/bls-artwork/`, outside version control. Source attribution remains
in `agent-docs/bls4-food-source.md`.

Asset inventory, subject specifications and output hashes live in
`x-on-track-design/food-artwork/`. Phone PNGs are bundled under
`XoTMobile/assets/food-artwork/`; web WebPs ship under
`XoTFrontend/public/images/food-artwork/`. Every mapping must resolve to a file on
both platforms. No Unsplash credentials or runtime image service are required.

Cached food records with retained provider identity can display these images
offline. This does not download the BLS catalogue to the phone. Historical diary
rows without retained source identity continue using their existing photo/name
fallback; no per-row lookup or history rewrite is performed.

The production web service worker precaches the three fallback image folders
using its existing Workbox cache. Its first successful installation requires a
connection. To review transparency, 40/64-pixel thumbnails, light/dark and narrow
layouts, and actual offline cache availability:

```bash
cd XoTFrontend
pnpm run build
node scripts/review-food-artwork.mjs
```

The review serves the built assets on an isolated loopback origin. It never
connects to an account or backend. Screenshots and results stay under
`.visual-sample/bls-artwork/`; this is an asset/PWA gate, not a phone device test.

## Support matrix

| Provider          | Images?                    | How this was verified                                                                  |
| ----------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| **OpenFoodFacts** | **Yes — working**          | Live API call, plus confirmed end-to-end in the app                                    |
| **Mealie**        | **Yes — working**          | Confirmed end-to-end against a live instance                                           |
| **Tandoor**       | **Yes — working**          | Confirmed end-to-end against a live instance                                           |
| **FatSecret**     | API supports it, but gated | Live API call with real credentials — see [FatSecret](#fatsecret) below                |
| **Nutritionix**   | Expected yes               | Official docs (`photo.thumb` / `photo.highres`); not yet verified live                 |
| **Yazio**         | Unverified                 | Code maps an image field; never tested against the live API                            |
| **Norish**        | Unverified                 | Recipe `image` is mapped and resolved against the instance URL; no instance to test on |
| **USDA**          | **No**                     | Live API call — the FDC response has no image fields at all                            |
| **SwissFood**     | **No**                     | Live API call — no image fields in the response                                        |
| **BLS 4.0**       | Bundled illustrations      | Read-only pinned-archive audit; not source photographs                                 |

Treat every "unverified" row as unproven: mapping code reading an image field proves the plumbing, **not** that the upstream API populates it.

Mealie, Tandoor, and Norish are self-hosted, so their images are served from the user's own instance. Mealie and Tandoor return relative media paths that are resolved against the configured base URL before download; Norish does the same. Because those URLs are private-network hosts, `localizeImages` may refuse them under its SSRF guard — in that case the remote URL stays in place and the browser loads it directly, which still works for a user on the same network.

## The pipeline

A provider photo takes the same path regardless of provider:

1. **Provider mapper** sets `image_url` (and optionally `image_source_url` for a full-size variant) on the mapped food — for example `integrations/openfoodfacts/openFoodFactsService.ts`.
2. **Response schema** must declare the image keys. `NormalizedFoodSchema` in `XoTServer/schemas/foodSchemas.ts` is a plain `z.object()`, so **any key it doesn't declare is silently stripped** from the search, barcode, and details responses.
3. **Search card** renders it — `FoodResultCard` resolves `images[]`, then the `imageUrl` prop, then `image_url`.
4. **Edit form** seeds the image picker. A provider result has no `images` array yet, so `useFoodForm` falls back to `image_source_url || image_url`.
5. **Save payload** sends the ordered `images` array. Both the create and update branches of `api/Foods/enhancedCustomFoodFormService.ts` must include it.
6. **Persistence** — `resolveImageInput` in `XoTServer/utils/imageLocalizer.ts` normalizes `images` / `image_url` / `image_source_url` into one array.
7. **Localization** — after commit, `localizeImages` downloads remote `http(s)` URLs into `/uploads/foods/<id>/` and rewrites the column. Failures are non-fatal and leave the remote URL hotlinked. Both `createFood` and `updateFood` in `models/food.ts` do this.

Every hop must carry the field. A break at any one of them looks identical from the UI: no image.

### Re-importing an existing food

`createFood` in `services/foodCoreService.ts` de-duplicates by barcode and by provider external id. When a match is found it returns the existing row through `refreshExistingExternalFoodMetadata`, which **backfills the provider photo only when the stored food has none**. An image already on the food is the user's and is never overwritten.

This means a food imported while images were broken will pick one up on re-import, without needing to be deleted first.

### The MCP / assistant path

Foods logged through the MCP server or the in-app assistant do **not** use the web form's save path. `log_external_food` in `ai/tools/foodTools.ts` builds its own `createFood` payload field by field, so image keys have to be listed there explicitly — the same trap the web create branch fell into.

MCP and the chatbot share one tool registry (`routes/mcpRoutes.ts` mounts it via `registerRegistryTools`), so a fix in `foodTools.ts` covers both surfaces at once.

`create_food` is deliberately excluded: it exists for custom and AI-estimated foods that have no provider and therefore no photo.

When adding any new food-creation entry point, prefer passing the mapped provider object through rather than re-listing fields. Every image bug so far has been a hand-enumerated payload quietly omitting `image_url`.

## FatSecret

FatSecret images require **three** things, and all three must line up:

1. **Premier OAuth scope.** `getFatSecretAccessToken` defaults to `basic`. `getFatSecretNutrients` requests `premier` first and falls back to `basic` on failure, so Basic-plan installs keep working and simply get no photo. A failed premier attempt is cached per credential for an hour so Basic accounts don't repeat the handshake on every enrichment call.
2. **The `include_food_images=true` parameter.** Without it the API returns no image element regardless of plan. This applies to `food.get.v4` and to `foods.search` v3/v5 alike.
3. **The images add-on enabled on the account.** This is the one that cannot be solved in code. FatSecret's docs state: _"Requires separate premier offering, please contact us in order for this feature to be enabled for your account."_

On the plan comparison page, **Food images** and **Allergens and Dietary Preferences** both carry a `**` footnote. Those two features are withheld until FatSecret provisions them, even on Premier Free.

A quick way to tell whether an account is provisioned — request all three premier flags at once:

- `include_sub_categories` returning `food_sub_categories` proves the premier scope is working.
- `include_food_images` and `include_food_attributes` coming back empty **while sub-categories work** means the account is missing the `**` add-ons, not that the request is wrong.

SparkyFitness calls the **v1 `foods.search`** method, whose response has no image fields at all — it does not accept `include_food_images`. (The newer v3/v5 `foods.search` do accept it under the premier scope; we do not use them, see the warning below.) So a search result only gains an image through the detail-enrichment call, `applyDetailToItem` in `services/externalFoodSearchService.ts`, which fetches `food.get.v4` per result. Only the top `ENRICH_SYNC_COUNT` results are enriched, so images can only ever appear on those.

::: warning
Do not migrate the search to `foods.search.v5`. It requires premier scope and hard-fails for Basic accounts with `Missing scope: scope 'premier'`, and it returns no images that `food.get.v4` doesn't already return.
:::

## Verifying a provider yourself

Read the mapper, then **call the real API** — the two answer different questions.

```bash
# OpenFoodFacts: the fields= list is mandatory, images are omitted without it
curl -s -A "SparkyFitness/1.0 (https://github.com/CodeWithCJ/SparkyFitness)" \
  "https://world.openfoodfacts.org/cgi/search.pl?search_terms=nutella&search_simple=1&action=process&json=1&page_size=1&fields=product_name,image_front_url,image_url"

# USDA: confirms there is nothing to map
curl -s "https://api.nal.usda.gov/fdc/v1/foods/search?query=cheddar&pageSize=1&api_key=DEMO_KEY"
```

For an OAuth provider, fetch a token first, then request one known food and grep the raw JSON for `image`. Testing a provider's **own documentation example food id** is the strongest check available: if their docs show images for that id and your call doesn't, the difference is account entitlement, not code.

## Diary entries own their photo

A diary entry does not display the food's photo live. It snapshots it, exactly
as it snapshots nutrition:

- `models/foodEntry.ts` copies the food's `images` onto `food_entries.images`
  when the entry is logged, and `models/foodEntryMealRepository.ts` does the
  same from the meal template.
- Editing the food afterwards therefore does **not** change past entries.
  `POST /foods/update-snapshot` is the only thing that refreshes them, and it is
  opt-in — both clients ask "Update past entries?" after a save.
- Migration `20260814000000_backfill_diary_entry_images_from_parent.sql`
  backfilled rows logged before this behaviour existed. The photo an old entry
  was _originally_ logged with is unrecoverable — it was never stored — so the
  backfill stamps the parent's current image. It freezes history going forward
  rather than restoring it.

### Telling an inherited photo from a diary-set one

Both live in `food_entries.images`, so they are distinguished by upload
directory rather than a flag. `finalizeUploadedImages` writes
`/uploads/<domain>/<entityId>/<file>`, so:

- `/uploads/foods/…` (or a remote provider URL) — inherited at log time. A sync
  may refresh it.
- `/uploads/food_entries/…` — the user chose this photo for this entry. A sync
  must never touch it.

`updateFoodEntriesSnapshot` in `models/foodMisc.ts` encodes exactly that with a
`NOT EXISTS … LIKE '/uploads/food_entries/%'` guard. If upload paths are ever
restructured, that guard has to move with them.

### Deleting images that history still uses

Because entries store the food's path rather than a copy of the file, dropping
an image from a food would delete a file past entries still render.
`removeOrphanedImages` checks `food_entries` / `food_entry_meals` for the path
first and keeps the file when it is still referenced — and keeps it on any error
too, since an unreferenced file on disk is cheaper than a broken thumbnail in
someone's history.

Food _deletion_ was already safe: the food is either hard-deleted along with its
entries, or hidden (`is_quick_food`) with its row and images intact.

## Gotchas

- **Search a branded product, not a dish.** "chicken pasta" returns generic entries that have no photo on any provider. Use `nutella`, `oreo`, or a specific packaged item to actually exercise the image path. Absent images there mean the food has no photo upstream, not that something is broken.
- **Restart the server** after changing provider code — integration services are server-side.
- **`NormalizedFoodSchema` strips undeclared keys.** Adding a new image-ish field to a mapper without declaring it in the schema means it will never reach the client.
- Local uploads are stored server-relative (`/uploads/foods/<id>/...`); provider images that failed to download stay absolute. `resolveFoodImageSrc` in the frontend handles both.
