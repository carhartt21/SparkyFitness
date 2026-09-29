# Serving sizes (2026-09-29)

Branch `feat/serving-sizes`, based on local `main` at `982d1d40f`. Plan: [`serving-sizes-plan-2026-09-29.md`](serving-sizes-plan-2026-09-29.md).

## What changed

**Data (migration `20260929120000_food_serving_portions.sql`)**

- `food_variants` gains `serving_label`, `metric_amount`/`metric_unit` (g or ml, both-or-neither) and `sort_order`.
- A trigger keeps the weight of rows measured in g/ml. It also reads provider units such as `slice (30 g)`, and clears a weight that was only derived from a metric unit once the unit changes.
- **Backfill:**
  - g/ml rows, and provider units that state a weight.
  - Older "equivalent unit" rows that carry exactly the same nutrition as one weighed row of the food.
  - Order: the basis first, then creation order.
- There is no default constraint and no repair of existing data. `is_default` stays an internal marker of the nutrition basis (the row the user edits).
- `food_last_servings` has one row per diary owner and food: quantity, unit, variant, and a snapshot of the label and weight. RLS follows the diary (`has_diary_read_access` / `has_diary_access`). It is documented in the security tiers, sharing and database docs.

**Server**

- **`PUT /api/foods/:foodId/servings`:** saves the portion list in one transaction.
  - It covers deletions, the basis weight, and each portion with its order.
  - Portions with a weight, or in the basis's own unit, get nutrition derived from the basis.
  - `derive: false` keeps a row's own values; a new amount in the same unit rescales them.
  - It returns 422 when a changed or new portion has no weight, 409 (`SERVING_IN_USE`, with a count) before removing portions that meal-plan templates use, and 403 for foods the user does not own.
- **`GET /api/foods/:foodId/last-serving`:** returns the last serving or `null`.
- **Last-serving writes:**
  - Hand logging (`foodEntryService.createFoodEntry`, which covers the diary route, photo completion and chat/MCP tools) records the last serving. So do edits that change amount, unit or variant.
  - The write is best effort: logging never fails because of it.
  - Bulk import, meals, copies and syncs do not write it.
- The variant repository reads and writes the new columns and lists variants in `sort_order`.

**Shared.** `utils/servingPortions.ts` holds `metricWeightOf`, `servingWeightOf`, `portionFactor`, `scaleServingNutrition`, `deriveServingNutrition` and `isDerivedFromBasis`. It also has the `FoodServings` API contract and the `FoodLastServings` schema.

**Mobile: Food details**

- **Serving size:** two fields, an amount and a unit.
  - A food opened fresh starts in **Grams** (or Milliliters) with the basis amount. A serving that was chosen explicitly is kept: an ingredient, an existing quantity, or an adjusted unit.
  - The dropdown lists grams, then saved portions in the user's order ("Medium pot (130 g)", "1 cup (245 g)").
  - A weighed basis without a gram row ("1 bar = 45 g") gets a grams option. It is logged against the basis row with serving overrides, and is not offered in meal or plan pickers.
- **Switching unit:**
  - To a portion, the amount starts at 1, with "245 g in total" underneath.
  - Back to grams, the amount converts exactly.
- **Quick add:** "Last used" first, then every saved portion. A portion equal to the last serving is not repeated. One tap logs it, and the toast says "Tap to undo" (deletes the entry).
- **More options:** the full nutrient breakdown moves here. External provider foods keep their previous portion list.

**Mobile: Edit Food**

- **Serving sizes card:**
  - Portion rows with drag handle and VoiceOver move actions, a summary (amount, weight, kcal, "Own nutrition"), and delete.
  - Tapping a row edits Label, Amount, Unit and Weight.
  - For a basis without a metric unit, the card asks for its weight.
  - A preview uses the unsaved form values; "Nutrition values are per 100 g".
- **Saving:** the form always edits the basis, even when opened from a portion. Save updates the basis, then sends one servings request (confirming a 409), and the discard guard covers the list.
- **Removed:** the equivalents section and the "overwrite or save as new variant" prompt.

**Web.** Serving labels show "Medium (130 g)" and "1 cup (245 g)". The unit selector carries the new fields and server order.

**Translations.** English source strings, plus German through `localization-overrides/de/mobile.json` and `scripts/apply-german-overrides.mjs`.

## Decisions made while building

- **A portion starts at 1.** The review showed 100 g converting to "0.41 cup" (100.45 g after rounding). Only conversions back to grams are exact.
- **Last-serving writes are best effort** and run after the entry commits, instead of in the same transaction as the plan said. That way a failed preference write cannot undo a logged entry.
- **The Serving sizes card sits between the nutrition card and the notes**, not above the nutrition as in the mockup, because the existing form is one card.
- **Undo removes the entry but not the last-used serving:** the suggestion stays at the undone amount.

## Validation

| Check                                                                                           | Result                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server `validate`, `test:ci`                                                                    | pass (434 files, 5181 tests)                                                                                                                                         |
| Server boot and migration on a copy of the demo database                                        | migrations and RLS applied, trigger/backfill checked in a rolled-back transaction, servings PUT (200 and 422), entry creation and last-serving GET checked over HTTP |
| Mobile `validate` (i18n, German completeness, tsc, lint, audit, Knip, native locales, Prettier) | pass                                                                                                                                                                 |
| Mobile Jest                                                                                     | pass (502 suites, 7373 tests)                                                                                                                                        |
| Web `validate`, Jest                                                                            | pass (161 suites, 1449 tests)                                                                                                                                        |
| iOS tour `430-en-dark --interactions --tour`                                                    | render smoke and native tour passed                                                                                                                                  |

## Visual evidence

In [`x-on-track-design/review/serving-sizes-2026-09-29/`](../../x-on-track-design/review/serving-sizes-2026-09-29/), synthetic fixture only, 430 pt English dark:

- **Food details:** `food-details.png` (grams default, last used), `food-unit-menu.png`, `food-details-portion.png` (1 cup, 245 g in total) and `food-details-lower.png` (quick add).
- **Edit Food:** `edit-food-servings.png`, `edit-food-serving-open.png` and `edit-food-preview.png`.

## Not done / open

- **Web editing parity:** the web Edit Food portion editor and web quick add are a follow-up. Web only reads the new fields.
- **Captures not taken:** light theme, 375 pt, German and large text. The tour selected "1 cup", so no capture of a labelled portion selected. The drag gesture itself was not exercised.
- **Real-data spot check:** the migration was checked on the demo database copy only. Spot-check the equivalent-row backfill on real data before rollout.
- **Not pushed:** nothing is pushed or deployed.
