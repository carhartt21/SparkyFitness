# v41 dashboard density correction

## Problem and change

The v41 device review found that the energy and Daily Progress summaries pushed
the four quick actions behind the bottom navigation. The summary visuals used
128–144 points and a forced 176-point visual height, alongside generous heading,
row and header spacing.

Both summaries now share a 104–120-point visual column, compact matching icon
holders and separators, 16-point headings, and 12/8-point horizontal/vertical
padding. The unused minimum visual height is removed. The energy balance is
centered in a width-bounded 26-point text field; a first render check caught and
corrected its proximity to the smaller arc. Stat values retain 18-point type with
tighter line height. Header gaps are eight points; the action tiles have a
72-point minimum height and 24-point icons.

The card order, source values, allowance arithmetic, progress denominator,
neutral card glow, theme colors and existing routes/actions remain unchanged.
Touch targets remain at least 44 points. Large text keeps the existing stacked,
scrollable layout instead of shrinking the entire dashboard. Additional status
or allowance text is retained even when it requires scrolling.

## Verification

The native summary review now verifies all four quick actions before scrolling,
including their complete frames above the tab bar and its 24-point Add-button
overhang. It also checks matching columns, minimum touch targets, category
navigation and the full progress-screen summary. The runner adds an explicit
402×874 German case using the available iPhone 17 Pro simulator.

- Frozen offline workspace install passed without lockfile changes.
- Mobile `pnpm run validate` passed, including TypeScript, lint, German copy and
  overlays, native locale/geometry checks, unused-code and formatting checks.
- Five focused Jest suites / **17 tests passed**: energy destinations and balance
  adjustment, task/category state and navigation, gauge geometry, review fixture
  behavior and header behavior. The isolated review runtime's **3 tests passed**.
- **Four native summary reviews passed**: German dark at 390×844 and 402×874,
  German light at 390×844 and accessibility-extra-large at 430×932. Ordinary-text
  cases pass the full first-viewport action bounds; large text stacks and scrolls.
  Actual screenshots were inspected, not accepted from OCR alone.
- At 402×874 the measured energy card is 206 points high and Daily Progress is
  241 points. The 72-point action row ends at y=722.33; the tab bar starts at
  y=779.67, leaving 57.34 points (including the required 24-point overhang).
- The bounded pass caught the calorie-text bounds and a subpixel XCTest
  representation of the 44-point goal target; the latter now rounds that frame
  to logical points. The final confirmation run passed all four cases.
- Layout detector and `git diff --check` have no unexplained findings.
- Documentation `pnpm run build` passed, including rendering the evidence links.

[Results and source hashes](evidence/v41-dashboard-density-2026-10-04/results.json),
[402-point dashboard](evidence/v41-dashboard-density-2026-10-04/402-de-dark.png),
[light dashboard](evidence/v41-dashboard-density-2026-10-04/390-de-light.png) and
[stacked progress](evidence/v41-dashboard-density-2026-10-04/430-de-large-progress-stacked.png)
contain isolated synthetic fixtures only. Original owner screenshots are not
copied into the repository.

No physical iPhone 18 Pro or Android test was performed. No server, Watch native
source, health sync or data contract changed; backend tests were not required for
this UI correction. No merge, production deployment, TestFlight build or upload
was performed. The Todoist report remains open for acceptance in the next build.
