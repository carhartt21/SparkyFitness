# Synthetic v39 review evidence

No owner screenshots or health records are stored here. Original Todoist screenshots
were inspected privately. All captured names, meals and progress values here are
isolated fixtures. Phone captures use the existing v38-review scenario's September
26 date; the Watch fixture uses its actual local day. They are separate demonstrations,
not cross-platform reconciliation of one account.

## Before / after

The existing [v39 dark baseline](../v39-2026-10-02/mobile-390-de-dark.png),
[light baseline](../v39-2026-10-02/mobile-390-de-light.png), and
[enlarged-text baseline](../v39-2026-10-02/mobile-430-de-large.png) show individual
habit names and left-aligned headings. These were recorded in the earlier v39
integration preview (`e30017f`); they are reused without duplicating historical PNGs.

| Case                     | Summary headings / energy                     | Category overview                                                                                       |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 390 German dark          | [Energy](390-de-dark-summary-energy.png)      | [Full category card](390-de-dark-summary-progress-top.png)                                              |
| 390 German light         | [Energy](390-de-light-summary-energy.png)     | [Full category card](390-de-light-summary-progress-top.png)                                             |
| 430 German enlarged text | [Energy top](430-de-large-summary-energy.png) | [Heading and X](430-de-large-summary-progress-top.png), [lower rows](430-de-large-summary-progress.png) |

[Opened category breakdown](390-de-dark-summary-task-destination.png) demonstrates
that the list opens detailed goals. Layout-measurement files and `phone-results.json`
record the shared columns and three passing interaction cases.
`phone-large-confirmation.json` records the final capture-gesture correction. Source
revision fields name the base commit; captures include then-uncommitted implementation
changes, subsequently committed as `e2862af7f`.

The new [Watch page](watch-goals-de.png) has no previous same-screen counterpart.
`watch-results.json` records its native source hash and 16 synthetic assertions. It
captures the top of the scroll view; actual dialog traversal and paired phone/server
delivery remain unverified. Native assertions include context-based acknowledgements,
not only immediate messages. `checks.json` summarizes the executed validation.

The UI review was a bounded defect pass and correction/confirmation cycle. A screenshot
or successful OCR alone is not visual acceptance. The final images were inspected;
normal headings/category wording fit, and enlarged text wraps/scrolls without hiding
the tested actions horizontally. See the [implementation results](../../v39-review-corrective-results-2026-10-02.md)
for exact limits and device gates.
