disposition: fix

No separate quality-bar card or seeded five-block direction document was supplied; this review uses the caller's confirmed Operate/native refinement contract. No new-world concept roll is asserted. Not read in full: `workoutSession.ts`. Physical-device, VoiceOver, actual Hevy-account, and backend-persistence acceptance remain outside this fixture review.

## persistence

**Fail, pending final evidence and documentation.** `PRODUCT.md` exists. The two named approved comps and caller's confirmed answers establish the selection. All 39 required captures exist at 1170×2532 for 390-point dark/light and 1290×2796 for 430-point enlarged text; the replacement enlarged hydration-history capture now shows a complete timestamped water record and Delete action. The batched packet is valid. `.impeccable/review/hero-repro.png` exists but depicts the older September Home, old X artwork, and old tabs; it is not a V45 checkpoint. `DESIGN.md` still describes superseded Home ordering, activity rows, and hydration modal behavior; the caller has assigned its final update to the documenter after corrections. No HTML/CSS detector ran because these surfaces are native React Native.

## fidelity

| Salient comp element | Classification | Evidence / required adaptation |
| --- | --- | --- |
| Continuous canonical X, identity header, five global tabs | Match | Current captures retain the agreed artwork and navigation. |
| Home: Daily Progress, centered calories, Training, four logging actions | Contradicted in density | Order is correct in source, but both 390-point top captures end at calories with Training concealed by the tab bar; the approved first viewport presents Training and logging actions. |
| Calorie title goal-edit control and plain intake/allowance line | Match | No activity rows or extra metric panels beneath the gauge. |
| Native back/header treatment on daily screens | Adaptation | Existing native navigation and explicit iOS accessibility constraints authorize platform chrome rather than mockup-drawn headers. |
| Meals: energy summary, macro roles, collapsed groups, separate status, snapshot action | Match at ordinary text; contradicted at enlarged text | Enlarged captures show `Protei / n`, `Kohlen / hydrat / e`, `Frühstü / ck`, and the Add Food label `Le / b…`. |
| Diary: category cues and chronological Recorded before Planned | Match | Ordinary captures and `DiaryTimeline` retain actual clocks, untimed groups, independent meal status, and Recorded before Planned. Enlarged rows move clocks above content. |
| Training: recorded sessions before plans, daily actions, weekly destination | Match / adaptation | Existing WorkoutPlans flow and literal authored names are explicitly required; fixture metrics and mockup names are illustrative. |
| Weekly itinerary and selected-day disclosure | Match / adaptation | Seven dated selectors and selected-day records/plans are present; existing plan editor below the itinerary follows the required WorkoutPlans flow. |
| Hydration focal amount/goal gauge and logging controls | Contradicted | Approved comp has a centered cyan arc and center value; current captures show a horizontal rail and cup markers. The parent confirmed no user authorization for that geometry substitution. Preserve logger behavior while restoring the approved daily presentation. |
| Hydration source/history and details-only solid-food water | Match | Timestamped records, source actions, informational food water, and explicit unknown-water records are present. |
| TYPE | Adaptation, with reflow defects | Native system font and SF Symbols are explicitly allowed. Word chopping and action ellipsis at the requested accessibility size are not authorized adaptations. |
| MATERIAL | Match | Rounded native surfaces, restrained neutral glow, crisp vector X and native symbols retain the agreed material; genuine fixture food imagery is not replaced by decorative imagery. |
| GROUND | Match / adaptation | Dark retains the comp's deep blue-black field; light cream follows the explicit incumbent light-theme contract. |

## ceiling

**Not reached.** Operate finish is limited by ordinary Home density, the downgraded hydration focal region, fixed layouts under Dynamic Type, dark glyph contrast, and undersized habit controls. Native scrolling and header/date context remain coherent. Synthetic real-component navigation evidence supports the named fixture actions; it does not establish physical VoiceOver, motion, or production account acceptance.

## material_fixes

1. **Fidelity / first viewport:** Compact ordinary-size Home vertical composition so the Training summary and four logging actions are discoverable in the 390-point first viewport as in `approved-home-training.png`; reduce redundant gauge/card space rather than text or 44-point targets. Replace the stale `hero-repro.png` with a V45 native composition checkpoint and complete the already-assigned final DESIGN record.
2. **Fidelity / hydration focal region:** Add a dedicated daily presentation to the existing `HydrationGauge` that restores the approved centered cyan arc, central consumed value and goal relationship, with logging controls below. Keep actual sources, containers, pending/retry queues and server policy; use accessible reflow when enlarged text cannot fit the arc.
3. **Contract / Dynamic Type:** Reflow `DailyMealsScreen` actions and macro summaries, `FoodSummary` headers, and `CalorieRingCard` center content at the captured enlarged size. The meal name and primary action must remain complete words, macro labels must occupy usable columns or full-width rows, and `verbleibend` must not break before its final `d`; remove the fixed 144-point center constraint or omit the decorative arc at large sizes. Preserve full native text scaling and minimum targets.
4. **Truth / unknown goals:** `DailyMealsScreen.tsx:168` always labels the absolute balance remaining/over target, even without a valid goal, while only hiding the allowance. Gate the balance relationship on a known positive `calorieBalance.goal`; show intake and an explicit unavailable/unset-goal state otherwise. An intake-only day must never be presented as over target.
5. **Contract / reusable snapshots:** `diaryMealDraft.ts:9` accepts a known food snapshot without `variant_id` as resolved, but `MealAddScreen.tsx:455` then refuses to save it. Resolve that mismatch before navigation: either support the server-approved snapshot payload without a variant or put such entries through explicit ingredient resolution. The current helper test itself contains this unsaveable draft; successful template reuse must retain recorded quantity, serving basis and nutrition rather than silently reload today's library values.
6. **Truth / future-date recording:** `ProgressItemAction.tsx:72` and `:92` permit boolean/numeric habit writes for a future selected date although server Daily Progress treats future days as unknown. Guard recording controls and mutation callbacks for future days using the product's selected-day/timezone rule; keep detail navigation available. Apply the same conservative future-day policy to the new meal completion shortcuts so future plans do not become recorded evidence through a tap.
7. **Truth / unavailable data:** Inline `HydrationHistory` renders `query.isPending` as Loading even when its query is disabled offline with no cache; render an explicit unavailable/offline state instead. `TrainingSummaryCard` and `DailyTrainingScreen` also publish exact count/minute totals after mobility loading fails because they check loading but not error; distinguish known partial records from a complete total, and ensure Retry includes the failed mobility read. Do not introduce fallback zero totals.
8. **Native floor / contrast and targets:** `HydrationHistory.tsx:59` and `:61` reference undefined `--color-action-water` and `--color-exercise-accent`, making water/supplement glyphs black on the dark cards; use defined cyan and supplement-green roles, and explicitly color the trash icon. `HabitRow` decrement/increment widths are 36 points and its menu is 32 points with no hitSlop: enlarge or provide non-overlapping 44×44-point hit areas and let the numeric control group reflow.

## keep

Keep the canonical X, established themes and five tabs; real selected-day routes, chronological source clocks, independent recording/detail actions, literal names, snapshot nutrition, unknown states and existing offline queues must survive the correction batch.
