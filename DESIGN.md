---
name: X on Track Settings and Mobile Dashboard
description: Bounded Settings patterns for mobile and web, plus compact native Home and Diary patterns
colors:
  brand-green-mobile-light: "#0b5e46"
  brand-green-mobile-dark: "#08d6ad"
  background-mobile-light: "#f6f0e3"
  surface-mobile-light: "#f0eadd"
  text-mobile-light: "#171c22"
  supporting-text-mobile-light: "#40554c"
  divider-mobile-light: "hsl(213, 16%, 90%)"
  background-mobile-dark: "#09161d"
  surface-mobile-dark: "#13272f"
  text-mobile-dark: "#edf5f7"
  brand-green-web-light: "hsl(163 79% 21%)"
  brand-green-web-dark: "hsl(164 81% 36%)"
  background-web-light: "hsl(41 51% 93%)"
  card-web-light: "hsl(43 100% 99%)"
  accent-web-light: "hsl(148 23% 87%)"
  foreground-web-light: "hsl(213 19% 11%)"
  muted-foreground-web-light: "hsl(153 12% 36%)"
  border-web-light: "hsl(40 22% 82%)"
  background-web-dark: "hsl(213 19% 11%)"
  card-web-dark: "hsl(200 16% 16%)"
  accent-web-dark: "hsl(153 22% 20%)"
  foreground-web-dark: "hsl(41 51% 93%)"
  dashboard-energy-light: "#526473"
  dashboard-energy-dark: "#b4c8d2"
  dashboard-energy-track-light: "#d6e5df"
  dashboard-energy-track-dark: "#154b47"
  dashboard-protein-light: "#21649e"
  dashboard-protein-dark: "#57b9f8"
  dashboard-carbs-light: "#6945a5"
  dashboard-carbs-dark: "#b59cff"
  dashboard-fat-light: "#8a5813"
  dashboard-fat-dark: "#f5b647"
  dashboard-fiber-light: "#a23d69"
  dashboard-fiber-dark: "#e98aae"
  card-glow-light: "#7c8a94"
  card-glow-dark: "#8497a3"
  supporting-text-mobile-dark: "#b4c8d2"
  raised-mobile-dark: "#1d343e"
  divider-mobile-dark: "#30474f"
  dashboard-hydration-light: "#146f8f"
  dashboard-hydration-dark: "#39c9f1"
  dashboard-exercise-light: "#09785d"
  dashboard-exercise-dark: "#21ddb0"
  dashboard-activity-energy-light: "#b54821"
  dashboard-activity-energy-dark: "#ff8052"
  dashboard-energy-amoled: "#b4c8d2"
  dashboard-energy-track-amoled: "#24524a"
typography:
  page-title:
    fontSize: "30px"
    fontWeight: 700
  web-page-title:
    fontSize: "30px"
    fontWeight: 600
  web-section-title:
    fontSize: "20px"
    fontWeight: 600
  mobile-section-title:
    fontSize: "18px"
    fontWeight: 700
  mobile-row-title:
    fontSize: "16px"
    fontWeight: 600
  supporting-copy:
    fontSize: "14px"
  small-label:
    fontSize: "12px"
  dashboard-summary-value:
    fontSize: "20px"
    fontWeight: 700
  dashboard-energy-value:
    fontSize: "26px"
    fontWeight: 700
  dashboard-section-title:
    fontSize: "16px"
    fontWeight: 600
  dashboard-paired-title:
    fontSize: "14px"
    fontWeight: 600
rounded:
  web-card: "8px"
  mobile-icon: "8px"
  mobile-group: "12px"
  web-profile-card: "12px"
  dashboard-card: "16px"
  dashboard-action: "16px"
spacing:
  compact: "4px"
  small: "8px"
  medium: "12px"
  regular: "16px"
  mobile-page-gutter: "20px"
components:
  mobile-settings-group:
    backgroundColor: "{colors.surface-mobile-light}"
    rounded: "{rounded.mobile-group}"
  mobile-settings-row:
    backgroundColor: "{colors.surface-mobile-light}"
    textColor: "{colors.text-mobile-light}"
    typography: "{typography.mobile-row-title}"
    padding: "{spacing.regular}"
  mobile-row-icon-tile:
    backgroundColor: "hsl(0, 0%, 100%)"
    rounded: "{rounded.mobile-icon}"
    size: "40px"
  web-profile-card:
    backgroundColor: "{colors.card-web-light}"
    textColor: "{colors.foreground-web-light}"
    rounded: "{rounded.web-profile-card}"
    padding: "12px 16px"
  web-active-section-tab:
    backgroundColor: "{colors.accent-web-light}"
    textColor: "{colors.foreground-web-light}"
    rounded: "{rounded.web-card}"
    padding: "8px 12px"
  web-settings-accordion:
    textColor: "{colors.foreground-web-light}"
    rounded: "{rounded.web-card}"
    padding: "{spacing.regular}"
  mobile-dashboard-card:
    backgroundColor: "{colors.surface-mobile-light}"
    textColor: "{colors.text-mobile-light}"
    rounded: "{rounded.dashboard-card}"
    padding: "{spacing.medium}"
  mobile-dashboard-quick-action:
    backgroundColor: "hsl(0, 0%, 100%)"
    textColor: "{colors.text-mobile-light}"
    rounded: "{rounded.dashboard-action}"
    padding: "8px 4px"
  mobile-dashboard-details:
    textColor: "{colors.brand-green-mobile-light}"
    typography: "{typography.small-label}"
  mobile-dashboard-macro-row:
    textColor: "{colors.text-mobile-light}"
    padding: "4px 0"
---

# Design System: X on Track Settings and Mobile Dashboard

## Overview

**Creative North Star: "Status overview plus clear sections"**

This record covers the implemented Settings surfaces (`XoTMobile/src/screens/SettingsScreen.tsx`, `XoTMobile/src/components/SettingsRow.tsx`, and `XoTFrontend/src/pages/Settings/SettingsPage.tsx`) and the native mobile Home (`DashboardScreen.tsx`), Diary (`DiaryScreen.tsx`, `DiaryTimeline.tsx`), and their subordinate training and health destinations. It also records the bounded food-search and Diary row patterns used by the mobile logging flow, native launch-icon quick actions, Home Screen widget shortcuts, and the shared web clock input. It is not a claim about every screen in either app. The Settings experience is an **Operate** surface: people check their current context, find a category, and reach a specific setting. The mobile Settings screen is a root-stack page opened from the Settings action on content tabs; it leads with an account card (profile name or a neutral fallback plus the connected server host) and then server and sync state. The web Settings screen leads with the active profile and five named sections. Home and Diary composition below is scoped to native mobile and does not extend the web Settings rules.

The light themes use warm cream backgrounds, darker text, and a restrained green accent; the dark themes keep the same semantic roles with darker surfaces and brighter green. Status copy reports observed connection and sync history, including checking and unavailable states. Sections and controls use the actual English locale strings, with translations supplied by each app's i18n system.

The native Home and Diary are **Operate** surfaces. Home concentrates on the selected day's energy, actual daily task progress, four logging actions, and compact detail destinations. Diary separates recorded evidence from scheduled work while keeping meal-state controls available on collapsed rows. The approved left Home and middle Diary composition in `docs/implementation/evidence/v44-diary-refinement-2026-10-06/approved-direction.png` and its provenance guide this refinement; the alternative Training tab was not selected. Home retains the approved logo target, “X on Track” name, localized “Keep getting better.” tagline, upper-right Settings action, and full-width date bar underneath. The approved artwork and identity remain product commitments. Reference names, amounts, times, and counts are illustrative; the implementation preserves real data and destinations.

**Verification boundary:** The Settings record remains based on source code, theme tokens, and English locale content; its authenticated appearance and viewport behavior were not verified during that documentation pass. Earlier Dashboard evidence remains historical in `docs/implementation/dashboard-alignment-2026-09-26.md`, `docs/implementation/archive/ui-2026-09-26/mobile-header-controls-2026-09-26.md`, and `docs/implementation/archive/ui-2026-09-26/dashboard-stacked-summaries-2026-09-26.md`. The current bounded refinement is recorded in `docs/implementation/v44-diary-refinement-2026-10-06.md` and its dated evidence folder. Final `native-results.json` records complete German interaction passes at 390 points in dark and light, and 430 points with enlarged text in dark, including meal-state controls and native food movement with edge scrolling. The runner loads this branch's JavaScript into an existing compatible simulator development app and uses synthetic in-memory transport: it verifies app actions and refreshed summaries, not backend persistence or a fresh signed archive. Recorded/planned captures show their named scroll positions, not the entire page at once. Web evidence covers the actual shared clock input on an isolated review page, not authenticated Settings; widget evidence covers actual SwiftUI content previews with synthetic data and compatible preview environment keys, not WidgetKit hosting. One HTML/CSS detector returned `[]`; no native detector was run. Physical-device, VoiceOver, Watch, Android, Health export, actual widget deep-link lifecycle, and whole-app acceptance remain unverified. This documentation refresh adds no new rendering or test run. Native measurements in the portable frontmatter use px notation for React Native logical layout units.

**Key Characteristics:**

- Grouped settings with headings that name the user's task.
- Current account or connection context near the top of the page.
- One destination per mobile row; category tabs and expandable settings on web.
- Visible text and accessibility labels for state, with color as a supporting cue.
- Compact native Home with energy and daily progress, four logging actions, and grouped detail destinations.
- Recorded-before-planned Diary sections with truthful times, visible meal-state actions, and text that reflows as it grows.

## Colors

### Primary

- **Deep green:** The mobile light accent and web light primary identify interactive settings icons and selected or focused navigation. Dark mode uses a brighter green from each platform's theme.

### Neutral

- **Warm canvas:** The mobile and web light backgrounds separate the page from grouped settings and the web profile card.
- **Readable ink:** The primary foreground values carry headings and setting names; secondary foreground values carry status and descriptions.
- **Quiet boundaries:** Mobile row groups use subtle dividers. Web accordion items use borders and the active tab uses a pale green accent fill.

**The Semantic State Rule.** A connection dot may reinforce status, but text must state whether the connection is checking, connected, or unavailable. Sync history must also expose its loading, missing, and unavailable states in words.

### Mobile Dashboard

The Dashboard reuses the mobile canvas, surface, and text roles above. Its dark theme layers navy-teal canvas, card, and raised surfaces with cool light text, brighter mint controls, and visible muted borders. Energy uses a neutral slate category color; cyan marks hydration, mint marks exercise, and orange marks activity-energy icons. Protein blue, carbohydrate violet, fat amber, and fiber rose identify nutrient categories without rating intake as good or bad; labels and numeric amounts carry the meaning. Nutrient percentages use their category colors only in dark themes; light-theme percentages retain secondary text color. Light remains a warm cream choice. AMOLED retains its black canvas and its own surface values from `XoTMobile/global.css`; it is not an alias of the dark palette. Selected water-container labels retain the primary text color on the muted accent fill.

## Typography

The Settings surfaces inherit each platform's default font stack; neither target sets a custom family. Hierarchy comes from size and weight. Mobile uses a bold page title, bold section headings, semibold row names, and smaller secondary lines. Web uses a semibold page title, section heading, compact tab labels, and muted descriptive copy.

**The Scan First Rule.** Keep section names and setting titles stronger than explanatory text. Preserve meaningful labels when they wrap; the mobile row title has no line limit by default.

### Mobile Dashboard

Home uses the native font stack, a medium-weight date control (14 points), a bold energy value (26 points), semibold summary headings (16 points), and readable supporting text. Retained hydration, exercise, and nutrient components keep their existing typography tokens on their own surfaces. At font scales above 1.3, the Home summaries stack, the energy summary removes its decorative ring, and quick actions wrap into two columns. The custom bottom tab bar is a bounded exception: visible labels fit on one line with a maximum multiplier of 1.2 and retain their full accessible names.

Diary timeline titles use semibold native body text (16 points), with clocks and summaries at 14 points. Clocks use tabular numerals and a single line. Above a font scale of 1.3, `HH:mm` moves above the title and summary in the content column instead of squeezing into the ordinary 44-point gutter. Titles and summaries wrap naturally; disclosure and eligible meal-state controls retain separate targets of at least 44 by 44 points.

**The Dashboard Reading Rule.** Keep Dashboard text readable and let content scroll or stack; never scale the entire screen to reproduce the reference screenshot.

## Layout

Mobile is a vertical scroll of titled groups with a 20px horizontal gutter. Each group is a single rounded surface with 16px row padding, 40px icon tiles, and subtle separators. The server and health sync rows come first; app experience, tracking, family, and help follow. Connection-dependent rows appear only when connected. Row icons sit on tinted tiles using the existing semantic hex tokens (hydration, energy, exercise, nutrient colors); non-hex tokens fall back to the raised surface. The screen adjusts for the safe area, active workout bar, and native iOS header behavior.

Web uses a centered container capped at 72rem. A heading and active-profile summary sit above five sections: Profile & Account, Nutrition & Tracking, Wellness, Family & Sharing, and Data & Connections. Section tabs form a two-column grid at the narrowest widths, three columns from the `sm` breakpoint (640px), and a sticky 15rem sidebar from `lg` (1024px). The selected section has its own heading and description; its settings are expandable accordion items. URL `tab` and `section` values select and open destinations, including legacy aliases.

**The Destination Rule.** Keep a category label, its controls, and deep-link section IDs aligned when changing the Settings layout. Mobile rows continue to navigate to their existing screens.

### Mobile Dashboard

The native Home scrolls vertically with a 16-point horizontal gutter over the ambient `ScreenBackground`. Its sequence is the identity header and shared `DateBar`; daily energy; Daily Progress when enabled; four neon `ActionTile`s (food, exercise, water, scan); a pending-water retry notice when needed; then a bordered group linking to selected-day nutrition details, hydration, and Training & routines. Hydration can show the confirmed consumed amount beside its link. Loading, unavailable, and saved-summary states remain explicit. Detailed nutrient, hydration, exercise, meal, health-trend, caffeine, and configurable routine cards are reached through their destinations. At font scales above 1.3, summaries stack and logging actions wrap into two columns. Date navigation, summary rows and actions retain at least 44-point targets; detail rows have a 56-point minimum height. Today appears only when another day is selected. Native-tab configurations keep the native date-picker header and a right-side Settings item.

### Mobile Diary

Diary's timeline uses the same 16-point page gutter. Recorded (**Erfasst**) precedes Planned (**Geplant**). Each section sorts independently from earliest to latest occurrence or scheduled time, then places entries without a trustworthy clock in a labelled untimed group. Ordinary rows align time, category icon, title/summary, and action within bordered 16-point groups with 12-point horizontal padding. Enlarged text moves the single-line clock above the content while preserving the category cue and separate action target. Recorded meals use their earliest actual food time, never today's configured meal schedule. Measurements with only a day and backfilled logs without occurrence evidence stay untimed. Meals start collapsed; resolving an eligible empty meal keeps it visible in Recorded without fabricating an occurrence time. Optional planned-meal prompts, photos, coverage notes, and daily nutrition retain their own existing places around the timeline.

**The Diary Evidence Rule.** Keep Recorded before Planned, sort within each section, and leave missing occurrence times untimed. Present the same localized summary visually and in the row's spoken name; unknown amounts or doses remain unknown.

### Mobile navigation and detail destinations

Keep the five-position navigation: Home, Diary, central Add, Insights, and More. Training is a subordinate destination from Home and More, not a replacement tab. `TrainingHubScreen` groups weekly plans, workout presets, guided mobility, and recorded training, then shows the actual week's activity states and the selected day's sessions. `HealthOverviewScreen` holds separate trends, caffeine, and configurable health/routine sections reached from existing navigation. These destinations use back navigation, safe-area-aware scrolling, existing card/list primitives, and explicit loading, error, empty, or offline copy. Training and dated health content retain the passed date or shared selected-day fallback; range-based health trends keep their existing 7d/30d/90d controls.

## Elevation & Depth

The mobile row group and standalone row use the existing small shadow utility; their surface fill and separators do most of the grouping work. The web Settings page uses card fill, accent fill, and borders without a page-specific shadow on its profile card, tabs, or accordion items. Do not imply a stronger elevation hierarchy than these source surfaces establish.

Home's energy and Daily Progress cards, compact detail group, and Diary timeline groups use the incumbent surface fills, neutral glow, and subtle borders. Retained hydration and exercise components preserve their bordered treatments on their own surfaces. The custom tab bar's central Add action retains its platform shadow/elevation. These local treatments do not redefine Settings or web elevation.

## Shapes

Mobile groups use 12px corners and icon tiles use 8px corners. Web section tabs and accordion items use 8px corners; the profile summary uses 12px. Thin separators and borders mark boundaries without turning each mobile row into a separate card.

Cards use 16-point corners (`GlowCard`). Primary, outline and filter controls are capsules (`NeonButton`, `ui/Button`, `SegmentedControl`), matching the reference; circles remain for progress, icon-only buttons, icon badges and the central Add action. The dashboard energy gauge is a 270° arc (`EnergyGauge`), 104–120 points across with a 14-point stroke; it is supplementary to the textual balance. Floating workout `LiquidGlassSurface` chrome keeps 16-point container corners.

## Components

### Mobile settings group and row

The group supplies a shared surface and separators. A row pairs an optional icon tile with a title, optional subtitle, and chevron or custom right accessory. Pressable rows expose a button role, spoken label, optional hint, and disabled state. Press feedback changes opacity; a disabled action is dimmed and cannot be pressed. A string subtitle joins the spoken label unless a more specific label is passed, as for server status.

### Mobile connection and sync status

Server shows connection text and the configured URL when present, or an add-server prompt. The colored dot uses the current semantic status color. Health Data Sync shows checking, last sync time, never synced, or unavailable history. These rows retain their Server Settings and Sync destinations.

### Web active profile card

A compact card names the active profile and whether it is a family member or the user's own account. It presents loading text until the active profile is available.

### Web section navigation and accordions

Tabs have text labels and decorative icons, with a visible active fill and keyboard focus ring. Their layout changes from grid to sidebar by viewport width. Accordion triggers contain an icon, title, description, and disclosure chevron; focus uses the theme ring and open state rotates the chevron. The underlying Radix primitives supply tab and disclosure semantics.

### Web 24-hour clock input

The shared `XoTFrontend/src/components/ui/input.tsx` preserves the existing bordered input, focus ring, disabled state, and theme roles. Time fields render as text with a numeric keyboard hint and an `HH:mm` placeholder, validate the complete 00:00–23:59 range, and normalize four entered digits such as `1430` to `14:30`. Partial drafts remain visible and invalid rather than becoming saved times. `TimeCommitInput` commits a changed, complete valid draft on blur; Enter triggers that same validation boundary. Existing meal-time and bedtime save flows also check validity. The isolated desktop/mobile captures verify this shared control, not browser keyboards or authenticated settings screens.

### Mobile Dashboard energy and quick actions

Home's energy and optional Daily Progress summaries share `DashboardSummaryCard`: 12-point horizontal and 8-point vertical padding, matching 104–120-point visual columns, 16-point section titles, 28-point icon holders, and rows with at least 44-point touch targets. Their graphics do not impose a 176-point minimum card height. The energy balance has a centered, width-bounded 26-point value. Four 72-point-minimum quick actions follow the summary area, then compact detail links; larger text and extra status or allowance copy can scroll.

`DashboardHeader` starts with the approved logo in a bordered Home target that resets the day, the product name and tagline, and the Settings action in the upper-right corner. `DateBar` (shared with the Diary) holds previous-day, the calendar date that opens the picker, a Today control on other days, and next-day. `CalorieRingCard` keeps the “Daily energy” accessibility label and shows the remaining balance (or over target / consumed without a goal) inside a red→yellow→green `EnergyGauge`; its gradient describes distance along the arc, not health quality. The gauge/center value itself opens Calorie settings, including when enlarged text omits the decorative arc. Its button name announces the actual center value and its remaining, over-target, or consumed meaning, followed by “Edit goal”; a remaining balance is never announced as the goal. No redundant edit label or value is added below the gauge. The card border and glow are neutral. Consumed, activity burned (or total expenditure), and base target rows open the Diary, exercise review, and Calorie settings. Any allowance adjustment is stated separately.

The four labelled quick actions preserve their real destinations. Food opens dated food search, Exercise opens exercise logging, Water adds the configured amount or opens container setup, and Scan opens dated food scanning. They do not imply unimplemented profile, notification, or photo actions from the reference.

### Mobile launch-icon quick actions

**The Native Launch Menu Rule.** Launch-icon quick actions use the operating system menu with localized task labels and semantic platform icons. The operating system owns menu typography, spacing, color, shape, and motion; app control tokens do not restyle this surface. Selecting an action opens an existing editor for local today without saving an entry or resetting the navigation stack.

The four actions open food scanning, food search, activity logging, and measurements. Readiness and setup gates retain a pending action until navigation can open its destination. Existing activity connection and draft-conflict prompts remain in force. The scanner's camera-permission loading and request states include a visible Cancel action so entry from the launch icon has an exit. Source, scoped review evidence, and remaining platform verification limits are tracked in `docs/implementation/launch-icon-actions-2026-09-26.md`.

### Mobile Dashboard saved and unavailable states

A configured but unreachable server is labelled unavailable. Saved summaries are scoped to the selected server account and day, limited to seven cached days, and expire seven days after saving. A displayed saved summary carries an explicit saved-at timestamp. Without a saved summary, the screen explains that the selected day is unavailable and offers Retry. Available Apple Health steps and active energy appear separately as device data for that day; missing readings remain unknown, and local activity does not change the saved energy allowance.

### Retained mobile nutrient rows

`MacroCard` in row mode places the nutrient name, slim progress rail, amount/goal, and explicit percentage on one line at ordinary text sizes. Rows have a 28-point minimum height, 13-point medium labels, 12-point values, and an 8-point rail. At ordinary text sizes, the label uses 26% of the row, the amount uses 72 points, the percentage uses 30 points, and the gaps are 5 points. The compact carbohydrate label is “Carbs” in English and “KH” in German; the full localized nutrient name remains in the accessible label. At font scales above 1.3, the same content stacks across multiple lines. Nutrient visibility preferences and supplement nutrition remain part of the existing nutrition flow; compact Home now opens the selected day's nutrition-detail destination rather than rendering this card. A missing goal omits the denominator, rail, and percentage rather than displaying a false zero target. Amounts and percentages use the app's localized number formatting; visual fill is capped while the numeric percentage can exceed the goal.

### Retained mobile hydration, exercise, and meal overview

`HydrationGauge` keeps confirmed consumption, food-derived water, pending actions, and saved actions needing attention distinct in text. Its selected container exposes selected state and primary-colored text; logging and retry actions preserve their real behavior. Compact cards omit the selection chip when only one container exists, while retaining the add amount and all choices when multiple containers are available. Expanded cards retain the single-container chip. `ExerciseProgressCard` shows the available exercise values and goals with its logging action. These retained patterns no longer form a full-width stack on Home: its compact rows open the selected day's water log and the Training hub.

Both cards use `DashboardSectionHeader` with a section-specific accessible name. The expanded header has a separate Details action and a minimum 44-by-44-point target. In the retained compact variants, the icon, title, Details caption, and disclosure are a single pressable header at least 44 points high; title and caption occupy two lines within that target. Exercise Details keeps the existing exercise report and its selected-date contract.

`HydrationDetailsModal` is a read-only ledger for that selected day. Each recorded drink shows its amount in the preferred unit, container name, local time, and source. The dated ledger states that food water and older daily totals may have no matching individual entries; it does not claim to reconcile unknown aggregate amounts. Loading, error with retry, and empty states remain explicit. It opens as a native page sheet with a slide transition and swipe dismissal. Its close control stays in a fixed header outside the scroll content. The modal owns its background and bottom safe inset, uses 12-point top padding inside the iOS sheet, and uses the top safe inset on other platforms. A separate Water containers action opens configuration.

The retained `DashboardDayOverview` pattern groups actual logged food entries by meal type, lists their names and calculated meal energy, and opens the selected day's diary. Empty days say that no food was logged. Its logged-entry note makes incomplete coverage explicit. It is not rendered by compact Home. The reference does not authorize invented meals, imagery, counts, or an unsupported “on track” status.

### Mobile food search and Diary rows

Food search gives its input a full-width row below the header controls, followed by visible All, Recent, and Favorites tabs. Close, selection, overflow, and scanning retain their existing actions. Search starts across configured providers and keeps manual provider narrowing available. Labels and empty states follow the app language.

On the selected food's logging screen, the four nutrient tiles read in the same order: category name, amount and unit, then percentage of the daily goal. When no valid goal is available, the final line says “No goal” instead of implying 0%. The tiles use the same categorical colors as the dashboard, diary and web charts; the accessible label states the full amount and goal relationship.

Diary food rows reserve a consistent thumbnail area (48 points) for an actual entry or food image, with an icon fallback when an image is missing or fails to load. Text keeps the same alignment in either state; available photos retain their lightbox action. Decorative food photography does not stand in for missing entry data.

### Mobile Diary timeline and food editing

`DiaryTimeline` keeps the selected day's Recorded and Planned sections distinct and starts collapsible rows closed. Each explicit spoken row name combines its real clock when available, title, and the same localized visible summary: amount, meal calories and item count, duration, dose, or completion/planned state where supplied. Unknown intake and missing dose values are preserved. Rows expose their expanded state; direct-detail rows open their existing destinations. Eligible meals keep `MealStatusControl` outside disclosure at 44 by 44 points. Tap cycles the real meal state, touch-and-hold opens explicit choices, and saving disables the state action. Logged food alone does not imply that the owner marked a meal complete.

Edit replaces the reading timeline with the existing food selection view. A native gesture handle moves a selected food between measured meal targets, with hover feedback and edge scrolling; date swipes are disabled during editing. A successful drop uses the existing bulk move API and preserves the entry's time, quantity, and nutrient snapshot. Cancelling or dropping on the same meal performs no write. Multi-select move, copy, and delete remain available alongside the drag handle. Food capture, offline queues, and Health/Watch export boundaries retain their existing behavior.

### Mobile neon component system

Shared summary motion explains actual changes: the X and energy/hydration gauges retarget from their current endpoint, macro bars update continuously without replaying from zero, and changed status rows/cup markers use a brief opacity transition. Compact Home uses the energy and Daily Progress patterns; hydration and macro patterns remain in their own components. Exact text updates immediately. A separate X halo runs once after a visible known transition to completion. `MotionPressable` gives shared actions and tappable cards a 1.5% compression; native Reduce Motion retains pressed opacity and immediate state updates. Screen blur/backgrounding settles and cancels motion without a deferred replay. Timing, component usage and evidence are in `docs/implementation/dashboard-widget-motion-2026-10-04.md`.

Shared primitives live in `XoTMobile/src/components/ui/`: `glow.ts` (`useGlowTheme`, `withAlpha`, `glowSurfaceStyle`), `GlowCard`, `NeonButton`, `ActionTile`, `IconBadge` and `ScreenBackground`. Dark and AMOLED themes use restrained card glows and a neutral ambient edge light; light uses a soft shadow. The semantic nutrient palette is categorical and stable across percentages: calories slate, protein blue, carbs violet, fat amber and fiber rose. It is separate from the warm-to-green X progress path, which describes distance along the path. `--color-card-glow` governs neutral card light; nutrient, hydration, exercise and action tokens have their own roles. `SettingsRowGroup`, `CreateTile` and Dashboard/Diary cards share the 16-point bordered card.

`TabScreenHeader` gives Diary, Insights and More a Settings button, large title and subtitle; the Dashboard is the exception with Settings on the right. Food search rows offer a quick-add button that opens `QuickAddFoodSheet` (serving, 0.5/1/1.5/2× amount presets, meal, live nutrition) and logs without leaving search; food details offer the same amount presets under the stepper.

### Weekly activity overview on web and mobile

`XoTFrontend/src/components/WeeklyActivityOverview.tsx` and `XoTMobile/src/components/WeeklyActivityOverview.tsx` add a bounded **Operate** pattern: week controls, a localized Monday–Sunday calendar range, per-sport completion counts, and dated activity rows. The web section uses the existing plain `GlowCard`, secondary summary badges, outline state badges, and outline or ghost actions. Mobile uses a vertical section with primary and secondary text, bordered row separators, and the existing `ui/Button` variants. Header and action groups wrap in source; this pattern introduces no palette or typography tokens.

Each row keeps its date, sport, activity name, plan name, and explicit state together. Completion counts leave skipped activities and unknown prescriptions out of the displayed scheduled total. Confirmed set counts retain an explicit unknown expected value when necessary. Unknown prescriptions have a visible explanation; a missing linked session has a recovery hint to undo the decision and choose a saved session on that date. Sequential plans retain a separate explanatory note about their existing next-session workflow.

Workout rows offer Skip while unresolved, Undo for a saved decision, and linking to an eligible confirmed session on the row's date. Web uses a labelled select followed by a separate Link action. Mobile expands an inline list of record buttons, each with an accessible “Link [session name]” label, and closes the chooser after a successful decision. Decision controls are disabled during saving or fetching. Loading, load failure with Retry, an empty schedule, and decision failure remain visible in text; decision failure explains that the activity or account may have changed and asks the user to refresh. Mobile also states when a server connection is required. The workout destination retains the row's date: Diary on web and Exercise Review on mobile. Mobility opens its existing destination.

**Verification boundary:** This addition records component source, shared calendar-week and record-selection helpers, reused primitives, and English locale content on 2026-10-01. Browser checks were skipped at the user's request after saved permission rejected access to `localhost:8080`. No screenshot, simulator, or device capture supports this addition; authenticated appearance, narrow-width behavior, theme rendering, and enlarged-text behavior remain unverified.

### Native Home Screen and Lock Screen widgets

The native calorie, macro, meal-capture, and routine widgets use the app’s semantic palette and the approved Progression X geometry. The small X is static identity artwork. Energy remains slate, protein blue, carbs violet, and fat amber; nutrition rings and bars retain their actual snapshot semantics. Dark full-color widgets use a restrained green corner wash, narrow nutrient halos, and green shortcut outlines. Light widgets use cream surfaces and dark green actions. OS tinted/vibrant modes suppress color and glow; iOS Lock Screen accessories retain transparent backgrounds and recognizable action symbols with a monochrome X detail. Reduce Transparency removes the iOS glow.

Fixed widget frames prioritize numeric values and readable status copy. iOS nutrition metrics place values and wrapping units beside compact rings, with the identity title at the top in both sizes; the rings are excluded from duplicate accessibility announcements. Shortcut outlines are a quiet 22% accent, leaving full-contrast action symbols and data in the foreground. iOS medium shortcuts use a horizontal row with 44-point targets; Android shortcuts use 48dp targets. Native system fonts, localized labels, units, and existing deep links are preserved. Text growth is bounded to the available widget frame; full accessibility labels remain available. Palette and artwork changes must pass `XoTMobile`’s generated-widget asset check. Native content captures and outstanding OS-host/device acceptance are recorded separately in the dated implementation notes.

Medium iOS energy, macro, and nutrition-capture Home Screen widgets add the star shortcut from `targets/widget/WidgetTheme.swift` to the existing food picker, initially on Favorites. The route also supports Recent. The localized “Quick add” action opens selection; it does not log an entry. The existing portion-review sheet remains the write boundary. Photo, search, scan, and small-widget destinations remain available. Normal and enlarged German evidence shows actual SwiftUI content only; OS hosting, cold/resumed handoff, account switching, and offline portion review remain unverified.

## Do's and Don'ts

### Do:

- **Do** put current context before the detailed controls on these Settings surfaces.
- **Do** keep labels task-oriented and use the English locale entries as the copy source.
- **Do** keep connection and sync information truthful in loading and error states.
- **Do** preserve accessible names, focus indicators, navigation destinations, and URL section aliases.
- **Do** keep native Dashboard actions at usable touch sizes and let larger text stack and scroll.
- **Do** derive Dashboard balances, meals, goals, and pending hydration states from actual app data.
- **Do** preserve the approved X on Track assets and “Keep getting better.” product identity; the Dashboard header shows the logo, name and tagline with Settings in the upper-right corner.
- **Do** preserve the selected day in Dashboard detail destinations and explain gaps between hydration totals and individual drink entries.
- **Do** keep Diary Recorded before Planned, sort earliest first within each section, and label untimed entries without inventing occurrence clocks.
- **Do** keep visible Diary summaries in spoken row names and announce the energy center as remaining, over target, or consumed before its edit action.
- **Do** move Diary clocks above their content at enlarged text sizes and preserve separate 44-by-44-point disclosure and meal-state controls.
- **Do** keep training and health detail subordinate to the retained Home, Diary, Add, Insights, and More navigation.

### Don't:

- **Don't** present a color dot as the only status indicator.
- **Don't** invent account, connection, sync, or health status from decorative UI.
- **Don't** collapse unrelated settings into one unlabelled group.
- **Don't** turn the Dashboard reference's sample calculations, profile, bell, imagery, or counts into product facts.
- **Don't** shrink the Dashboard as a whole to fit a screenshot or apply its native composition to web Settings.
- **Don't** use capsule shapes for the refreshed mobile filters, badges, or actions; retain the meaningful circular controls and progress indicators.
- **Don't** treat a widget picker shortcut as a logged meal or commit an incomplete web clock draft.
