# Dashboard v11 review follow-up — 26 September 2026

## Evidence and scope

Read all 11 active Todoist Inbox items and their individual image comments through the authorized connector. Each had one image and no additional textual comment; the exercise-report item also explicitly requests a correctly positioned back button and persistent navigation. The supplied older Dashboard images are not evidence that build 11 still contains the Skia debug overlay. Private review images are not committed.

Visually inspected the actual standalone `mobile/01-dashboard.png` extracted from `x-on-track-ui-assets-2026-09-25.zip` and the Todoist screenshots. The reference governs direction, not its invented sample arithmetic, alternate tagline, decorative imagery or unsupported notification/profile actions.

This batch addresses Dashboard presentation and detail destinations, plus the directly observed navigation, spacing and German-copy defects. It does not claim completion of every Inbox feature request.

## Prioritized register

| Priority | Todoist item / screen | Evidence | Correction / current status | Verification |
|---|---|---|---|---|
| P1 | v11 Dashboard theme, contrast and icons (conversation) | Existing dark tokens use gray/olive surfaces, muted green and saturated blue progress rails | Navy-teal surface roles, cool secondary text, mint controls, cyan hydration, orange activity energy; native target/clock/flame symbols | Synthetic simulator screenshots, numerical text contrast |
| P1 | Hydration and Training Details (conversation) | Neither summary component exposes a detail callback | Shared accessible header links; selected-day hydration ledger; existing exercise report receives selected date | Native tap → read → close/back checks; component callback test |
| P1 | `6hcvRHqgFRCvGq9f` workout report back navigation | Screenshot arrow overlaps status bar; screen has no custom-header safe inset | Add safe-area padding only when native header is absent; header remains outside scroll | Native back-button position and return assertion; header contracts |
| P1 | `6hcrxmvvGrPGjMV7` progress-photo navigation | Same visible status-bar overlap; iOS custom path lacks inset | Apply the same native/custom header distinction | Existing photo tests; physical screenshot still unverified |
| P1 | `6hcrrhR94GHrQc37` Log Water does not work | Older screenshot only; current hook has default 250 ml vessel and error handling | No speculative production mutation change. Simulator fixture now models water writes and ledger so the current path can be exercised | Native quick-add must change 1000 → 1250 ml and open one 250 ml drink; real server/device reproduction remains unverified |
| P2 | `6hcrrPW98x7Fwxw7` debug overlay | Older ring screenshot; current ProgressRing explicitly disables Canvas debug | Retain prior fix; no new patch | Dashboard captures show no overlay |
| P2 | `6hcrv5r99VQHXjpf` overflowing buttons | Settings label breaks the last letter onto a new line | Shorten German label to “Health-Daten synchronisieren” | Source review; Settings visual recheck remains open |
| P2 | `6hcrv9jqXrPVrfmf` translations | Notification screenshot contains “Alleow”, “Master switch”, “alerts” | Correct notification section, touched photo deletion/history copy and new hydration copy | Static locale review and Dashboard key parity; app-wide translation audit remains open |
| P2 | `6hcvP352RM5grP37` food-library spacing | Thumbnail touches title | Add 12-point separation while retaining separate image and row actions | Source review; library visual recheck remains open |
| P2 | `6hcvRj3F8PM3pRV7` compact date header | Newer screenshot has logo/wordmark/tagline above date | Remove Dashboard wordmark block; date and actions form the top row, stacking for enlarged text | 390/430-point native captures; date-action tests |
| P2 | `6hcvRWfHCjfgFpJ7` progress-photo deletion | Screenshot has existing overflow control | Existing selected-day photo menu already calls confirmation and delete API. Correct broken German deletion text; do not duplicate destructive logic | Existing photo tests; discoverability and actual device deletion not yet verified |
| P2 | `6hcvMhpqgJ2f5Fx7` search tabs and quick actions | Search screenshot shows fragmented controls and no category tabs | Next separate flow batch: reorganize the existing modes and scan/photo/manual actions without dropping destinations | Future simulator search/filter/logging tests |
| P3 | `6hcv6rvCm4PWGH97` app-icon context actions | YAZIO screenshot is a requested interaction reference, not an existing defect | Next native feature batch: supported food, scan, activity and measurement shortcuts; route safely through auth and active-session state | Requires native configuration/build and cold/warm-launch tests |

## Design decisions and deliberate departures

- Preserve the approved brand/logo assets and persistent identifiers. Removing the Dashboard wordmark follows the explicit Inbox request; it does not rename the product or tagline.
- Preserve light and AMOLED theme choices. Dark semantic roles are updated rather than sprinkling color literals into cards. No calculation, API, authentication, Health or Watch contract changes.
- Keep explicit consumed/base-target/activity values. The ring continues to show the existing allowance semantics; the reference's inconsistent values are not copied.
- Use SF Symbols on iOS through the existing semantic Icon component. Nutrient colors remain stable. Add an activity-energy role rather than using green for burned energy.
- Keep 44-point detail actions. On narrow paired cards, the title, Details text and disclosure form one 44-point-minimum press target; large text stacks the cards. The screenshot is a direction, not a fixed-ratio layout.
- Hydration Details is a read-only selected-day ledger. It explicitly explains why food water and older aggregate totals may not have matching individual entries, avoiding false reconciliation claims. Loading, error/retry and empty states are present.
- Native simulator verification found a modal safe-area/background integration defect; corrected with the existing View and safe padding, then replaced the abrupt full-screen presentation with a native dismissible sheet.

## Verification

Evidence and final results are recorded in [the evidence index](evidence/dashboard-v11-followup-2026-09-26/README.md). Do not treat mocked transport as a real-server or TestFlight pass. Todoist tasks remain unchanged until the outstanding checks and feature batches are resolved.

## Finish review and correction

The independent Impeccable reviewer returned **fix** for four material findings: excessive nutrient height, unnecessary energy heading/action height, excessive summary-card height, and an abrupt full-screen hydration modal. One correction batch restored inline nutrient rows at ordinary text sizes (32% label allocation accommodates German), removed the visible energy heading while keeping its accessible name, tightened energy padding/actions, combined each summary title/Details into one 44-point target, omitted a redundant single-vessel selector, and used native sheet presentation. Multi-vessel selection and quick-add presets remain available.

The scoped verdict returned **ship**, with all four scored fixes resolved. This is approval of those corrections, not a new whole-application audit. Actual summary values now appear in the first 390- and 430-point viewport. The reference's compact composition is adapted for native 44-point controls and enlarged text rather than shrinking content to match an image.

Full mobile suite: **480 suites / 7,224 tests passed**. Focused suite: 112 tests passed. TypeScript, changed-file ESLint and production iOS export passed. Native flows passed at both specified widths, covering water add/ledger, Details/back, and food search/portion/long note/save/edit/delete. Seven presentation states were captured; a later capture-only confirmation covers the final German label width. The localization audit remains nonzero solely for three existing dynamic-key usages in HealthDataWriteback/SyncScreen; zero missing static keys, missing fallbacks, structural, placeholder or plural errors remain.
