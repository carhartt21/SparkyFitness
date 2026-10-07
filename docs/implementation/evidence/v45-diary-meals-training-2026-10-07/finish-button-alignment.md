# Phone button and Meals/Training finish review

Scope: the phone shared button theme and daily Meals/daily and weekly Training
alignment. Web and Watch were excluded by the owner's scope answer. The fresh
independent reviewer inspected both approved boards and all twelve required
dark/light/enlarged simulator captures, then sampled the shared components and
callers. No HTML/CSS detector ran for native code.

## Initial disposition: fix

The reviewer accepted the rounded-rectangle action material, compact energy/macro
table, native navigation and real-data semantics, and requested four corrections:

1. Stack Start/Record at enlarged text sizes so German words do not split.
2. Compact the weekly rows, inline recorded state and date/count metadata where
   it fits, and move Daily details beside Create plan after the itinerary.
3. Consolidate the expanded meal's local Add, Details and template actions into
   one ordinary-size footer, retaining 44-point icon targets and enlarged reflow.
4. Remove the meal-state button's surrounding rectangular frame, preserving its
   transparent 44-point target, cycling, long-press and disabled semantics.

The stale capsule design guidance was separately assigned to the final bounded
design-record refresh. This review did not assert that every changed phone screen
had been visually inspected.

## First verdict pass: fix

| Correction | Score | Evidence |
| --- | --- | --- |
| Enlarged Training actions | Resolved | Full-width labels remain complete. |
| Weekly compact rows | Partial | Seven day cards fit at normal size, but the newly paired German Daily details label breaks within a word. Enlarged footer was outside the capture. |
| Meal footer | Partial | Compact ordinary-size footer is visible; enlarged Save as template was outside the capture. |
| Meal status geometry | Resolved | State glyph is no longer enclosed by a second outline. |

The only introduced regression was `Tagesübersicht` splitting as
`Tagesübersich` / `t`. The reviewer requested a shorter visible label, keeping
the full accessible name, and complete enlarged meal/week footer captures.

The second bounded correction uses `Tagesdetails` as the visible label and
retains `Tagesübersicht` for accessibility. The native fixture tour now scrolls
the template and weekly actions into a fully visible area before capturing
them. This adds evidence rather than changing the production scrolling policy.

## Final verdict: ship at the scored-fix scope

| Correction | Final score |
| --- | --- |
| Enlarged Training actions | Resolved |
| Compact weekly itinerary and moved actions | Resolved |
| Consolidated meal footer | Resolved |
| Meal status geometry | Resolved |
| Introduced Daily details word break | Resolved |

The reviewer confirmed complete weekly footer actions at ordinary dark/light
and enlarged sizes, the complete reflowed enlarged meal footer, and the full
Daily details accessibility name. No findings or evidence gaps remained within
that bounded scope. This verdict approves these fixes only, not every changed
phone screen or hardware behavior.

The final three-case matrix passed render and interaction checks. A supplemental
enlarged tour re-framed both weekly actions after an initial screenshot clipped
the top of Create plan under the pinned date header; only the capture harness
changed. See [matrix results](aligned-simulator-results.json) and
[footer recapture results](aligned-footer-simulator-results.json). Thirty current
captures have the `aligned-` prefix and embedded synthetic-fixture provenance.
