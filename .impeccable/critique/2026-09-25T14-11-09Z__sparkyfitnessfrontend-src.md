---
target: web interface
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
timestamp: 2026-09-25T14-11-09Z
slug: sparkyfitnessfrontend-src
---
Method: dual-agent (A: /root/web_design_review · B: /root/web_detector_review), plus a source-level technical audit.

# X on Track web interface audit — 25 September 2026

Scope: the deployed public sign-in page at https://health.ilmtech.de/login, desktop and 390 px mobile; authenticated Diary, navigation, Settings, and representative feature surfaces reviewed from the current frontend source. No personal account or production data was accessed. Authenticated visual behavior remains a validation gap.

## Technical Audit Health Score

| Dimension | Score | Key finding |
|---|---:|---|
| Accessibility | 2/4 | Icon-only mobile navigation, Add sheet semantics, zoom restriction, and destructive contrast |
| Performance | 2/4 | Initial page preloads a 743 KB gzip catch-all vendor chunk |
| Responsive design | 3/4 | Public sign-in fits 390 px; small header controls need larger targets |
| Theming | 3/4 | Core tokens are coherent; sign-in gray canvas and isolated gradients drift |
| Implementation integrity | 2/4 | Product-specific structure is present, but critical health assumptions and accessibility patterns are inconsistent |
| **Total** | **12/20 — Acceptable** | Significant issues need a focused pass |

Implementation integrity verdict: pass with reservations. The X icon, personal baseline concept, deep-linked Settings sections, and token palette form a real product system. The assumed health data in worked calculation text and unlabelled mobile destinations undermine the system's trust and usability. The detector found 15 patterns across 487 JSX/TSX files; five spinner borders and two hover-state color combinations are false positives. Three indigo/violet gradients and one bouncing pregnancy confirmation are real, context-dependent visual drift.

## Design Health Score

| # | Nielsen heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | System status | 2 | Loading and error feedback exist, but Diary can collapse to a plain loading or empty shell |
| 2 | Real-world match | 3 | Mostly plain task labels; BMR/TDEE and advanced nutrition terms add translation work |
| 3 | User control | 2 | Date and dialog exits exist; disabled registration gives no access route |
| 4 | Consistency | 3 | Shared controls and grouped Settings; public sign-in palette differs |
| 5 | Error prevention | 1 | Missing measurements silently become apparent personal inputs in calculation explanations |
| 6 | Recognition | 2 | Desktop navigation is labelled; mobile destinations are icon-only |
| 7 | Flexibility | 3 | Quick Add, passkey, saved widgets, and Settings deep links support repeat use |
| 8 | Aesthetic restraint | 3 | Login and Settings are calm; main navigation and Diary have many equal-weight peers |
| 9 | Error recovery | 2 | Auth errors have text; a missing goal lacks an actionable Diary state |
| 10 | Help and documentation | 1 | Some calculation help exists; key empty/access states lack next steps |
| **Total** | | **22/40 — Acceptable** | Source-informed for authenticated routes |

Design specificity: moderate. The identity and Settings structure are specific to X on Track; the sign-in composition and flat top-level navigation could be reused by an unrelated app. The most promising improvement is to make the user's chosen tracking dimension and next action clearer than the surrounding metrics.

## Priority issues

1. **P1 — Assumed measurements appear as personal data.** `DailyProgress.tsx:241-250,284-306,802-824` substitutes 70 kg, 170 cm, male, and age 30 when data is missing, then `CalorieTargetBreakdown.tsx:253-267` prints worked math using those values. This makes a health-related explanation look personalized when it is not. Show which inputs are missing and label any estimate, or withhold the worked target until inputs exist. Suggested command: `$impeccable clarify`.
2. **P1 — Mobile navigation buttons have no names.** `MainLayout.tsx:559-579` discards available tab labels and renders only SVGs without button labels; the Add item's selected-state expression is always true. Screen-reader users cannot identify destinations, and new users must guess. Render short labels, add accessible names and current state, and use actual Add-open state. Suggested command: `$impeccable harden`.
3. **P1 — Quick Add sheet lacks dialog behavior.** `AddComp.tsx:43-99` uses clickable divs without dialog role, initial focus, focus containment, or Escape handling. Keyboard users can move behind the visible sheet and cannot dismiss it conventionally. Use an accessible dialog/sheet primitive while preserving the current actions. Suggested command: `$impeccable harden`.
4. **P1 — Zoom and warning-button contrast.** `index.html:5-8` declares `user-scalable=no`, restricting pinch zoom where honored; light-theme `--destructive` and `--destructive-foreground` in `index.css:118-119` produce a measured 3.59:1 contrast ratio on normal-sized destructive buttons such as `DeleteFoodDialog.tsx:189`. Remove the zoom restriction and adjust the color pair to at least 4.5:1. Suggested command: `$impeccable harden`.
5. **P2 — Dashboard and navigation flatten priorities.** `MainLayout.tsx:223-255,522-536` can show eight or more peer destinations; `Diary.tsx:369-430` starts with six fixed widgets plus each meal. Users must scan many equal-weight choices before finding the next step in the Track → Understand → Adjust loop. Group secondary destinations and let the chosen tracking focus lead. Suggested command: `$impeccable distill`.

## Additional technical findings

- **P2 — Missing-goal Diary state:** `Diary.tsx:120-130,519-524` renders no widget grid when `goals` is absent after loading, with no explanation or setup link. Validate this with a synthetic incomplete account, then add an actionable empty state. Suggested command: `$impeccable onboard`.
- **P2 — Initial-load cost:** the deployed HTML preloads `vendor-others-DH4cPF0M.js`; measured transfer is 742,735 bytes with gzip, and the chunk is 2,179,321 bytes uncompressed. `vite.config.ts:76-90` places most dependencies in a single catch-all chunk. Run a route-level bundle analysis and split only dependencies that can load after sign-in. Suggested command: `$impeccable optimize`.
- **P2 — Public access dead end:** `Auth.tsx:509-512` says registration is disabled but gives no route to request access or understand the private deployment. Add concise access guidance. Suggested command: `$impeccable clarify`.
- **P2 — Landmarks and small controls:** `MainLayout.tsx:443-591` has navigation and content but no main landmark, and its mobile sign-out uses a 36 px-high small button (`button.tsx:23-27`). Add a main landmark and enlarge compact header hit areas to 44 px. Suggested command: `$impeccable adapt`.
- **P3 — Visual/motion drift:** `Auth.tsx:438` uses a gray canvas instead of the documented warm cream palette; `KeyStatsWidget.tsx:64` and `FastingTimerRing.tsx:62` use indigo/violet gradients; `TwoWeekWait.tsx:74` bounces in a sensitive confirmation state with no reduced-motion variant. Review tone and remove motion that adds no feedback. Suggested command: `$impeccable colorize`.

## Positive findings

- The live sign-in form is readable and fits an emulated 390 px viewport without horizontal overflow.
- `SettingsPage.tsx` has five named sections, active-profile context, readable descriptions, accessible Radix tab/accordion primitives, and preserved URL deep links.
- Shared color tokens have readable muted text (measured 5.4:1 on the light background and 6.72:1 on the dark background). Route-level lazy loading and immutable asset caching are already in place.
- Diary supports saved widget layout; passkey and Quick Add reduce repeat-entry effort.

## Persona, cognitive load, and emotional journey

Jordan (first-time visitor) sees disabled registration with no next step and must decode mobile icons. Sam (screen-reader/keyboard user) encounters nameless mobile buttons and a non-dialog Add sheet. Riley (edge-case tester) can get worked calorie math from silent defaults and a nearly empty Diary when goals are missing. The public sign-in starts calmly, while the assumed-input explanation is the largest trust risk. Cognitive load is moderate to high on the signed-in home: more than four peer navigation and widget decisions are visible at once; Settings improves this through grouping.

## Questions to consider

- Should a user's chosen tracking dimension lead the home page instead of an equal-weight set of nutrition and exercise widgets?
- What should a visitor do when registration is disabled?
- Should calculated targets wait for actual personal inputs, or clearly display that an assumption was used?
