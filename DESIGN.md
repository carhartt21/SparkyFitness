---
name: X on Track Settings and Mobile Dashboard
description: Bounded Settings patterns for mobile and web, plus native Home, Diary and daily Meals, Training and hydration patterns
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
  dashboard-action: "12px"
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
    backgroundColor: "rgba(201, 76, 51, 0.07)"
    textColor: "{colors.text-mobile-light}"
    rounded: "{rounded.dashboard-action}"
    padding: "8px 4px"
  mobile-dashboard-details:
    textColor: "{colors.brand-green-mobile-light}"
    typography: "{typography.small-label}"
  mobile-dashboard-macro-row:
    textColor: "{colors.text-mobile-light}"
    padding: "4px 0"
  mobile-button-primary:
    backgroundColor: "rgba(11, 94, 70, 0.16)"
    textColor: "{colors.text-mobile-light}"
    rounded: "{rounded.dashboard-action}"
    padding: "14px 16px"
  mobile-button-outline:
    backgroundColor: "rgba(11, 94, 70, 0.07)"
    textColor: "{colors.text-mobile-light}"
    rounded: "{rounded.dashboard-action}"
    padding: "14px 16px"
  mobile-button-secondary:
    backgroundColor: "rgba(255, 253, 248, 0.76)"
    textColor: "{colors.text-mobile-light}"
    rounded: "{rounded.dashboard-action}"
    padding: "14px 16px"
  mobile-button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.brand-green-mobile-light}"
    rounded: "{rounded.dashboard-action}"
    padding: "14px 16px"
---

# Design System: X on Track Settings and Mobile Dashboard

## Overview

**Creative North Star: "Status overview plus clear sections"**

This record covers the implemented Settings surfaces (`XoTMobile/src/screens/SettingsScreen.tsx`, `XoTMobile/src/components/SettingsRow.tsx`, and `XoTFrontend/src/pages/Settings/SettingsPage.tsx`) and the native mobile Home (`DashboardScreen.tsx`), Diary (`DiaryScreen.tsx`, `DiaryTimeline.tsx`), daily Meals (`DailyMealsScreen.tsx`), daily Training (`DailyTrainingScreen.tsx`), unified hydration (`WaterLogScreen.tsx`), and their subordinate training and health destinations. It also records the bounded food-search and Diary row patterns used by the mobile logging flow, native launch-icon quick actions, Home Screen widget shortcuts, and the shared web clock input. It is not a claim about every screen in either app. The Settings experience is an **Operate** surface: people check their current context, find a category, and reach a specific setting. The mobile Settings screen is a root-stack page opened from the Settings action on content tabs; it leads with an account card (profile name or a neutral fallback plus the connected server host) and then server and sync state. The web Settings screen leads with the active profile and five named sections. Home and Diary composition below is scoped to native mobile and does not extend the web Settings rules.

The light themes use warm cream backgrounds, darker text, and a restrained green accent; the dark themes keep the same semantic roles with darker surfaces and brighter green. Status copy reports observed connection and sync history, including checking and unavailable states. Sections and controls use the actual English locale strings, with translations supplied by each app's i18n system.

The native Home, Diary and daily detail pages are **Operate** surfaces. Home leads with actual daily task progress, then the selected day's compact energy intake/allowance, Training summary and four logging actions. Meals owns daily food editing; unified hydration keeps logging and its source ledger together. Diary separates recorded evidence from scheduled work while keeping meal-state controls available on collapsed rows. The approved [Home/Training board](docs/implementation/evidence/v45-diary-meals-training-2026-10-07/approved-home-training.png) and [Meals/Diary/hydration board](docs/implementation/evidence/v45-diary-meals-training-2026-10-07/approved-meals-diary-hydration.png) guide this bounded refinement; the second board's Home panel is superseded. The five tabs remain. Home retains the approved logo target, “X on Track” name, localized “Keep getting better.” tagline, upper-right Settings action, and full-width date bar underneath. The approved artwork and identity remain product commitments. Reference names, amounts, times, and counts are illustrative; the implementation preserves real data and destinations. These phone layouts do not prescribe a broader web composition.

**Verification boundary:** The Settings record remains based on source code, theme tokens, and English locale content; its authenticated appearance and viewport behavior were not verified during that documentation pass. Earlier Dashboard evidence remains historical in `docs/implementation/dashboard-alignment-2026-09-26.md`, `docs/implementation/archive/ui-2026-09-26/mobile-header-controls-2026-09-26.md`, `docs/implementation/archive/ui-2026-09-26/dashboard-stacked-summaries-2026-09-26.md`, and `docs/implementation/v44-diary-refinement-2026-10-06.md`. The current refinement is recorded in [the V45 implementation record](docs/implementation/v45-diary-meals-training-refinement-2026-10-07.md). Its evidence packet includes 39 matrix captures, one supplemental hydration capture and 12 latest `owner-` Home/Diary captures, with German simulator tours at 390 points in dark/light and 430 points with enlarged text. The [owner follow-up results](docs/implementation/evidence/v45-diary-meals-training-2026-10-07/owner-followup-simulator-results.json) record three passing native interaction tours. The latest ordinary Home captures show consumed energy and allowance inside the arc with all four logging tiles; enlarged text shows unrestricted plain intake/allowance, and Diary captures show the fork-and-knife meal glyph. Named captures show their scroll positions. Isolated synthetic fixtures verify navigation, app actions and refreshed summaries; they do not prove real-server persistence. The record reports the mobile full and focused regressions, focused server tests, all three package validations, and a successful iOS Simulator Debug build including generated Watch targets. The [round-two bounded verdict](docs/implementation/evidence/v45-diary-meals-training-2026-10-07/verdict-round2.md) resolves the eight scored UI fixes and predates the owner intake/icon correction; latest source and the separate owner follow-up captures document that correction. The [owner follow-up finish review](docs/implementation/evidence/v45-diary-meals-training-2026-10-07/finish-owner-followup.md) gives a ship disposition only for the Home intake center and Diary meal glyph; it does not accept broader Meals/Training board fidelity or physical-device behavior. Neither bounded review is whole-app or release acceptance. No HTML/CSS detector ran for this native-only batch. Historical web evidence covers the actual shared clock input on an isolated review page, not authenticated Settings; historical widget evidence covers actual SwiftUI content previews with synthetic data and compatible preview environment keys, not WidgetKit hosting. Physical iPhone/Watch interaction, VoiceOver, Android, Health/Fitness export, phone–Watch round-trips, actual widget deep-link lifecycle, hardware offline replay, signed release archives, upload and deployment remain unverified. [The deferred-task completion record](docs/implementation/deferred-tasks-completion-2026-10-07.md) closes the Hevy visibility/import investigation: read-only production/import inspection and authenticated historical Diary reads confirmed nonempty imported CSV workouts on their original dates. Source-by-source CSV/routine accuracy and device acceptance remain unverified. This documentation refresh adds no new rendering or application test run. Native measurements in the portable frontmatter use px notation for React Native logical layout units.

**Current phone alignment:** [The phone button and Meals/Training record](docs/implementation/phone-buttons-meals-training-alignment-2026-10-07.md) captures the shared action material and closer daily/weekly composition now implemented. The current `aligned-` German iOS simulator captures cover 390-point dark/light and 430-point enlarged text, including the lower meal and weekly footers. [The finish review](docs/implementation/evidence/v45-diary-meals-training-2026-10-07/finish-button-alignment.md) resolves the four layout corrections and the introduced German Daily details word break, with ship disposition only at that scored-fix scope. The full mobile run passed 7,904 tests before the bounded corrections; 24 focused tests, mobile validation and three native render/interaction cases cover the follow-up. These are native phone adaptations of the approved boards: platform headers and calendar controls, existing symbols, real data and enlarged-text reflow remain authoritative. Android source shares these patterns, but Android/device behavior and whole-app visual acceptance remain unverified. This documentation merge adds no application test run.

**Completed Watch direction:** The Watch `ContentView.swift` now orders its `TabView` children as **Daily Goals → Nutrition → Water → Food quick logging → Workout → Entry → Trend**. Page tags remain stable, an active workout retains its initial destination, and existing complication links and sync gates remain. [The deferred-task completion record](docs/implementation/deferred-tasks-completion-2026-10-07.md) documents a source-level finish review with a ship disposition for this navigation refinement, successful Watch compilation, 19 passing synthetic native assertions, and four 42 mm watchOS 26.2 captures of existing goals/intake content. Actual swipe interaction and phone–Watch/physical pairing remain unverified: Simulator UI access failed with `cgWindowNotFound`. This bounded change adds no page styling or design tokens; release acceptance remains unverified.

**Key Characteristics:**

- Grouped settings with headings that name the user's task.
- Current account or connection context near the top of the page.
- One destination per mobile row; category tabs and expandable settings on web.
- Visible text and accessibility labels for state, with color as a supporting cue.
- Compact native Home with daily progress, energy, Training and four logging actions above further detail destinations.
- Recorded-before-planned Diary sections with truthful times, visible meal-state actions, and text that reflows as it grows.
- Dedicated daily Meals, Training and hydration pages that preserve the selected day and existing recording flows.
- Shared rounded-rectangle phone actions with translucent material, restrained glow and readable native touch targets.

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

The V45 daily surfaces retain those tokens. Food rows use the food action color, actual/planned training uses the training action color, hydration uses `--color-hydration`, and supplement icons use the stable green `--color-accent-primary` in Diary and hydration history. The daily hydration arc is categorically cyan; it does not reuse the energy gradient. Daily meal macro amounts retain protein, carbohydrate and fat category colors.

## Typography

The Settings surfaces inherit each platform's default font stack; neither target sets a custom family. Hierarchy comes from size and weight. Mobile uses a bold page title, bold section headings, semibold row names, and smaller secondary lines. Web uses a semibold page title, section heading, compact tab labels, and muted descriptive copy.

**The Scan First Rule.** Keep section names and setting titles stronger than explanatory text. Preserve meaningful labels when they wrap; the mobile row title has no line limit by default.

### Mobile Dashboard

Home uses the native font stack, a medium-weight date control (14 points), a centered bold energy value, strong summary headings, and readable supporting text. Retained hydration, exercise, and nutrient components keep their existing typography tokens on their own surfaces. At font scales above 1.3, Daily Progress stacks, the energy and daily hydration summaries remove their arcs in favor of plain values, and quick actions wrap into two columns. `DailyMetricTable` stacks the Meals energy/macro metrics and Training session/minute metrics; paired daily and weekly Training actions become full-width rows, and the meal footer puts its complete template label below the icon actions. Meal titles and summaries reflow. The custom bottom tab bar is a bounded exception: visible labels fit on one line with a maximum multiplier of 1.2 and retain their full accessible names.

Diary timeline titles use semibold native body text (16 points), with clocks and summaries at 14 points. Clocks use tabular numerals and a single line. Above a font scale of 1.3, `HH:mm` moves above the title and summary in the content column instead of squeezing into the ordinary 44-point gutter. Titles and summaries wrap naturally; disclosure and eligible meal-state controls retain separate targets of at least 44 by 44 points.

**The Dashboard Reading Rule.** Keep Dashboard text readable and let content scroll or stack; never scale the entire screen to reproduce the reference screenshot.

## Layout

Mobile is a vertical scroll of titled groups with a 20px horizontal gutter. Each group is a single rounded surface with 16px row padding, 40px icon tiles, and subtle separators. The server and health sync rows come first; app experience, tracking, family, and help follow. Connection-dependent rows appear only when connected. Row icons sit on tinted tiles using the existing semantic hex tokens (hydration, energy, exercise, nutrient colors); non-hex tokens fall back to the raised surface. The screen adjusts for the safe area, active workout bar, and native iOS header behavior.

Web uses a centered container capped at 72rem. A heading and active-profile summary sit above five sections: Profile & Account, Nutrition & Tracking, Wellness, Family & Sharing, and Data & Connections. Section tabs form a two-column grid at the narrowest widths, three columns from the `sm` breakpoint (640px), and a sticky 15rem sidebar from `lg` (1024px). The selected section has its own heading and description; its settings are expandable accordion items. URL `tab` and `section` values select and open destinations, including legacy aliases.

**The Destination Rule.** Keep a category label, its controls, and deep-link section IDs aligned when changing the Settings layout. Mobile rows continue to navigate to their existing screens.

### Mobile Dashboard

The native Home scrolls vertically with a 16-point horizontal gutter over the ambient `ScreenBackground`. Its sequence is the identity header and shared `DateBar`; Daily Progress when enabled; compact calories with intake and allowance inside the gauge; the selected-day Training summary; four neon `ActionTile`s (food, exercise, water, scan); a pending-water retry notice when needed; then the retained bordered group linking to nutrition details, hydration, and Training & routines. The ordinary Daily Progress heading sits above the 100-point X in its 128-point left visual column, with all four category rows on the right. The final ordinary 390-point captures show the full Training card and all four logging labels above the tab bar. Extra state copy remains scrollable. Hydration can show confirmed consumption beside its retained detail link. Loading, unavailable, and saved-summary states remain explicit. At font scales above 1.3, Daily Progress stacks and logging actions wrap into two columns. Date navigation, summary rows and actions retain at least 44-point targets; detail rows have a 56-point minimum height. Today appears only when another day is selected. Native-tab configurations keep the native date-picker header and a right-side Settings item.

### Mobile daily Meals, Training and hydration

`DailyDetailScreen` gives these pushed pages back navigation, the shared full-width date bar and calendar, safe-area-aware vertical scrolling with a 16-point gutter, and pull-to-refresh. Date changes update the shared selected day; Meals exits selection mode before changing it. Their contents reuse incumbent bordered surfaces and controls. They are detail destinations under the five-tab navigation, not new tabs.

Daily Meals leads with a compact three-column energy table: known consumption, remaining/over-target energy and adjusted allowance when a valid goal exists. Vertical rules separate those values; a horizontal rule separates the categorical, label-first macro row. The pending-photo coverage note appears only when unresolved nutrition exists. A primary Food action and a secondary camera target precede compact collapsed meal headers; Edit stays in the native header. Daily Training places the weekly-plan destination above a ruled session/minute table, paired primary Start and secondary Record actions, the separate Mobility destination, Recorded, then Planned. Weekly Training uses a seven-day selector, selected-day counts and seven compact expandable day groups; Create plan and Day details sit together after the itinerary. Unified hydration places its cyan daily gauge and shared logger above source totals, the solid-food details note, and source/history rows. Each page scrolls as text grows; no page-wide scaling or layout constraint from this phone composition applies to Settings or web.

### Mobile Diary

Diary's timeline uses the same 16-point page gutter, identity-led header, upper-right Settings action and shared date bar. Recorded (**Erfasst**) precedes Planned (**Geplant**). Each section sorts independently from earliest to latest occurrence or scheduled time, then places entries without a trustworthy clock in a labelled untimed group. Ordinary rows align time, category icon, title/summary, and action within bordered 16-point groups with 12-point horizontal padding. Enlarged text moves the single-line clock above the content while preserving the category cue and separate action target. Recorded meals use their earliest actual food time, never today's configured meal schedule. Workouts show their actual activity type/icon and recorded clock; known imported type labels are localized while custom and Hevy names stay literal. The clock comes from retained entry/source timing and its recorded timezone/offset or account timezone. Missing source clocks, measurements with only a day, and backfilled logs without occurrence evidence stay untimed. Daily active-energy aggregates are excluded from workout rows. Meal rows use the scoped fork-and-knife icon rather than the stack glyph. Meals start collapsed; resolving an eligible empty meal keeps it visible in Recorded without fabricating an occurrence time. Optional planned-meal prompts, photos, coverage notes, and daily nutrition retain their own existing places around the timeline.

**The Diary Evidence Rule.** Keep Recorded before Planned, sort within each section, and leave missing occurrence times untimed. Present the same localized summary visually and in the row's spoken name; unknown amounts or doses remain unknown.

### Mobile navigation and detail destinations

Keep the five-position navigation: Home, Diary, central Add, Insights, and More. The Home energy/consumption target opens `DailyMeals({date?, mealTypeId?})`; its separate goal icon opens Calorie settings. The compact Training summary opens `DailyTraining({date?})`. Hydration details consistently open the existing `WaterLog({date?})`, which combines logging and history. The retained `TrainingHubScreen` still groups weekly plans, workout presets, guided mobility and recorded training from the existing Home detail group and More; daily Training is not a replacement tab. `HealthOverviewScreen` holds separate trends, caffeine, and configurable health/routine sections reached from existing navigation. These destinations use back navigation, safe-area-aware scrolling, existing card/list primitives, and explicit loading, error, empty, or offline copy. Training and dated health content retain the passed date or shared selected-day fallback; range-based health trends keep their existing 7d/30d/90d controls.

## Elevation & Depth

The mobile row group and standalone row use the existing small shadow utility; their surface fill and separators do most of the grouping work. The web Settings page uses card fill, accent fill, and borders without a page-specific shadow on its profile card, tabs, or accordion items. Do not imply a stronger elevation hierarchy than these source surfaces establish.

Home's energy, Daily Progress and Training cards, compact detail group, daily meal groups, and Diary timeline groups use the incumbent surface fills, neutral glow, and subtle borders. Daily hydration uses its existing cyan border/glow; retained hydration and exercise variants preserve their own bordered treatments. The custom tab bar's central Add action retains its platform shadow/elevation. These local treatments do not redefine Settings or web elevation.

Phone action depth comes from `buttonTheme.ts`: a restrained 10-point dark/AMOLED glow around the semantic or neutral edge, and a small neutral shadow in light mode. Primary glow uses the edge at 20% opacity; outline and secondary use 10%. Disabled, loading, ghost, header and link actions omit glow. This material is translucent color rather than a blur effect.

## Shapes

Mobile groups use 12px corners and icon tiles use 8px corners. Web section tabs and accordion items use 8px corners; the profile summary uses 12px. Thin separators and borders mark boundaries without turning each mobile row into a separate card.

Cards use 16-point corners (`GlowCard`). Phone action buttons, quick-action and creation tiles, filters and pickers use the shared 12-point rounded rectangle from `buttonTheme.ts`; `NeonButton` is a compatibility adapter for that same material. Native navigation chrome, camera shutters, semantic state circles, icon badges, progress graphics, the central Add action and tappable content cards retain their purpose-specific geometry. `MealStatusControl` displays its state glyph in a transparent 44-by-44-point target without a surrounding button frame. The compact Home energy gauge is a 270° arc (`EnergyGauge`), 130 points across with a 12-point stroke. Daily hydration uses the same open-arc geometry at 212 points with a 15-point stroke and a single cyan color. Both are supplementary to textual values and are omitted at enlarged text sizes. These are local component dimensions, not new system tokens. Floating workout `LiquidGlassSurface` chrome keeps 16-point container corners.

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

### Mobile phone action buttons

Scheduled workout assignments expose a full-width primary **Start routine**
action with the existing play symbol, followed by an outline **Log activity**
action for activity-type plans. These actions stack at ordinary and enlarged
text sizes; rest days offer neither. Saved presets/exercises start directly,
while an activity-only assignment opens the existing routine picker with a
localized planned-session context line. Selection and preview retain the
assignment without editing the plan. This phone refinement is currently on
`feat/scheduled-workout-routine-start-20261007`, pending release.

`ui/Button` and `NeonButton` share `useButtonAppearance` in `buttonTheme.ts`, with a minimum 44-point touch height. Primary actions use a 16% semantic tint and 65% tinted edge; outline and destructive actions use a 7% tint and 40% edge. Secondary actions use the current elevated-surface token at 76% opacity with a 40% neutral edge. Primary, outline and secondary labels use the primary text role; destructive text uses its danger tint. Ghost, header and link actions keep transparent surfaces and quiet accent text, with the existing neutral option for secondary/header-like copy.

The material is applied after caller styles. Callers supply layout, icons, semantic tint, translated labels and action state; radius, fill and glow stay shared. `ActionTile` uses the outline material and its existing 72-point minimum; `CreateTile` uses secondary material and retains its icon/title/subtitle anatomy. Disabled/loading actions block presses and remove glow; loading replaces the label with a spinner. `Button` allows two visible label lines; `NeonButton` bounds visible labels while keeping the full accessible name. `scripts/check-button-theme.mjs`, included in mobile `validate`, checks shared-button callers for conflicting surface classes and inline overrides.

### Mobile Dashboard energy and quick actions

Daily Progress uses `DashboardSummaryCard` with 12-point horizontal and 8-point vertical padding, a compact left heading above the 100-point X in a 128-point column at ordinary text sizes, 28-point row icon holders, and all four category rows with at least 44-point targets. Above a font scale of 1.3 or below 280 points of available content width, the card stacks. `CalorieRingCard` retains an ordinary-text height of 184 points with a 130-point body: an 18-point bold heading with a food-colored flame and separate 44-point goal-icon target sit above Protein/Carbs on the left, the 130-point energy arc in the center, and Fat/Water on the right. The center uses four lines with 2-point gaps: consumed energy (26-point bold), localized “of”/“von” (12 points), adjusted allowance (16-point medium), then “kcal” (12 points). At ordinary text sizes, the entire four-line group is optically centered 8 points lower inside the open-bottom arc; the gauge and card dimensions stay fixed. No extra text appears below the gauge. The Training summary follows calories before the four 72-point-minimum quick actions; further detail links remain below. These local frames preserve shared tokens and do not impose a global card height.

Above a font scale of 1.3, the existing arc-free center takes the available space between 64-point side columns. It retains the four-line hierarchy with intake (34 points), connector and unit (16 points), and allowance (20-point medium). Compact side labels and percentages use 11-point type with 14-point line height, one visible line, and font multipliers capped at 1.4 and 1.6 respectively; their full localized names and amounts remain in the spoken labels. The screen scrolls as text grows. The 184-point card height applies to ordinary text, not every accessibility size.

`DashboardHeader` starts with the approved logo in a bordered Home target that resets the day, the product name and tagline, and the Settings action in the upper-right corner. `DateBar` (shared with Diary and daily details) holds previous-day, the calendar date that opens the picker, a Today control on other days, and next-day. `EnergyGauge`'s red→yellow→green gradient describes distance along the arc, not health quality. Its center opens the selected day's daily Meals and announces the same intake and adjusted allowance, then “Open daily meals.” Only the separate heading icon edits the goal. Allowance remains consumed plus remaining, using the server's exercise adjustment exactly once. The intake text retains its neutral color with a subtle green shadow below or equal to the adjusted allowance and red above; light theme uses a weaker shadow. Without a finite positive configured goal and adjusted allowance, intake stays visible with an explicit unset-target message and no colored intake shadow. Remaining/over-target copy and extra intake, burned or base-target rows are absent. The card border and glow stay neutral.

Each read-only side display has a localized label, a 4-point rail and a numeric percentage. Protein blue, carbohydrate violet, fat amber and hydration cyan stay categorical. Known zero consumption with a valid goal shows 0%; unavailable/invalid consumption or a missing/nonpositive goal shows an unfilled baseline and em dash, with spoken labels distinguishing unknown data from known intake without a target. Fill caps at 100% while the visible and spoken percentage can exceed 100%; full nutrient names, amounts, units and goal relationships remain available to accessibility. `DashboardScreen` passes the selected day's actual protein, carbs, fat and water summaries, honoring the net-carbs preference and preferred water unit. These `MacroSummary` props are optional for existing callers. Side fills use the existing interruptible, reduced-motion-aware `useTweenedValue` hook.

[The intake-card implementation record](docs/implementation/intake-card-progress-2026-10-07.md) and [native results](docs/implementation/evidence/intake-card-progress-2026-10-07/results.json) cover five simulator cases: German 390-point dark/light, German 430-point enlarged text, English above-target AMOLED, and German unset goals. The independent finish review returned ship only for this intake-card scope. Ordinary captures retain the 184/130-point card/body; enlarged height is an observation, not proof of equal height across text sizes. Physical-device, Android and actual VoiceOver interaction remain unverified. This documentation merge adds no rendering or application test run.

The four labelled quick actions preserve their real destinations. Food opens dated food search, Exercise opens exercise logging, Water adds the configured amount or opens container setup, and Scan opens dated food scanning. They do not imply unimplemented profile, notification, or photo actions from the reference.

### Mobile launch-icon quick actions

**The Native Launch Menu Rule.** Launch-icon quick actions use the operating system menu with localized task labels and semantic platform icons. The operating system owns menu typography, spacing, color, shape, and motion; app control tokens do not restyle this surface. Selecting an action opens an existing editor for local today without saving an entry or resetting the navigation stack.

The four actions open food scanning, food search, activity logging, and measurements. Readiness and setup gates retain a pending action until navigation can open its destination. Existing activity connection and draft-conflict prompts remain in force. The scanner's camera-permission loading and request states include a visible Cancel action so entry from the launch icon has an exit. Source, scoped review evidence, and remaining platform verification limits are tracked in `docs/implementation/launch-icon-actions-2026-09-26.md`.

### Mobile Dashboard saved and unavailable states

A configured but unreachable server is labelled unavailable. Saved summaries are scoped to the selected server account and day, limited to seven cached days, and expire seven days after saving. A displayed saved summary carries an explicit saved-at timestamp. Without a saved summary, the screen explains that the selected day is unavailable and offers Retry. Available Apple Health steps and active energy appear separately as device data for that day; missing readings remain unknown, and local activity does not change the saved energy allowance.

### Retained mobile nutrient rows

`MacroCard` in row mode places the nutrient name, slim progress rail, amount/goal, and explicit percentage on one line at ordinary text sizes. Rows have a 28-point minimum height, 13-point medium labels, 12-point values, and an 8-point rail. At ordinary text sizes, the label uses 26% of the row, the amount uses 72 points, the percentage uses 30 points, and the gaps are 5 points. The compact carbohydrate label is “Carbs” in English and “KH” in German; the full localized nutrient name remains in the accessible label. At font scales above 1.3, the same content stacks across multiple lines. Nutrient visibility preferences and supplement nutrition remain part of the existing nutrition flow; compact Home now opens the selected day's nutrition-detail destination rather than rendering this card. A missing goal omits the denominator, rail, and percentage rather than displaying a false zero target. Amounts and percentages use the app's localized number formatting; visual fill is capped while the numeric percentage can exceed the goal.

### Mobile daily hydration and retained exercise/meal overview

`WaterLogScreen` uses `HydrationGauge`'s daily presentation: a centered cyan arc with confirmed goal-counting consumption, preferred unit and goal text above the shared add/remove logger and container choices. A missing goal stays explicitly unset. Above a font scale of 1.3, an unrestricted plain central value replaces the arc. Confirmed water, drinks and declared water in supplement drinks count toward the goal; solid-food water is informational only. Pending actions and saved actions needing attention remain distinct in text, with the existing save/retry queue authoritative. Selected containers expose selected state and primary-colored text; logging, quick amounts and container configuration preserve their real actions.

The retained full, tile and options hydration variants keep their logger semantics. Compact cards omit the selection chip when only one container exists, while retaining the add amount and all choices when multiple containers are available. Expanded cards retain the single-container chip. `ExerciseProgressCard` shows the available exercise values and goals with its logging action. These retained patterns no longer form a full-width stack on Home; its daily Training card and hydration destinations provide the dated detail routes.

Both cards use `DashboardSectionHeader` with a section-specific accessible name. The expanded header has a separate Details action and a minimum 44-by-44-point target. In the retained compact variants, the icon, title, Details caption, and disclosure are a single pressable header at least 44 points high; title and caption occupy two lines within that target. Exercise Details keeps the existing exercise report and its selected-date contract.

`HydrationHistory` replaces the separate modal with source totals, solid-food details and history inline on the selected day's `WaterLogScreen`. Each source row keeps its known amount or explicit unknown value, literal name, actual 24-hour clock or unavailable-time label, source and goal-counting policy together. Supplement glyphs stay green; water/drinks stay cyan and solid-food glyphs use the food action color. Known recorded water can be deleted after confirmation; linked food and supplement records open their original Meals or supplement destination for editing. Older/imported totals without individual timing remain explicit daily records. Loading, error with Retry, empty history and uncached offline unavailability remain explicit. The source rows reflow at enlarged text sizes. Water containers remains a separate configuration action.

The retained `DashboardDayOverview` pattern groups actual logged food entries by meal type, lists their names and calculated meal energy, and opens the selected day's diary. Empty days say that no food was logged. Its logged-entry note makes incomplete coverage explicit. It is not rendered by compact Home. The reference does not authorize invented meals, imagery, counts, or an unsupported “on track” status.

### Mobile food search and Diary rows

Food search gives its input a full-width row below the header controls, followed by visible All, Recent, and Favorites tabs. Close, selection, overflow, and scanning retain their existing actions. Search starts across configured providers and keeps manual provider narrowing available. Labels and empty states follow the app language.

On the selected food's logging screen, the four nutrient tiles read in the same order: category name, amount and unit, then percentage of the daily goal. When no valid goal is available, the final line says “No goal” instead of implying 0%. The tiles use the same categorical colors as the dashboard, diary and web charts; the accessible label states the full amount and goal relationship.

Diary food rows reserve a consistent thumbnail area (48 points) for an actual entry or food image, with an icon fallback when an image is missing or fails to load. Text keeps the same alignment in either state; available photos retain their lightbox action. Decorative food photography does not stand in for missing entry data.

### Mobile Diary timeline and food editing

`DiaryTimeline` keeps the selected day's Recorded and Planned sections distinct and starts collapsible rows closed. Each explicit spoken row name combines its real clock when available, title, and the same localized visible summary: amount, meal calories and item count, duration, dose, or completion/planned state where supplied. Unknown intake and missing dose values are preserved. Rows expose their expanded state; direct-detail rows open their existing destinations. Eligible meals keep `MealStatusControl` outside disclosure at 44 by 44 points. Tap cycles the real meal state, touch-and-hold opens explicit choices, and saving disables the state action. Logged food alone does not imply that the owner marked a meal complete.

Meal timeline rows use `fork-knife` without changing the shared `meal` icon mapping. Workout rows use the actual activity icon and source clock through `workoutPresentation`; daily active-energy aggregates are excluded from both Diary workout rows and daily Training counts/minutes. Imported canonical activity labels are localized, while authored and Hevy names remain literal. Unknown clocks stay in the untimed group rather than becoming midnight or the import time.

Edit replaces the reading timeline with the existing food selection view. `useDiaryFoodEditing` and `useFoodDragScroll` share selection, bulk actions and drag-edge scrolling with daily Meals. A native gesture handle moves an eligible selected food between measured meal targets, with hover feedback and edge scrolling; date swipes are disabled during editing. A successful drop uses the existing bulk move API and preserves the entry's time, quantity, and nutrient snapshot. Cancelling or dropping on the same meal performs no write. Multi-select move, copy, and delete remain available alongside the drag handle. A synchronous mutation guard prevents duplicate copies, and changing the day cannot apply an old response to a new selection. Food capture, offline queues, and Health/Watch export boundaries retain their existing behavior.

### Mobile daily Meals and task recording

`DailyMealsScreen` projects existing food summaries, explicit meal states, captures and outbox entries; it does not create a separate logging store. `FoodSummary`'s daily meal groups start collapsed, with a category glyph, complete title, compact clock/calorie/food-count or pending summary, disclosure and eligible `MealStatusControl` as independent targets. Expanded groups show compact 40-point food thumbnails with an actual image or fallback, literal food names, amounts, known energy and actual recording clocks, plus the quiet ellipsis serving action. A ruled footer puts secondary Add food and Meal details icon targets (44 by 44 points) beside the quiet Save as template action at ordinary text size; enlarged text moves the complete template label to a full-width row below the icons. Selection mode exposes the established move/copy/delete and drag controls. Metric tables, food rows and headers reflow without compressing food names.

Save as template passes a create-only `diaryMealDraft` to the existing meal editor. It preserves recorded per-serving nutrient snapshots, ingredient quantities and units, while excluding entry IDs, dates/times and photos. A deleted food, missing reusable serving variant or unresolved nutrition requires explicit review; the user can cancel or choose the resolved ingredients when any exist. No library identity or nutrition is fabricated, and the editor remains the save boundary. Pending photos remain pending until nutrition is confirmed. An unavailable calorie goal is not rendered as a zero allowance.

Task circles have a real action: completion habits record completion, numeric habits open/focus input with an explicit save, meals use their existing state cycle/menu, and training/supplement/other domains open their established start or recording flow. `HabitRow` circles and number steppers retain 44-point targets and wrap under narrow content. Future selected days retain detail navigation but cannot complete habits or meals through shortcuts; the account-timezone guard also protects the mutation callback. New mobile copy is reviewed in German, uses 24-hour clocks and neutral Sie outside notifications, and preserves user/provider names literally.

### Mobile daily and weekly Training

`TrainingSummaryCard` opens the selected day's `DailyTrainingScreen`. Actual workout duration and terminal mobility session elapsed time produce the session/minute summary; mobility elapsed time includes pauses and is not measured active time. Planned durations and daily active-energy aggregates never enter those totals. Failed/loading mobility reads withhold exact combined counts/minutes while known records remain visible, and Retry reloads the failed source. Planning errors retain partial-data copy. This page creates no calorie estimate.

Daily Training uses `DailyMetricTable` for actual session and recorded-minute values with activity/timer glyphs and a central rule. Start and Record remain paired at ordinary text size and stack above font scale 1.3; Mobility has its own secondary row. `TrainingSessionRow` aligns the actual clock, activity glyph, title, useful known duration/energy/distance and disclosure; enlarged text moves a known clock above the title. Unknown energy and unavailable clocks stay explicit. Recorded and Planned remain separate, with their existing detail/start/log/mobility destinations.

`WeeklyTrainingItinerary` extends `WorkoutPlansScreen` with week navigation and seven day selectors, selected-day recorded/scheduled counts and compact ruled session rows inside dated day groups. Day headers have at least 44-point targets and keep date/count metadata on one line at ordinary size; enlarged text separates them. Recorded rows put their state inline with the title at ordinary size and reflow at enlarged size. Weekly records lack source clocks/durations in the planning response, so those values remain absent; records open actual daily detail. Workout occurrences open the retained plan editor and mobility occurrences open daily detail. Primary Create plan and secondary Day details follow the itinerary and stack at enlarged text size; German uses visible “Tagesdetails” with the full accessible “Tagesübersicht.” Existing plan editing, activation and legacy plans remain available. Empty days state that no training is planned; they do not invent rest-day intent. Reads neither create nor complete plan occurrences.

### Mobile neon component system

Shared summary motion explains actual changes: the X and energy/hydration gauges retarget from their current endpoint, macro bars update continuously without replaying from zero, and changed status rows/cup markers use a brief opacity transition. Compact Home uses the energy and Daily Progress patterns; hydration and macro patterns remain in their own components. Exact text updates immediately. A separate X halo runs once after a visible known transition to completion. `MotionPressable` gives shared actions and tappable cards a 1.5% compression; native Reduce Motion retains pressed opacity and immediate state updates. Screen blur/backgrounding settles and cancels motion without a deferred replay. Timing, component usage and evidence are in `docs/implementation/dashboard-widget-motion-2026-10-04.md`.

Shared primitives live in `XoTMobile/src/components/ui/`: `glow.ts` (`useGlowTheme`, `withAlpha`, `glowSurfaceStyle`), `buttonTheme.ts`, `Button`, `GlowCard`, `NeonButton`, `ActionTile`, `IconBadge` and `ScreenBackground`. Dark and AMOLED themes use restrained card glows and a neutral ambient edge light; light uses a soft shadow. The semantic nutrient palette is categorical and stable across percentages: calories slate, protein blue, carbs violet, fat amber and fiber rose. It is separate from the warm-to-green X progress path, which describes distance along the path. `--color-card-glow` governs neutral card light; nutrient, hydration, exercise and action tokens have their own roles. `SettingsRowGroup` and Dashboard/Diary cards share the 16-point bordered card; creation tiles use the shared action material.

`TabScreenHeader` gives Diary, Insights and More a Settings button, large title and subtitle; Diary's refined identity-led header keeps Settings on the right and the logo opens Home. Dashboard retains its product-name/tagline header. Food search rows offer a quick-add button that opens `QuickAddFoodSheet` (serving, 0.5/1/1.5/2× amount presets, meal, live nutrition) and logs without leaving search; food details offer the same amount presets under the stepper.

### Weekly activity overview on web and mobile

`XoTFrontend/src/components/WeeklyActivityOverview.tsx` and `XoTMobile/src/components/WeeklyActivityOverview.tsx` add a bounded **Operate** pattern: week controls, a localized Monday–Sunday calendar range, per-sport completion counts, and dated activity rows. The web section uses the existing plain `GlowCard`, secondary summary badges, outline state badges, and outline or ghost actions. Mobile uses a vertical section with primary and secondary text, bordered row separators, and the existing `ui/Button` variants. Header and action groups wrap in source; this pattern introduces no palette or typography tokens.

Each row keeps its date, sport, activity name, plan name, and explicit state together. Completion counts leave skipped activities and unknown prescriptions out of the displayed scheduled total. Confirmed set counts retain an explicit unknown expected value when necessary. Unknown prescriptions have a visible explanation; a missing linked session has a recovery hint to undo the decision and choose a saved session on that date. Sequential plans retain a separate explanatory note about their existing next-session workflow.

Whole-activity rows on the phone show known single-session minutes/distance against the saved targets in wrapping secondary text. Daily Progress places this below the state; the Diary disclosure shows it above Details. Several shorter sessions remain Started using the best single-session evidence; ambiguous qualifying sessions ask the owner to choose a link. The existing typography, card geometry and action material are retained.

Workout rows offer Skip while unresolved, Undo for a saved decision, and linking to an eligible confirmed session on the row's date. Web uses a labelled select followed by a separate Link action. Mobile expands an inline list of record buttons, each with an accessible “Link [session name]” label, and closes the chooser after a successful decision. Decision controls are disabled during saving or fetching. Loading, load failure with Retry, an empty schedule, and decision failure remain visible in text; decision failure explains that the activity or account may have changed and asks the user to refresh. Mobile also states when a server connection is required. The workout destination retains the row's date: Diary on web and Exercise Review on mobile. Mobility opens its existing destination.

**Verification boundary:** This addition records component source, shared calendar-week and record-selection helpers, reused primitives, and English locale content on 2026-10-01. Browser checks were skipped at the user's request after saved permission rejected access to `localhost:8080`. No screenshot, simulator, or device capture supports this addition; authenticated appearance, narrow-width behavior, theme rendering, and enlarged-text behavior remain unverified.

**2026-10-07 phone verification update:** the subsequent single-session progress comparison was captured in German dark/light and enlarged-text native fixtures on Daily Progress's weekly activity subsection. A native accessibility assertion verifies the Started activity row; these captures do not show the top Activity card or establish server persistence or physical-device acceptance. See the [workout goal record](docs/implementation/workout-goal-completion-2026-10-07.md). The original web visual-review limitations above remain.

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
- **Do** reuse the shared 12-point rounded-rectangle phone action material and minimum 44-point targets across logging, forms, filters and pickers.
- **Do** derive Dashboard balances, meals, goals, and pending hydration states from actual app data.
- **Do** preserve the approved X on Track assets and “Keep getting better.” product identity; the Dashboard header shows the logo, name and tagline with Settings in the upper-right corner.
- **Do** preserve the selected day in Dashboard detail destinations and explain gaps between hydration totals and individual drink entries.
- **Do** keep Diary Recorded before Planned, sort earliest first within each section, and label untimed entries without inventing occurrence clocks.
- **Do** keep visible Diary summaries in spoken row names and announce the Home energy intake/allowance before opening daily Meals; goal editing keeps its separate heading action.
- **Do** move Diary clocks above their content at enlarged text sizes and preserve separate 44-by-44-point disclosure and meal-state controls.
- **Do** keep training and health detail subordinate to the retained Home, Diary, Add, Insights, and More navigation.
- **Do** keep daily Meals editing on existing food mutations and snapshot-preserving templates, with explicit review for unresolved serving variants.
- **Do** keep hydration logging and source history together, distinguish solid-food water from goal-counting drinks, and state unavailable source data explicitly.
- **Do** present actual training types and occurrence clocks, exclude daily energy aggregates from sessions, and keep future-day habit/meal shortcuts read-only.

### Don't:

- **Don't** present a color dot as the only status indicator.
- **Don't** invent account, connection, sync, or health status from decorative UI.
- **Don't** collapse unrelated settings into one unlabelled group.
- **Don't** turn the Dashboard reference's sample calculations, profile, bell, imagery, or counts into product facts.
- **Don't** shrink the Dashboard as a whole to fit a screenshot or apply its native composition to web Settings.
- **Don't** override phone action radius, fill or glow at the call site; native chrome, state glyphs, shutters, progress graphics and tappable content cards keep their own geometry.
- **Don't** treat a widget picker shortcut as a logged meal or commit an incomplete web clock draft.
