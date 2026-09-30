# Serving sizes UI follow-up (2026-09-30)

Branch `feat/serving-sizes-ui`, based on `origin/main` at `9fa073ef0`. The serving-sizes batch ([`serving-sizes-2026-09-29.md`](serving-sizes-2026-09-29.md)) had merged correctly. This batch changes three things:

- The food details pencil now opens Edit Food.
- Both screens move towards the owner's mockups.
- The amount becomes a vertical spinner.

Visual targets:

- `x-on-track-design/references/05_food_details_serving_size.jpeg`
- `x-on-track-design/references/06_edit_food_serving_sizes.jpeg`

## Changes

**Food details (`FoodEntryAddScreen`)**

- **Pencil:** for a saved food the signed-in user owns, the header pencil opens Edit Food (name, photo, serving sizes, nutrition). Other foods, external foods and picker modes keep the per-entry adjustment. When the pencil opens Edit Food, "Adjust this entry only" is under More options.
- **Add serving sizes:** an owned food without saved portions shows an "Add serving sizes" row in the Quick add card that opens Edit Food. The food's own nutrition serving does not count as a portion.
- **Layout, as in the reference:**
  - A plain kcal · Fat · Carbs · Protein row with dividers replaces the tinted tiles. The goal share is still spoken, but not shown.
  - "Serving size" and "Amount per serving" labels sit above the outlined fields.
  - An outlined "+ Add to Diary" button (picker modes keep "Add Food").
  - A date · meal · time pill that expands the existing date, time and meal controls.
  - A separate Quick add card with "Saved portions" and outlined + buttons; rows read "25 kcal – 0 g F, 3 g C, 1 g P".
  - A separate More options card (nutrient breakdown and entry actions). The entry note stays below it.
- **Amount spinner (`components/AmountWheel.tsx`):**
  - Snaps to 5 g/ml steps for grams and to quarters for portions. The current value is kept when it is off the grid.
  - A long press, or the VoiceOver "Enter amount" action, opens a number field.
  - VoiceOver can also step the amount up and down.
  - The spinner is pure JS; there are no new native dependencies.

**Edit Food**

- **Header:** Cancel / Edit Food / a Save pill. The pill is an opt-in `pill` style for primary header items on the custom header path; the native header keeps its text button.
- **Top row:** a cover photo tile with an edit badge (new `cover` variant of `FoodImagePicker`), beside Name and Brand.
  - The reference's Food Group field is not built: foods have no stored category.
  - The app's food-group guess is only used for artwork and must not be shown as data.
- **Serving sizes card:**
  - Rows are edited inline: Label, Amount, Unit, Grams (read-only for g/ml), and a red trash icon. Drag handles reorder them.
  - An outlined "+ Add serving size" button.
  - Problems are listed under the rows.
  - The reference's Default toggles and "100 g" row are deliberately left out.
- **Serving preview card:** a serving pill (picker) and tinted Calories / Protein / Carbs / Fat tiles.
- **Additional information:** the nutrition form and notes fold into this row, as in the reference.

**Also**

- **Shared helper:** `utils/editFoodRoute.ts` now builds Edit Food's parameters for both the library food screen and food details.
- **German:** about 40 machine-translated strings on the adjust and edit screens were rewritten in the overlay (e.g. "Nährwerte für diesen Eintrag", "Für künftige Einträge speichern", "Name des Lebensmittels").
- **iOS review:**
  - The tour reaches Edit Food from the details pencil.
  - The logging flow long-presses the spinner.
  - The serving sheet row is tapped by position, because the harness does not reliably expose it as an element.

## Validation

| Check                                                                                           | Result                                                                                                       |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Mobile `validate` (i18n, German completeness and copy audit, tsc, lint, Knip, Prettier)         | pass                                                                                                         |
| Mobile Jest                                                                                     | 7396 passed, 1 failed: `DiaryCalorieMacroSummary › swaps to Net Carbs`, which also fails on unchanged `main` |
| iOS tour `430-en-dark --interactions --tour`                                                    | passed                                                                                                       |
| iOS logging flow `430-en-dark --interactions` (spinner long press, type 200, add, edit, delete) | passed                                                                                                       |

Captures, synthetic fixture, English, dark, 430 pt, are in `x-on-track-design/review/serving-sizes-ui-2026-09-30/`.

## Differences from the references that remain

- **Details hero:** no hero photo and no "Whole food"/"Natural choice" labels. The food has no stored category, and the "Good Food / Brighter You" copy is illustrative.
- **Food details header:** it keeps the pencil next to the favourite star.
- **Edit Food identity row:** it shows Brand instead of Food Group.
- **Not captured:** light theme, German, narrower widths and large text. Physical-device checks are still open.

## Second pass against the details reference

- **Photo area:** foods without a photo show their category artwork as a hero banner. It is display-only, as before, and replaces the small thumbnail. The title uses the reference size.
- **Amount spinner:** it is now a single-value field the same height as the unit field, with an up/down hint. Swiping spins the value; a long press types it.
- **Edit Food:**
  - The preview tiles put the icon beside the value, as in the reference.
  - The row field text is vertically centred.
  - The name field is labelled "Name".
- **Captures:** side-by-side comparisons are `compare-food-details.png` and `compare-edit-food.png` in the review folder.

## Third pass against the Edit Food reference

- **Photo tile:** without a photo, the tile shows the food's category artwork dimmed, with "+ Add photo". It is display-only and never saved.
- **Serving rows:** trash icons use the danger icon red, and rows are more compact (88 pt, 14 pt field text).
- **Cancel:** it keeps the header's standard text colour. The shared header enforces one accent and neutral navigation actions on every screen, so the reference's muted Cancel is not copied.

## Fourth pass (owner feedback)

- **Macros:** the values use the app's macro colours again, with the share of today's goal under each ("No goal" without a target).
- **Pinned photo:** the photo, or the category artwork, stays pinned behind the cards. As the cards scroll over it, it shrinks (to 86 %), moves up slightly and fades. Pulling down past the top enlarges it.
- **Top card:** the glow is stronger (accent border and outer glow), and the text sizes are one step smaller.
- **Unit picker:** it is now a dropdown (`UnitDropdown`, built on `AnchoredMenu`) that opens right over the field instead of a bottom sheet.
- **Amount spinner:** you now drag it directly (`PanResponder`).
  - Dragging up or down moves one step per 14 pt, showing the neighbouring values and firing a selection haptic.
  - It blocks page scrolling while dragging.
  - A long press still opens the number field.
- **Add to Diary:** it uses the app's primary `Button` (filled accent pill with the plus icon) and glows in the glow theme.
- **Edit Food:**
  - The photo tile stretches from the Name label to the bottom of the Brand field.
  - Section titles, subtitles, tile values and the preview pill are one step smaller.
- **Serving rows:** they keep the bottom-sheet unit list, because the full unit catalogue is too long for a popover.
