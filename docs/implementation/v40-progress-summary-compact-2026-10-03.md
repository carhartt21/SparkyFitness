# Compact Daily Progress summary

Follow-up to the [v40 corrective batch](v40-review-corrective-results-2026-10-03.md),
on the same feature branch. The owner screenshot showed a tall, centered summary
above the actual task list.

`DailyProgressScreen.tsx` now places a tightly framed 112-point Progress X beside
the count and explanation. Existing padding and text-size tokens provide a compact
row. Below 360 points or above font scale 1.3, the content stacks and scrolls; no
fixed height, truncation or font cap hides the explanation. The percent, selected
day, real counts, skipped-item policy, empty/uncounted copy, animation and task
actions are retained. Unknown progress has no invented percentage; its visible
count/explanation and the X accessibility label describe that state.

## Native evidence

Both sets use identical synthetic responses and actual app code. Before source is
`632c96d15`; after captures include this then-uncommitted screen change. Owner
screenshots and health records are not committed. The fixture date/names are
illustrative and remain literal.

| German case            | Before height | After height | Screenshots                                                                                                                                          |
| ---------------------- | ------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 390 dark               | 366 pt        | 162 pt       | [Before](evidence/v40-progress-summary-2026-10-03/before-390-de-dark.png), [after](evidence/v40-progress-summary-2026-10-03/after-390-de-dark.png)   |
| 390 light              | 366 pt        | 162 pt       | [Before](evidence/v40-progress-summary-2026-10-03/before-390-de-light.png), [after](evidence/v40-progress-summary-2026-10-03/after-390-de-light.png) |
| 430 accessibility text | 890 pt        | 748 pt       | [Before](evidence/v40-progress-summary-2026-10-03/before-430-de-large.png), [after](evidence/v40-progress-summary-2026-10-03/after-430-de-large.png) |

Normal-size height falls by approximately **56%**. Large text intentionally uses
more space. Native frame measurements and runner results are stored beside the
captures; the runner's original screenshot filenames refer to its private output,
while the selected summary attachments have normalized names here. All final
renders were visually inspected; no horizontal text clipping was observed.

## Validation

- Targeted existing progress screen/card tests: **2 suites, 5 tests passed**,
  including optional-goal skip/undo, conflict feedback and recording navigation.
- Full mobile `pnpm validate`: passed, including types, lint, localization and
  formatting.
- Native German dark/light/enlarged matrix: **3/3 before and 3/3 after cases passed**;
  summary navigation and horizontal count bounds are asserted.
- `git diff --check`: passed. Production source hash and results are in
  [checks.json](evidence/v40-progress-summary-2026-10-03/checks.json).

This is a layout-only phone change; no server or Watch source changed. No new
physical-device check, signed build, merge, deployment or publication was performed.
