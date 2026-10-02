# Widget visual target prompts

Concept reference only. Numeric values are synthetic. The artwork is not an implementation capture or a source for shipped logos, imagery, copy or widget capabilities. The final concept still includes a decorative routines illustration, divider lines and a different light energy color; these details are excluded from the native implementation. Lock Screen illustrations do not specify actual host dimensions.

## Initial prompt

```text
Use case: ui-mockup
Asset type: internal visual reference for X on Track native mobile widgets.
Primary request: Create one polished, practical design board refining the native Home Screen widgets in reference image 1. Use image 1 only as an incumbent UI reference, not an edit target. Preserve its tiny outline Progression X identity mark; do not invent a new logo.
Composition: portrait design board, no phone hardware, no OS status bars. On an almost-black backdrop show two columns: actual small square 158x158-point widgets and actual medium 338x158-point widgets at consistent scale. Two rows: Calories then Macros; a third row shows a medium Meal capture and a medium Routines widget; a bottom strip shows compact monochrome Lock Screen accessories. A narrow side swatch shows cream light-mode equivalents.
Style: crisp realistic SwiftUI typography, disciplined native layout. Values should be first in visual hierarchy, titles second, controls quiet but clearly tappable. Draw restrained rings alongside the primary numeric metric rather than crowding long explanatory labels inside a ring. Medium layouts use compact visual ring left and text values right, with one horizontal bottom row of camera, search, barcode controls, minimum 44-point height. Small layouts have no buttons and expose values, units and category labels clearly. Preserve exact nutrient colors, real native semantics, rounded corners.
Palette: dark card #08181e, raised action surface #10242b, backdrop #020c10, primary text #edf5f7, secondary #b4c8d2; green accent #14e89a, calories slate #b4c8d2, protein blue #57b9f8, carbs violet #b59cff, fat amber #f5b647. Subtle green upper-left corner wash, narrow soft ring halo. Light variant cream #fffdf8, primary #171c22, secondary #40554c and dark green #0b5e46. Lock Screen accessories purely monochrome.
Text verbatim: board title "X on Track · Widget refinement"; small annotations "Small", "Medium", "Light", "Lock Screen"; widget titles "Calories", "Macros", "Meal capture", "Routines". Calorie value "1,515", label "kcal left", stats "Goal 3,055", "Food 1,540", "Burned 255". Macro value "1,540", unit "kcal", stats "Protein 92 g", "Carbs 180 g", "Fat 55 g". Capture status "1 photo to review", actions "Meal photo", "Search food". Routine status "3 routines available", action "Open routines".
Constraints: synthetic values only, no health claims, no new features or invented data. No large neon backgrounds, glass effects, overbright button outlines, gradients on text, 3D logos or metallic texture. Feasible production UI, adequate text padding, not a promotional fantasy.
```

## Focused revision

```text
Use case: ui-mockup
Asset type: X on Track native widget layout reference, second version.
Edit target: the provided concept board.
Change the Calories and Macros numeric hierarchy in both Small and Medium: remove ALL numeric text and units from inside progress rings. Use a compact 44-point decorative ring at left, then a separate large bold number at right with its full label below it ("1,515" and "kcal left", or "1,540" and "kcal"). Rings must have hollow, empty centers. For small widgets, put the two or three stat rows underneath this metric row. For medium widgets, keep the title at top, compact ring plus number/label below on left and stat rows to their right; preserve the bottom 44-point camera/search/barcode button row. Make these medium cards 338:158 proportions and small cards square. Keep readable text, larger primary numbers than v1.
Remove the invented meal thumbnail and the decorative routine illustration from the capture and routine cards. Retain only the actual title, status and buttons. Lock Screen strip should show only meal camera and routine list monochrome accessories: remove Search accessory, which isn't a supported widget family.
Keep the exact color palette, small outline Progression X marks and restrained neon treatment of v1. Preserve all supplied numeric values and actual actions. Avoid adding new slogans, photos, features or controls. This is an internal feasibility reference, not an advertisement.
```
