# Serving sizes: selection on Food details, editing on Edit Food (plan, 2026-09-29)

Scope: the mobile food details screen (`FoodEntryAddScreen`) and the Edit Food screen (`screens/foodForm/EditFoodMode.tsx`), using the two supplied mockups as functional references. The mockups' foods, figures and copy are illustrations. X on Track visual language (`DESIGN.md`) wins over their styling.

**Revisions (2026-09-29):**

1. There is no user-facing default serving: no Default toggle and no single-default constraint.
2. There is no "100 g row".
   - **Details screen:** two input fields, an amount and a unit/serving size, with grams as the default unit. The quick-add options sit below them, in addition.
   - **Edit Food:** the serving list holds only the saved portions. Grams (and ml for liquids) are always available and are not rows.
3. The last-used serving (amount and unit) is stored per user and food. It is the first quick-add suggestion.

## 1. Where we start

- `food_variants` is one row per serving. Each row stores its **own full nutrition** for `serving_size` × `serving_unit`. It also has `is_default`, `source` and `ai_confidence`. There is **no label**, **no gram/ml weight** and **no sort order**.
- Equivalence ("1 cup = 245 g") is **inferred** on the client from proportional nutrition (`groupEquivalentVariants` in `utils/foodDetails.ts`).
- Readers everywhere use the variant's stored nutrition, and many use `is_default = TRUE` to pick the food's canonical nutrition row: search, library, meal builder, reports, MCP and import.
- `food_entries` are snapshots. They hold `quantity`, `unit`, `variant_id`, `serving_size` and `serving_unit`. There is no `(user_id, food_id)` index, so "last used" should not be derived from the diary on every open. Deleting an entry would also lose it.
- Foreign keys: `meal_plan_template_assignments.variant_id` is **ON DELETE CASCADE**. `meal_foods`, `meal_plans` and `user_water_containers` are SET NULL.
- Edit Food manages a single active variant plus "equivalent" drafts through per-variant create/update/delete calls, with no transaction. The details screen has a gram-first stepper, a variant picker, quick amounts and compact nutrient cards.

## 2. Mockup → behaviour

### Food details

- The header shows the name, the food group and a macros row for the current amount and unit.
- The **Serving size** input is two fields.
  - **Amount:** a numeric input.
  - **Unit/serving size:** a dropdown whose default is **Grams**. It lists grams (plus ml for liquids), then the saved portions ("Medium (130 g)").
  - The mockup's "Amount per serving" caption is not used.
- **Add to Diary** logs amount × unit, with a date · meal · time row.
- **Quick add** sits below and in addition to the two fields. Each row has a **+** that logs it immediately:
  1. **Last used:** amount and unit from the last time this food was logged, e.g. "Last used · 150 g" or "Last used · 2 × Medium (260 g)".
  2. **Saved portions** in the user's list order: label, weight, kcal and F/C/P, logged as one portion.
- **More options** collapses the nutrient cards, alternatives and the rest.

### Edit Food: "Serving sizes" card

- Rows are saved portions only. Each row: drag handle · **Label** · **Amount** · **Unit** · **Grams** (or ml) · delete.
- There is no Default toggle and no 100 g row. Every row can be deleted, and "+ Add serving size" adds one.
- **Serving preview:** a chip for the nutrition basis ("100 g", "1 serving", "1 bar"…) plus each portion, then Calories/Protein/Carbs/Fat for the selected chip. The note reads "Nutrition values are per 100 g", or whatever the nutrition basis is.
- **Additional information** links to the full nutrition values (the basis), category and notes.

## 3. Data model (one migration)

### 3a. Serving portions (`food_variants`)

Recommendation: **persist** the label, weight and order. The mockups need names like "Medium", a gram weight for every portion and a stable order, and inference cannot give these reliably.

| Column          | Type                         | Rule                                                                     |
| --------------- | ---------------------------- | ------------------------------------------------------------------------ |
| `serving_label` | `text NULL`                  | trimmed, 1–40 chars, e.g. "Medium", "Slice"                              |
| `metric_amount` | `numeric NULL`               | `> 0`; weight/volume of one serving                                      |
| `metric_unit`   | `text NULL`                  | `'g' \| 'ml'`; set together with `metric_amount` (CHECK both-or-neither) |
| `sort_order`    | `integer NOT NULL DEFAULT 0` | order of portions in the editor and in quick add                         |

- **Nutrition basis:** the internal row whose nutrition is edited under _Additional information_, normally per 100 g.
  - It stays the `is_default = TRUE` row, so every existing reader keeps working.
  - It is **not shown** in the serving list and is never offered as a "portion".
  - Grams and ml come from the basis's metric amount.
- **Portions:** the other rows.
  - With a metric weight, the server **derives** their nutrition on save as `basis × metric_amount / basis.metric_amount`. That way diary logging, search, reports, MCP and web read correct per-row values unchanged.
  - The formula is one helper, `deriveServingNutrition` in `@workspace/shared`, used by the server and by both clients' previews.
- **Legacy rows** with their own non-proportional nutrition (older imports) stay unchanged. They show an "Own nutrition" tag, unless the user enters a weight and accepts that "Nutrition will be recalculated from 100 g".
- **Basis without a weight** (e.g. only "1 bar"):
  - The details screen defaults to that serving instead of grams.
  - The editor asks for "Weight of 1 bar" to unlock grams.
  - It never guesses.
- **Backfill (idempotent):**
  - Rows in `g`/`ml` get `metric_amount = serving_size` and `metric_unit = serving_unit`.
  - `sort_order` follows `created_at`.
  - Nothing else changes.
- **Constraints:** no default constraint and no repair of existing defaults.

### 3b. Last-used serving (`food_last_servings`, new table)

| Column                         | Type                   | Rule                                                                              |
| ------------------------------ | ---------------------- | --------------------------------------------------------------------------------- |
| `user_id`                      | `uuid NOT NULL`        | diary owner; FK users ON DELETE CASCADE                                           |
| `food_id`                      | `uuid NOT NULL`        | FK foods ON DELETE CASCADE                                                        |
| `quantity`                     | `numeric NOT NULL`     | `> 0`                                                                             |
| `unit`                         | `text NOT NULL`        | as logged (`g`, `ml`, or the portion's unit)                                      |
| `variant_id`                   | `uuid NULL`            | FK food_variants ON DELETE SET NULL                                               |
| `serving_label`                | `text NULL`            | snapshot, so the suggestion still reads well if the portion is renamed or deleted |
| `metric_amount`, `metric_unit` | nullable               | snapshot of the portion weight                                                    |
| `used_at`                      | `timestamptz NOT NULL` |                                                                                   |

- **Keys:** primary key `(user_id, food_id)`, one row per user and food.
- **Why a table and not the diary:** it is a direct, indexed read, it survives deleting the entry, and it doesn't scan `food_entries`.
- **RLS:** mirrors `food_entries`, with `has_diary_read_access(user_id)` for select and `has_diary_access(user_id)` for writes. A family member logging on someone's behalf updates that person's last serving. Security tier: same as `food_entries`, recorded in `database-security-tiers.md`.
- **Migration checklist:** follow the full eight-step `new-migration` checklist (RLS, `shared/src/schemas/database/FoodLastServings.zod.ts`, API contract, sharing/security docs, downstream clients, boot and upgrade the demo database).

## 4. Server

- **New endpoint `PUT /api/foods/:foodId/servings`.** It saves the portion list in one transaction. Its contract goes in `shared/src/schemas/api/FoodServings.api.zod.ts`.
  - **Request:** `{ servings: [{ id?, serving_label, serving_size, serving_unit, metric_amount, metric_unit, sort_order }], deleted_ids: [], confirm_cascade?: boolean }`.
  - **Rules:**
    - Food owner only (403 otherwise).
    - The basis row cannot be sent or deleted through this endpoint.
    - Sizes must be positive and use the allowed unit vocabulary.
    - `(serving_size, serving_unit, label)` must be unique per food.
    - At most 20 portions.
  - **Writes:** delete, then upsert with derived nutrition and `sort_order`, all through the user-scoped RLS client.
  - **Delete guard:** returns 409 with a count when a deleted portion is used by meal-plan template assignments (cascade). The client confirms and resends. Diary entries are snapshots and are unaffected.
- **Last used:**
  - **Write:** upserted in the **same transaction** as user-initiated single-food entry creation and updates. Those are the mobile/web add and edit paths, quick add, and the MCP log tool. It is **not** written by bulk import, meal/preset expansion, Health sync, copy-day or meal-plan scheduling, which would otherwise overwrite a deliberate choice.
    - An entry update refreshes the row only when amount or unit changed.
    - A delete leaves the row alone.
  - **Read:** `GET /api/foods/:foodId/last-serving`, which returns `null` when there is none. Contract: `shared/src/schemas/api/FoodLastServing.api.zod.ts`. It is also batched as an optional `last_serving` field on the existing food-detail read if that avoids a second round trip on mobile. That decision is made during implementation, after reading the detail query.
- **Existing `/food-variants` routes:** unchanged apart from accepting and returning the new columns and sorting by `sort_order`. Provider imports map `serving_description`/weight to `serving_label` and `metric_amount`/`metric_unit` where supplied.
- **Tests (vitest):**
  - Servings service: derivation, order, basis protection, 409, 403.
  - Last-used: upsert on create and update, no write from bulk or meal paths, RLS scoping, SET NULL behaviour on portion delete.
  - Route contracts.
  - Migration upgrade test for the backfill.

## 5. Mobile: Edit Food

- **Editor component.** A new `components/foodForm/ServingSizesEditor.tsx` replaces the "equivalents" section. Name, photo and food group stay at the top. The basis nutrition moves under **Additional information → Nutrition values**, with a "per 100 g" caption and the amount/unit of the basis editable there.
- **Rows:**
  - Label and amount are text fields.
  - Unit uses `FoodUnitSelectorSheet`.
  - Grams/ml is editable for non-metric units and read-only for g/ml.
  - Delete confirms when the row is used by plans.
  - Drag to reorder (reanimated/gesture-handler, already installed), with move up/down accessibility actions. The order is the quick-add order.
  - Every target is at least 44 pt, and rows wrap at large text.
- **An empty list is valid.** It shows "No saved portions. Add one to log it with one tap."
- **Draft state:**
  - One `servingsDraft` array plus a baseline replaces `equivalentDraft`/`equivalentBaseline`/`pendingUnitSelection`.
  - The discard guard covers content and order.
  - **Save** saves the food, then calls `PUT …/servings` once.
  - Errors appear on the row that has the problem.
- **Preview:** a chip for the basis and each draft portion, with tiles computed through `deriveServingNutrition` from the draft. The note names the basis. An own-nutrition row shows its stored values.
- **Invalidation:** the full family.
  - Food detail and variants, library search and counts, templates and meal builder.
  - `dailySummary`/`dailyProgress`/`foodEntries`, plus the last-serving query for the food.
  - Use the existing helper.

## 6. Mobile: Food details

- **Two-field input**, replacing the stepper row:
  - **Amount:** a numeric field with a decimal keypad and locale-aware parsing.
  - **Unit:** a dropdown built by one `buildServingOptions(basis, portions)` helper in `utils/foodDetails.ts`. It lists Grams (plus ml for liquids), then portions in list order.
  - **Initial state:**
    - Opened with a specific entry or variant (edit entry, meal, search result carrying a serving): its amount and unit.
    - Otherwise: **Grams**, with the amount set to the basis amount (normally 100). If the basis has no weight, its own serving, amount 1.
    - Last used does **not** prefill the fields; it is the first quick-add row.
  - **Unit change** converts the amount through `metric_amount` when both sides are known (130 g → 1 Medium). Otherwise it keeps the amount and recomputes.
- **Macros row** in the header plus the compact nutrient cards follow the two fields live. The cards and the rest move into **More options**, keeping their testIDs.
- **Quick add** below the fields. Each **+** logs through the existing add-entry mutation to the current date and meal:
  1. **Last used** first, when present: "Last used · 150 g" or "Last used · 1 × Medium (130 g)". If its portion was deleted, the stored label and weight snapshot are logged as grams where possible. Otherwise the row is hidden.
  2. **Saved portions** in list order. A portion identical to the last used entry (1 × the same portion) appears only once, as last used.
  - Rows show kcal and F/C/P for exactly what will be logged.
  - Every quick add shows a toast with **Undo**, which deletes the created entry.
  - The **+** is disabled while that write is pending, to prevent double logging.
  - The generic quick-amount chips (`buildQuickAddPresets`) are removed. Last used and portions replace them.
- **Last used locally:**
  - A successful add or edit (including offline outbox saves) updates the cached last-serving query optimistically, so it is right before the server confirms.
  - Invalidation after a sync reconciles it.
  - The server remains the source of truth across devices.
- **Offline:** unchanged outbox behaviour. Quick add uses the same action.

## 7. Web

- **In this batch:** read-side support.
  - `FoodUnitSelector`/`VariantCard` show `serving_label`, the weight and list order.
  - Web entry creation also updates the last serving, which happens on the server with no web code change. That is verified in a web test via the API mock.
- **Follow-up batch:** web Edit Food list editor and a web details view with the two fields and last-used/portion quick add, reusing the same endpoints and helpers.

## 8. i18n, accessibility, visual review

- **i18n:** English keys only: `foodForm.servings.*` and `foodEntryAdd.servings.*`/`foodEntryAdd.quickAdd.*` in mobile `en`, plus the web `en` label/weight text. Run the i18n audit.
- **Accessibility labels:**
  - Amount field: "Amount".
  - Unit dropdown: "Unit, Grams".
  - Portion row: "Serving 2 of 5, Medium, 130 grams".
  - Quick-add button: "Add last used, 150 grams, 90 kilocalories".
  - Reorder actions.
- **Fixtures:** in `review/nutritionFixture.ts`, add synthetic foods with 5 portions, legacy own-nutrition rows, no portions, and a weightless basis. Include a last-serving response and handlers for `PUT …/servings` and the last-serving route.
- **Captures** at 430 and 375 pt, dark and light, before and after:
  - Details: grams default, unit menu open, quick add with a last-used row, undo toast.
  - Edit: portion list, row editing, reorder, empty list, validation, discard dialog.
  - Record them in `docs/implementation/serving-sizes-2026-09-29.md`.

## 9. Delivery order (branch `feat/serving-sizes` from local `main`, not the busy `/private/tmp/xot-progression` checkout)

1. **Shared:** variant schema fields, the `FoodLastServings` schema, API contracts, `deriveServingNutrition`, and tests.
2. **Server:** migration (variant columns plus `food_last_servings` with RLS), servings endpoint, last-serving write paths and read route, route/import updates, and tests. Run `validate` and `test:ci`, then boot and run the upgrade on the demo database. Update the security-tier and database docs.
3. **Mobile Edit Food:** `ServingSizesEditor` and the `EditFoodMode` integration, with tests (reorder persisted, empty list, delete guard, discard guard, single save call, invalidation).
4. **Mobile Food details:** `buildServingOptions`, the two-field input, quick add (last used first, dedup, undo, double-tap guard), optimistic last serving, More options, with tests.
5. **Web:** read-side labels and order, plus the last-used write check. Run `validate` and `jest`.
6. **Review:** fixtures, iOS review runs, implementation record.

Each step is its own commit. Mobile validate and jest, server validate and `test:ci`, and web validate and jest pass before the next step.

## 10. Decisions taken (change before step 2 if you disagree)

- **Persist the label and weight on the portion.** The server derives each portion's nutrition, so readers don't change.
- **No default, no 100 g row.** Grams/ml come from the internal nutrition basis, which is hidden in the list. `is_default` stays only as that internal marker.
- **Grams is the default unit** on details. Last used is offered as the first quick-add row, not prefilled into the fields.
- **Last used lives in its own table**, one row per user and food. It is written in the same transaction as single-food logging and not by bulk, meal or sync paths.
- **Quick add logs immediately, with undo.**
- **Web editor/details parity is a follow-up.**

## 11. Risks

- **Legacy non-proportional rows:** shown as "Own nutrition" and never silently recalculated.
- **Deleting a portion drops meal-plan template assignments** through the cascade. Mitigation: 409 plus confirmation.
- **Last-used rows can point to a deleted portion:** the snapshot label and weight keep the suggestion meaningful, and the row is hidden if it can no longer be converted.
- **Missing a write path:** the chosen write paths are covered by tests, as is the absence of writes from bulk/meal/sync paths.
- **A basis without a weight** can't offer grams. Mitigation: the details screen falls back to the basis serving, and the editor prompts for the weight.

## 12. Foods without per-100 g values

Nutrition is stored per serving row, so the basis is often **not** 100 g:

- Recipe imports (Norish, Tandoor, Mealie) always store `1 serving`.
- The mobile create/edit forms fall back to `serving` when no unit is chosen.
- FatSecret, Nutritionix and Yazio can store a per-serving basis. FatSecret often supplies a metric weight alongside it (`metric_serving_amount`).
- AI estimates, photo logs and manual entries such as "1 bar" or "1 slice".

Consequences for this batch:

- All copy says "per {{basis}}", never a fixed "per 100 g". Grams/ml are offered only when the basis has a known metric weight (backfilled from `g`/`ml` units, from a provider's metric serving where available, or entered by the user).
- Without a weight, the details unit defaults to the basis serving, amount 1. Portions can still be added in the same unit family, e.g. "½ serving", or once the user enters "1 serving = 350 g".
- Importers that know the metric weight fill `metric_amount` on import. Nothing is converted or rescaled; the stored values stay per their original serving.
