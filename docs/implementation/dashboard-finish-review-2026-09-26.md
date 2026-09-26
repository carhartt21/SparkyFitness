disposition: ship

This ship verdict covers the three scored fixes, not the whole surface. The initial review below is retained as the pre-correction record; its open findings are superseded by the verdict at the end.

Inputs not supplied: a separately persisted Dashboard direction contract and QUALITY BAR card. The packet supplies the intended structure and brand; the reference is treated as a structural critique reference, with product truth and native accessibility taking precedence.

## persistence

Pass for product identity and review evidence; Dashboard design documentation remains due after corrections. `PRODUCT.md` defines X on Track / Keep getting better. The existing `DESIGN.md` explicitly documents Settings only, so it must not be represented as a Dashboard design record.

Inspected the user's original device screenshot, `before-390-de.png`, `reference-dashboard.jpeg`, all seven named scenario captures, and the six named middle/lower/food-search captures in [the evidence directory](evidence/dashboard-simulator-2026-09-26/). Required files are present and depict their stated surfaces. The error capture shows the final error and Retry state. The 430 pt middle and lower images show effectively the same bottom-of-content position; this is not evidence of two distinct additional states. `supportsTablet: false` makes the supplied iPhone classes appropriate for this bounded pass.

[results.json](evidence/dashboard-simulator-2026-09-26/results.json) reports seven passing render smoke checks and two passing native interaction runs. Its own limit is correct: synthetic read-only transport, with OCR proving render content rather than visual quality or persistence. The reported 7,215 passing tests were not rerun by this reviewer. No HTML/CSS detector ran because this is native React Native UI.

## fidelity

The reference's salient commitments are a brand/date header, a compact energy ring and adjacent statistics, four immediate logging actions, four macro rows, paired hydration/exercise summaries, a meal overview, and persistent navigation. These are the relevant structural commitments; its invented profile/bell, incorrect tagline, inconsistent arithmetic, decorative food images, and misleading completion ticks are not product requirements.

| Commitment | Assessment | Rendered evidence and basis |
| --- | --- | --- |
| Brand and date | Match | Approved X artwork, correct brand/tagline, localized date, previous/Today/next controls in both populated captures. |
| Energy and four actions | Match | Side-by-side ring/statistics and a single four-action row replace the baseline's tall ring and separate 2×2 action grid. |
| Arithmetic and truth | Acceptable adaptation | 600 consumed against a 2,000 base target yields 1,400 remaining; over-target capture reports 300 over rather than claiming success. Source keeps the server balance and exposes a nonzero allowance adjustment. |
| Macro structure | Acceptable adaptation | Four full-width labeled rows avoid the baseline's German label/value collisions. Two lines per row preserve readable native text; they do consume more height than the mockup's tightly packed single-line rows. |
| Hydration and exercise | Match with a craft defect | Paired summaries are visible after scrolling at both widths. Actual volume, goal, zero exercise, and explicit add/log controls replace decorative illustration. Selected container text fails contrast; see fixes. |
| Day overview | Acceptable adaptation | Real breakfast name and 600 kcal appear in the lower captures. Literal food names remain literal; the English fixture food name on the German screen is not itself a translation defect. No invented photos or completion status. |
| First-viewport density | Acceptable adaptation, bounded | The 430 pt view reaches the paired-summary headings; the 390 pt view reaches the last macro row. The reference fits much more information. This implementation improves the baseline significantly, but does not reproduce the reference's all-in-one-screen density. Preserving readable type and 44 pt controls justifies scrolling. |
| TYPE | Acceptable adaptation | System UI typography provides a clear heading/value/label hierarchy. Enlarged content reflows and omits the decorative ring. This is appropriate to the native Operate direction. The large-text Settings tab still truncates. |
| MATERIAL | Acceptable adaptation | Flat native surfaces and semantic icons avoid copying the mockup's decorative glass, bottle, food photography, or glow. Existing brand raster is visibly used. |
| GROUND | Match to supplied native direction | Dark/teal surfaces are consistent with the app's tokens. The light capture uses the established cream appearance. No exact mockup color match was promised. |
| Navigation | Acceptable adaptation with a defect | Existing Dashboard/Diary/Library/Settings destinations and Add action remain. The reference's Reports label would misname the real Library destination. Large-text German Settings is visibly ellipsized. |
| German localization | Dashboard improved; adjacent flow unresolved | Dashboard labels/date are coherent in the supplied captures. `390-de-dark-food-search.png` still shows “Suchen foods…”, “Select”, “Meal photo”, “Neu Ernährung”, and “Suchen für a Ernährung or meal to eintragen”. This is a confirmed unresolved issue on the next surface, not evidence that translation work is complete. |

## ceiling

The Dashboard now has the reference's task order and useful grouping. Its remaining opportunities are native finish and verification breadth, not additional decoration or a wholesale visual rebuild.

The current captures establish normal-size German/English, dark/light/AMOLED, empty, over-target, and error presentation. They do not establish VoiceOver traversal, increased contrast, keyboard use, gesture reliability, persistence, physical-device performance, or real-account data integration. The enlarged-text image only shows the upper energy card; it does not visually verify the quick actions, macro rows, hydration controls, or meal overview at that size. A future accessibility acceptance run should scroll through those lower regions.

The original physical-device image contains a numeric overlay. Neither the baseline simulator capture nor the current simulator captures reproduce it. `ProgressRing` explicitly sets `Canvas debug={false}` and uses Reduce Motion, but that source change plus clean simulator images cannot prove the physical-device issue is resolved. Retain an explicit real-device follow-up.

The pipeline is useful repeatable evidence collection. Its OCR gate checks a few expected values/phrases and selected English leakage; it does not detect all translation defects, contrast failures, clipping, or visual fidelity. The broken German search capture and truncated large-text tab demonstrate why human review remains necessary.

## material_fixes

1. **P1 — Correct the finite German strings exposed by the Dashboard Food action.** `390-de-dark-food-search.png` proves mixed or malformed copy in the search placeholder, Select action, Meal photo action, New Food action, and empty-state instruction. The user explicitly raised translation issues, so this directly reached logging surface belongs in the correction batch. Correct those semantic locale entries, preserve literal user food names, and recapture the German Food destination. A full search redesign and persistence validation remain outside this batch.
2. **P2 — Fix selected hydration-container text contrast.** `HydrationGauge.tsx` uses `text-accent-primary` on `bg-accent-primary/15`; dark tokens yield #11a67e over approximately #213f3d, or **3.67:1** for 14 pt text, below the 4.5:1 floor. The Standard/Default chip is visible in both middle captures. Use a readable semantic foreground while preserving selected-state distinction, then recapture the affected region.
3. **P2 — Keep the German Settings tab identifiable at large text.** `430-de-large.png` visibly renders “Einstellun…” despite `CustomTabBar.tsx` capping label scaling. Adjust the tab presentation so the full meaningful label remains readable without reducing the 44 pt touch target; recapture the same large-text viewport.

## keep

Keep the approved brand, correct energy balance, meaningful empty/error states, real meal content, four direct logging actions, localized Dashboard dates/numbers, readable native type, 44 pt controls, and the explicit distinction between simulator smoke evidence and complete product acceptance.


## verdict

Correction review: 2026-09-26. Reopened the same four affected evidence paths and inspected the narrowly changed source.

1. **Resolved — German food-search copy.** `390-de-dark-food-search.png` now shows a German search placeholder, “Auswählen”, “Mahlzeitenfoto”, “Neu anlegen”, and a coherent German empty-state instruction. The placeholder is naturally ellipsized within the native field at 390 pt; the mixed-language defect is gone.
2. **Resolved — Hydration selection contrast.** `390-de-dark-dashboard-middle.png` and `430-en-dark-dashboard-middle.png` now show Standard/Default in the primary text color while retaining the selected border and background. `HydrationGauge.tsx` confirms `text-text-primary`, which exceeds 4.5:1 against this selected dark background.
3. **Resolved — Large-text Settings label.** `430-de-large.png` shows the full “Einstellungen” label without ellipsis. The native fitting change keeps the existing touch area and full accessibility label.

No regressions attributable to this correction batch are visible in the reviewed captures.

## remaining

Clear for the three scored material fixes. This ship verdict covers the scored fixes, not the whole surface. The original verification limits remain: physical-device overlay resolution, lower-page large-text behavior, VoiceOver, persistence, and wider app localization were not established by this verdict pass.

disposition: ship
