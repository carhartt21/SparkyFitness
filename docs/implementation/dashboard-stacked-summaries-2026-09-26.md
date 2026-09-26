# Stacked Dashboard hydration and exercise

The user's device screenshot showed hydration container choices and a quick-add drink extending the hydration card far below the adjacent exercise card. The previous paired layout aligned only its core metrics/actions and could not accommodate this variable content.

The Dashboard now stacks Hydration followed by Exercise at full available width on every phone size. Each card grows with its contents; no fixed equal-height spacer or clipped preset list is used. Both use the same bordered surface, 16-point corners, 12-point padding and 12-point bottom spacing. Expanded headers preserve separate Details links; all existing water, container, preset and exercise actions remain wired. This deliberately departs from the reference's paired cards as authorized by the user.

The simulator fixture adds German390 and English430 hydration-options cases with Glass, Bottle and an Energy Drink preset. Fixture names are synthetic user content, so they are not app translations. The native review scrolls to Exercise after closing hydration details, reflecting the new vertical arrangement.

Verification and screenshot results are recorded in `evidence/dashboard-stacked-summaries-2026-09-26/`. Physical-device review, VoiceOver and backend persistence remain unverified by this synthetic simulator run.

The prior EAS monthly iOS quota blocker remains unresolved. No new cloud build is attempted for this correction; no billing settings or web deployment changed.

Verification: 24 focused Jest tests, TypeScript, ESLint and changed-file formatting passed. Final simulator matrix passed all four render checks: German390 and English430 with hydration options, German390 light, and German430 enlarged text. Both dark cases passed native interaction tests (date navigation, water +250 ml and refreshed summary, hydration details, exercise details and return). Light/enlarged cases are top-viewport render checks, not full-card interaction coverage.

The first fixture attempt failed because the new scenario was not included in the OCR expectation; the next interaction attempt exposed the unimplemented synthetic container-actions endpoint. Both test-harness gaps were corrected using the existing shared request schema and idempotent synthetic acknowledgements. The final results above are from the corrected fixture. Neither failure required changing application logging behavior.

Independent Impeccable review inspected the supplied device screenshot and both phone-size captures. It found the stacked layout resolves the reported defect and requested only a correction to stale paired-card guidance in DESIGN.md. DESIGN.md and its sidecar now match the implementation; the reviewer scored that fix resolved, with final disposition **SHIP** for this layout correction.
