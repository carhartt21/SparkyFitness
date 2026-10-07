## verdict

The final 39-image packet passes the evidence gate. This round scores only the remaining parts of original fixes 1 and 8; fixes 2–7 retain their resolved round 1 scores. The updated contact sheets, full-resolution ordinary Home captures, current `hero-repro.png`, supplemental native hydration capture and scoped source support the verdict. No new audit or detector was run; the HTML/CSS detector is inapplicable to this native React Native interface.

1. **Resolved — Home density and checkpoint.** Both `390-de-dark-v45-home-top.png` and `390-de-light-v45-home-top.png` now show the complete Training card and all four logging tiles, including every label and tile frame, above the tab bar in the initial viewport. The compact Daily Progress heading remains readable above the continuous X; its four category rows and count remain present. The calorie gauge and plain intake/allowance line remain intact. `DashboardSummaryCard` confines the compact heading to ordinary text size, retaining the stacked enlarged-text layout and 44-point row targets. The refreshed `hero-repro.png` matches the final Home composition.
2. **Resolved, retained — Hydration focal geometry.** The centered cyan daily gauge and readable enlarged-text presentation remain closed from round 1.
3. **Resolved, retained — Enlarged-text reflow.** The complete meal header, literal food name, macro labels, Add Food action and plain calorie values remain closed from round 1.
4. **Resolved, retained — Unknown calorie goal.** Finite positive goal gating and explicit unset-target presentation remain closed from round 1.
5. **Resolved, retained — Template draft eligibility.** Missing-variant ingredients follow the explicit unresolved path; resolved recorded ingredient snapshots remain preserved.
6. **Resolved, retained — Future-date shortcuts.** Account-timezone day checks and mutation callback guards remain closed from round 1.
7. **Resolved, retained — Unavailable data.** Explicit uncached offline history unavailability and incomplete training-data handling/retry remain closed from round 1.
8. **Resolved — Icon roles and native targets.** `HydrationHistory` now uses `--color-accent-primary` for supplement records, matching the Diary supplement role. Its defined values are green in light, dark and AMOLED themes. The supplemental `390-de-dark-v45-hydration-supplement.png` visibly confirms the green glyph alongside the complete `500 ml`, `Elektrolyte`, `13:00` and `Supplement öffnen` record/action. Defined water cyan, explicit trash color and the previously corrected 44-point HabitRow controls remain intact.

## remaining

No material UI correction remains among the original eight scored fixes. No correction-batch regression was established within this bounded verification. This ship disposition covers these scored fixes only; it does not authorize merge, release or deployment.

Persistence remains contingent on the already-assigned final DESIGN/documentation handoff, replacing outdated incumbent Home and hydration descriptions with the final implemented contract and linking this evidence. That bounded documentation work does not reopen the UI review.

disposition: ship
