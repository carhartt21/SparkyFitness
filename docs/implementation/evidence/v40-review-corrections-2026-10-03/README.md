# Synthetic v40 corrective evidence

All names and values are isolated fixtures. Original Todoist screenshots were
viewed privately and are not stored here. Phone dashboard/check-in examples retain
the existing September 26 review day; supplement and Watch examples use the
simulator's current local day. They do not reconcile one account across platforms.

## Before / after

The preceding dashboard implementation is recorded in the
[earlier energy](../v39-review-corrections-2026-10-02/390-de-dark-summary-energy.png)
and [category](../v39-review-corrections-2026-10-02/390-de-dark-summary-progress-top.png)
captures. These historical captures are reused without duplication; they are not
an exact v40 source rerender. The Supplements before reference is the privately
reviewed Todoist attachment for `6hgV8JH4wGWXC387`.

| Case                     | Dashboard / gauge                                                                                    | Custom tag option after deselection / reopening                                                                    | Populated Supplements                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| German 390 dark          | [Both summaries](390-de-dark-dashboard.png), [energy](390-de-dark-summary-energy.png)                | [Deselected](390-de-dark-v40-custom-tag-deselected.png), [reselected](390-de-dark-v40-custom-tag-reselected.png)   | [Summary/rows](390-de-dark-v40-supplements-populated.png), [settings](390-de-dark-v40-supplements-settings-populated.png)   |
| German 390 light         | [Both summaries](390-de-light-dashboard.png), [energy](390-de-light-summary-energy.png)              | [Deselected](390-de-light-v40-custom-tag-deselected.png), [reselected](390-de-light-v40-custom-tag-reselected.png) | [Summary/rows](390-de-light-v40-supplements-populated.png), [settings](390-de-light-v40-supplements-settings-populated.png) |
| German 430 enlarged text | [Energy top](430-de-large-summary-energy.png), [progress top](430-de-large-summary-progress-top.png) | [Deselected](430-de-large-v40-custom-tag-deselected.png), [reselected](430-de-large-v40-custom-tag-reselected.png) | [Summary/rows](430-de-large-v40-supplements-populated.png), [settings](430-de-large-v40-supplements-settings-populated.png) |

The [Watch intake before](before-watch-intake-de.png) uses actual source from
`0472ee2d8` with an isolated synthetic intake host. Compare
[after](watch-intake-de.png), [missing data](watch-intake-unknown-de.png),
[over target](watch-intake-over-de.png) and [Daily Goals](watch-goals-de.png).
The before runner's legacy filename `watch-goals-de.png` was renamed here to
describe the actual intake view; only its private harness was altered for this
baseline capture. Its source hash is retained in `before-watch-results.json`.

## Provenance and limits

`phone-results.json` records summary/custom-tag interactions; empty supplement
captures from that early run are excluded. `supplements-results.json` records the
separate populated confirmation. Layout measurement text files record native
element frames; enlarged-text coordinates are taken while scrolling and are not
a single-screen fit claim. `watch-results.json` records the 19 native assertions
and source hash. `checks.json` records commands, counts and product source hashes.
The runners' Git revision fields describe the base commit; captures include the
implementation then present in the working tree, subsequently committed together.

Final screenshots were visually inspected. Phone checks use a compatible native
development shell with current JavaScript; writes are synthetic memory transport.
Watch source compilation uses a private synthetic executable, not the production
bundle. No live-account persistence, physical delivery, signed build, Android
interaction or audible VoiceOver check is implied. See
[results and acceptance](../../v40-review-corrective-results-2026-10-03.md).
