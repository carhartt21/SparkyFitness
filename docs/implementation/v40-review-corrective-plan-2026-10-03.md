# v40 review corrective batch

Branch: `feat/v40-review-corrections-20261003`, based on `0472ee2d8`.
Scope: phone and native Watch; no server contract, migration or release change.

## Reviewed findings

All six X on Track Inbox tasks and their comments were read. The five actual
attachments were viewed through Todoist's attachment viewer. Owner images remain
private; repository evidence uses synthetic data only.

| Priority | Task                                         | Confirmed cause / implementation                                                                                                                                                                                                                                                                                    |
| -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | `6hgVWxhHRVwpR8cf`: custom check-in tags     | Options derive from selected draft tags. Keep an account-scoped option catalogue in the existing persisted preferences; creation stores an option immediately, deselection changes only the answer. Recover tags in loaded historical entries.                                                                      |
| 2        | `6hgVcCFcR822jp5f`: gauge text               | Fixed `top: 32` positions the text too high. Center the text group inside the measured gauge square, with an inset that preserves the arc and long values.                                                                                                                                                          |
| 2        | `6hgVcfm3W83ccpmf`: dashboard card heights   | Shared frame reserves 192 points and a redundant full-width “all categories” row. Use a smaller shared visual and 44-point task rows, retain access to all categories through the heading, and keep large text stacked/scrollable. Test both summaries with the header and bottom navigation at normal phone sizes. |
| 2        | `6hgV8JH4wGWXC387`: spacing / quieter screen | Attachment is Supplements, not Check-In. Add separation after Show All; replace simultaneous colored card glows with neutral surfaces, retain daypart icon color, and separate quiet settings actions. Preserve dose state, undo, menu and supplement/medication distinction.                                       |
| 2        | `6hgXMR7PC9qW9FQ7`: Watch intake             | Long German flank labels wrap mid-word beside a fixed 76-point ring. Use short visible labels with full accessibility descriptions, bounded single lines, adaptive width, and the phone's categorical macro colors.                                                                                                 |
| Verify   | `6hgMxpqfQGJ8xhR7`: Watch Daily Goals        | Already implemented in main. Verify current-day incomplete goals, supported confirmation actions, queue/receipt handling and non-completable phone-only goals; do not duplicate the feature.                                                                                                                        |

## Stages and acceptance

1. **Data retention:** regression tests for create → deselect → reselect, screen
   reopening, preference rehydration, account isolation, duplicate/empty input and
   loaded custom tags. Only selected tags enter the saved check-in.
2. **Phone refinement:** shared compact dashboard frame, centered gauge text and
   quiet Supplements. Keep tap targets ≥44 points; long names, energy adjustments,
   larger type and empty/error states remain functional. Review German dark/light
   and accessibility-size renders against the owner findings.
3. **Watch refinement:** reviewed English/German short labels and complete spoken
   labels; native compile and synthetic German intake/goals captures. Known missing
   values stay distinct from zero. Verify existing native goal assertions.
4. **Verification and handoff:** frozen install, targeted regression tests, full
   mobile validate, copy/overlay gates, simulator interactions and source-based
   native checks. Record actual results and physical-device limitations. Commit
   the tested branch; merge/publication are outside this request.

## Plan review

Reviewed against `agent-docs/plan-review-checklist.md`: existing components,
preferences and identity scope are reused; no extra persistence stack, scheduler,
API or data migration. EN source plus authored German overlay ship together.
UI changes remain bounded to the pictured surfaces. Normal-size density is not
enforced at accessibility sizes. Server tests are unnecessary for this phone-only
batch. A synthetic rendering result does not prove real phone–Watch delivery.

Implementation and verification are recorded in
[the results](v40-review-corrective-results-2026-10-03.md), including synthetic
screenshots, executed tests and physical-device acceptance that remains open.
