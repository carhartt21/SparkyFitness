# v48 Inbox corrective plan

Status: planning only, 9 October 2026. No application changes, task closures, merge, application build or deployment have been performed for this batch.

## Evidence and decisions

Reviewed all eight open Todoist Inbox tasks, their comments and subtasks (none). Seven tasks were added on 9 October and the navigation-affordance task on 8 October. This is the complete open Inbox scope returned by the connector, not a claim about every project or completed task.

Baseline: main `b396a4445308f905ab5d8cee9961af3cb66b93df`; v48 application release source `9013e18409df2d48488c76899b5b2423e0dab2f5`. Application sources were inspected in the existing release checkout. This planning checkout starts from main and does not include the separate production-retention branch.

The owner confirmed: **after logging food from Meals, return to the same meal, preserving the selected date and scroll position**. Do not return to Home or reset to today.

Attachment metadata was retrieved, but attachment URLs redirect to Todoist login. Screenshots have not been visually inspected. Exact Save-button location, overflow geometry and the pictured drag-dialog entry type must be reproduced before fixing those specific paths. Code observations below are distinguished from reported symptoms.

## Complete issue map

All tasks remain open until implementation and verification provide evidence.

| Stage | Priority | Finding and source                                                                                                  | Acceptance outcome                                                                                                                                                                                       |
| ----- | -------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | P1       | [Meal logging navigation](https://app.todoist.com/app/task/6hhxVVwWRJ9Gvxr7)                                        | Successful logging returns to the originating meal with its date and scroll position intact; cancelled or failed logging does not alter navigation or data.                                              |
| 2     | P1       | [Meal drag/drop](https://app.todoist.com/app/task/6hhxQqqgCfqc8rpf), including “Tap does nothing”                   | Eligible entries open on tap, have a discoverable move handle, and move between meal groups without accidentally opening a destructive menu. Unsupported moves have an explicit explanation or fallback. |
| 3     | P2       | [Missing meal thumbnail](https://app.todoist.com/app/task/6hhxRQGpPRP5H6Pf)                                         | The stored logged-meal image appears in the log, including existing logs, without replacing historical photos.                                                                                           |
| 3     | P2       | [Collapsed meal previews](https://app.todoist.com/app/task/6hhxW4f5W4Qhjg37)                                        | Collapsed meal groups show bounded item thumbnails while retaining readable time, state and nutrition information.                                                                                       |
| 4     | P2       | [Search and quick-add](https://app.todoist.com/app/task/6hhxRgfW32ChvP67), including Watch and preset-meal comments | Favorites use rolling four-week popularity, Watch receives the same food ordering, long custom-meal rows fit, and preset meals offer a separate quick-add action.                                        |
| 5     | P2       | [Supplement logging time](https://app.todoist.com/app/task/6hhxWxQrr6px8vQf)                                        | Manual supplement logging opens a time sheet with quarter-hour options and a freshly captured current-time default.                                                                                      |
| 6     | P2       | [Back affordance](https://app.todoist.com/app/task/6hhgWjfwCC2wWM6f)                                                | Leaving a screen is visually and accessibly distinct from changing the selected day.                                                                                                                     |
| 6     | P1       | [Save contrast](https://app.todoist.com/app/task/6hhxQG8M95Hgv2qf)                                                  | Save remains readable in enabled, disabled, pressed, keyboard-visible and saving states across supported themes. Reproduce and patch this early if it prevents logging.                                  |

## Target presentation

Keep the approved phone theme: rounded rectangular actions, translucent surfaces, restrained glow, existing semantic colors and typography. This is a corrective pass on Meals and shared controls, not a navigation or branding redesign.

- A collapsed meal shows its title/time, state and compact nutrition summary, followed by a small preview strip. Limit previews to three distinct logged items plus a `+N` indicator. Deduplicate preset-meal ingredients so a single logged preset is not shown repeatedly. Empty meals reserve no blank image row. At enlarged text sizes, move previews to a second line rather than squeezing text and controls.
- Expanded meal rows retain readable labels and thumbnails. An explicit edit/move action reveals handles and selection controls; a visible Move action provides a non-drag alternative. A normal tap opens details. Long press must not be the only way to discover editing.
- Search rows allocate bounded space to the thumbnail and quick-add action, allow the content column to shrink, and wrap secondary nutrition information when necessary. A long literal food/meal name must not push actions offscreen. Accessible labels retain the full name.
- The Back control communicates “Zurück”; the calendar strip communicates previous/next day. Both retain at least 44-point touch targets. Native headers remain native where currently enabled.

## 1. Restore the logging return destination

Confirmed: `DailyMealsScreen` opens `FoodSearch` with date and meal type only. `FoodEntryAddScreen` resets the stack with `popToTop()` after both food and preset-meal saves when no basket return depth is supplied. `FoodEntryMultiAddScreen` also resets the stack. This explains the Home return.

Implementation:

1. Add a typed, optional logging-origin context to the existing navigation params: originating route key, selected calendar date and meal type. Reuse the mounted origin screen rather than navigate to a new duplicate screen. Keep route params serializable; do not pass callbacks or copy a full meal into navigation state.
2. Propagate the context through search, item details, preset meals, multi-add and scan/photo paths that originate in Meals. Preserve existing basket return-depth and meal-builder selection behavior; those flows return to their own caller.
3. Centralize successful-log return handling instead of copying stack logic between food, meal and multi-add screens. If the origin is unavailable, fall back to the selected-day Meals screen, not Home/today.
4. Preserve the origin's date, expanded meal and scroll position through refetch. Do not clear query data or remount the whole screen to show the new entry. Update the originating group without scrolling to the top.
5. Retain existing mutation and cache-invalidation helpers for nutrition, hydration, recent/favorite lists and Watch snapshots. A successful write followed by a refresh error must not encourage duplicate logging.

Acceptance: single food, provider food, preset meal, multi-add, scan/photo and historical-day logging return correctly; cancellation and save failures remain on the appropriate screen. Other entry points and meal builders retain their existing behavior.

## 2. Make meal moves discoverable and functional

Confirmed: `SwipeableFoodRow` already contains a drag handle, but it requires selection mode and both selection/drop callbacks. `FoodSummary` suppresses those callbacks for meal components, plan-template entries, captures, non-manual sources and pending entries. When no selection callback exists, long press opens an adjustment/delete alert. Drag currently moves entries **between meal groups**, not persisted order within one meal.

Implementation:

1. Reproduce the reported entry type and tap/long-press behavior. Test ordinary food, provider food, preset components, photo captures and pending/imported entries. Distinguish a read-only restriction from a broken tap.
2. Define one capability decision for open/select/move and use it in Diary and Meals. Remove accidental blanket exclusions only where the server's existing bulk-action contract supports the operation. Preserve provider/import protections and immutable snapshot semantics.
3. Expose edit/move mode visibly and render eligible handles consistently. Attach the pan gesture to the handle; keep row tap, selection, swipe-to-delete and the context menu separate. On cancelled drag, restore the row without a mutation.
4. Reuse `useDiaryFoodEditing`, `useFoodDragScroll` and `applyBulkFoodEntryAction`; preserve selection, source metadata, nutrient snapshots and parent-meal integrity. Treat a preset meal as one logical consumption rather than moving one ingredient and splitting its parent unexpectedly.
5. Keep accessible Move/Cancel controls and a clear target highlight. Explain genuinely unsupported moves instead of silently doing nothing.

Acceptance: a move persists after refresh and screen changes, failed moves leave the source intact, duplicate gestures do not create duplicate writes, edge scrolling works on a real device, and protected imports stay protected. No new within-meal ordering column or migration is assumed; if reproduction shows an actual ordering requirement, assess that separately before extending the data model.

## 3. Repair image propagation, then reuse it for previews

Confirmed: food rows call `diaryEntryImages` (entry override, then `food_images`). A separate `loggedMealImages` helper handles logged-meal images and `meal_images`, but it is not used by the current log components inspected. This is a likely projection/rendering gap, not proof that the stored image is missing.

Implementation:

1. Trace one logged preset from its parent entry through daily-summary/timeline grouping and the rendered row. Check whether the existing response includes its saved image before adding fields or requests.
2. Resolve images at the correct entity level: logged-entry override, saved parent-meal image, then permitted existing catalog fallback. Prefer historical snapshots; do not overwrite old logs to repair display. After library deletion, retained logged images must still render.
3. Reuse existing path normalization, active-server image loading, authenticated upload handling, lightbox and cache behavior. Avoid a per-row fetch and do not load full-resolution photos for a three-thumbnail strip.
4. Feed the same resolved images to expanded rows and collapsed previews. Keep capture-level images attached to the correct capture, and use a neutral fallback for failed or absent images.
5. If a response projection needs modification, update the shared schema and mobile/web consumers together; verify owner-only image access. No data migration is expected for a display-only repair.

Acceptance: uploaded, provider, preset, per-entry override, absent/broken and deleted-library-image cases; existing and newly logged meals; collapsed/expanded states; active-server switch; no exposure of another account's uploads.

## 4. Improve favorite ranking and meal quick-add

Confirmed: phone favorite results sort by `favoritedAt`, and the server favorite query orders by favorite creation time. Watch shortcuts take the first eight favorites before deduplication. Meal search rows currently have no equivalent to the food row's quick-add callback.

Ranking definition:

- Use the current account day and the preceding 27 calendar days, through now, in the account timezone. Opening a historical diary day does not shift popularity to that old month.
- Count actual logged consumptions, not grams, calories, planned meals or ingredient rows generated from the same preset. Editing a portion does not add an occurrence. Deleted consumptions cease to count.
- Sort by consumption count descending, then last consumption descending; use existing favorite timestamp and stable ID as final tie-breakers. Unused favorites remain available below used ones.
- Rank the combined phone food/meal favorites consistently; rank the Watch's supported favorite foods before its eight-item limit. Keep relevance ahead of popularity when a search query is entered.

Implementation:

1. Add bounded usage metadata to the existing favorite read path through repository → service → route, with parameterized user-scoped queries. Reuse existing data; do not fetch the entire diary on each phone/Watch search or add an analytics table.
2. Extend the shared response contract additively and update mobile/web parsing. Define defaults for old-server and cached/offline responses, retaining stable existing ordering when usage data is unavailable. Validate all affected consumers.
3. Share the ranking rule between phone results and the Watch snapshot assembled by `useWatchCheckInBridge`/`watchFoodShortcuts`. Apply ranking before display caps; invalidate usage after log/edit/delete and refresh when the rolling-day boundary changes, accounting for infinite query stale times.
4. Add a preset-meal quick-add button using existing meal logging and default-serving semantics. It logs one documented default portion into the selected date/meal; detail tap still allows quantity changes. If no valid default exists, open quantity selection rather than invent a portion. Disable duplicate submits and ensure failure causes no partial ingredient log.
5. Correct `MealLibraryRow` width/shrink constraints, secondary-text wrapping and trailing action bounds. Test long German names, custom meals, large nutrition numbers and enlarged text. Do not truncate stored names or change nutrient math.

Watch scope: favorite ranking and readable existing food shortcuts. Preserve its portion confirmation, captured action time, queue identity and offline replay. Adding preset-meal logging to Watch would require a separate capability/contract review and is not implied by the comment about sorting.

Acceptance: 28-day boundaries, timezone midnight, ties, zero-use favorites, deleted logs, preset counting, mixed favorites and search relevance; consistent phone/Watch order before truncation; offline fallback; one-portion meal totals; no custom-meal overflow or duplicate add.

## 5. Let manual supplement logging select its time

Confirmed: scheduled logging goes through `useLogDose` and assigns `new Date().toISOString()`. Additional intake already has a `TimeSheet`, but its initial clock is captured on component mount and it has no quarter-hour configuration.

Implementation:

1. Open a shared time-confirmation sheet for a new manual supplement intake from Supplements and the corresponding detail/diary actions. Refresh the current clock every time it opens. Editing/undoing a recorded dose retains its existing semantics; undo must not first create another intake.
2. Add an optional 15-minute interval to `TimeSheet`, including its enlarged-text rendering. Keep unrestricted minutes for workout plans and other existing consumers.
3. Default to the exact current time, with quarter-hour alternatives. Do not silently round into the future; preserve an explicit “Jetzt” selection when the current minute is not a quarter-hour. Use 24-hour German labels.
4. Pass the selected time through the existing logging hook/request. Convert the selected calendar date and local time with shared timezone helpers, consistently with supplement scheduling. Handle invalid/nonexistent DST times and reject future intake timestamps with a clear message.
5. Preserve the scheduled dose identity, selected dose amount/unit, entry date and source. Additional intake remains unscheduled `prn_taken` and must not complete a scheduled dose. Cancel writes nothing; confirm writes once. Refresh related history, goals, hydration and nutrition caches using existing helpers.
6. Keep medication/supplement classification distinct. Notification and Watch quick actions remain one-tap logs at their captured action time; they do not require an interactive sheet.

Acceptance: fresh current-time default after leaving the screen open, quarter-hour selection, historical days, midnight/timezone/DST cases, cancel/future time, duplicate tap, undo, scheduled versus additional intake and unchanged medication quick actions.

## 6. Distinguish navigation and fix Save contrast

Implementation:

1. Reproduce the exact reported Save screen. Inspect `FormScreenChrome`, `useScreenHeader`, `Button`/`NeonButton` and the relevant caller's state styles. The shared button foreground alone has not been identified as the cause; custom child text and header treatments require checking.
2. Fix the responsible reusable appearance path, including its foreground/background pairing. Keep normal text contrast at least 4.5:1 for enabled actions, readable disabled/loading states and a visible spinner. Avoid screen-local forced black/white overrides and a new button style.
3. Make `DailyDetailScreen`'s Back control visually different from DateBar's previous/next arrows, through the existing header action API and reviewed German labels. Keep calendar arrows compact within the calendar bar; do not change their date semantics or the OS back gesture.
4. Check the native/custom header variants under the existing iOS-version rules, Android, normal/enlarged text, keyboard visible/hidden and dark/light/AMOLED. Do not weaken native-header or shared-button allowlists to pass checks.

Acceptance: users can distinguish screen Back from previous day; VoiceOver announces those different actions; typing does not switch Save to an unreadable foreground. Reuse the existing theme without altering the approved dashboard title.

## Verification and delivery gates

Implement stages as reviewable commits on one new feature branch from updated main. Fix a blocking Save regression early if reproduction warrants it. Stage 3's resolver must precede its preview work; stage 1's return handling must also apply to stage 4 quick-add. Re-review shared contracts, cache invalidation and gesture/parent-meal safety before integrating.

Automated checks after implementation:

- Extend focused mobile suites: `DailyMealsScreen`, `FoodEntryAddScreen`, `FoodSearchScreen`, `FoodSearchScreen.multiSelect`, `FoodSummary`, `SwipeableFoodRow`, `TimeSheet`, `TimeSheet.largeText` and `watchFoodShortcuts`. Cover outcome/navigation, image precedence, capability decisions, ranking boundaries and timestamp persistence, not just matching component markup.
- Add focused cases in existing image, medication logging, multi-add, Watch snapshot and shared date/ranking suites as their implementation paths require. Do not invent another logging or offline queue to simplify tests.
- Run `pnpm run validate` in Mobile, and in shared/Server/Frontend if touched. Shared/API changes require all consumer validation and a focused web compatibility check. Run affected mobile/shared/frontend tests; backend test suites remain skipped at the owner's standing request. Server validation and an isolated API smoke check remain required if server code changes.
- Compile the Watch target with the changed snapshot/Swift code. Check that both old cached snapshots and refreshed snapshots remain parseable. Run the phone native export with review fixtures excluded.
- Apply and check reviewed German overlays, including accessibility, new time/error labels and Watch copy. Mobile validation already includes the German, button-theme, native locale and geometry checks; keep those intact and run the existing navigation-header contract tests alongside them.
- Run the docs build after updating current guides and the dated implementation record. Update meal logging/quick-add, supplement timing and Watch behavior in their existing guides only after implementation supports the descriptions.

Visual/device checks are separate from Jest:

- German small and large phone widths, dark/light/AMOLED and enlarged text; collapsed/expanded meals, long custom presets and keyboard-visible Save. Verify thumbnail bounds, full accessible names and no overlapping text/actions.
- Real drag/drop including scroll edges, tap, long press, cancelled gestures, failed save and screen restoration; selected-day navigation through each supported logging path.
- Paired Watch favorite order, portion-confirmed quick log and offline replay; verify the diary contains exactly one consumption after reconnect.
- Supplement backdating and quarter-hour recording reflected consistently in history and planned-dose completion, without changing additional-intake status.

Release readiness requires every issue above to have linked evidence or a clearly identified outstanding device check; an automated pass is not device verification. Keep Todoist items open until their acceptance outcome is demonstrated. This request authorizes planning only: merging, release numbering, TestFlight and production deployment belong to a later requested execution/release batch.

## Self-review

- All eight tasks and all additional comments are mapped; the owner-selected return destination is explicit.
- Existing themes, mutation layers, parent-meal snapshots, server ownership checks and Watch queues are reused.
- API changes cover shared schemas and both clients; no migration, auth change or new domain is planned.
- Calendar dates and UTC instants remain distinct, with shared timezone helpers and a defined ranking window.
- Screenshot-specific uncertainty is recorded rather than treated as a verified root cause.
- Backend-test exclusion, native device checks and documentation ownership are explicit. The unrelated production-retention branch is preserved.

Planning-artifact verification: Prettier and `git diff --check` passed, and the isolated checkout's VitePress documentation build passed using the existing installed docs dependencies. Application tests and device checks have not been run for this planning-only request.

## Execution follow-up

The owner subsequently authorized implementation followed by automatic release.
See [implementation outcomes](v48-inbox-corrections-2026-10-09.md) and
[v49 delivery](v49-release-2026-10-09.md). The planning-only wording above records
the original authorization boundary, not the current execution state.
