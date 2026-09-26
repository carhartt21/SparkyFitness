---
name: X on Track Settings and Mobile Dashboard
description: Bounded Settings patterns for mobile and web, plus the native mobile Dashboard
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
  dashboard-energy-light: "#087257"
  dashboard-energy-dark: "#08dfb4"
  dashboard-energy-track-light: "#d6e5df"
  dashboard-energy-track-dark: "#154b47"
  dashboard-protein-light: "#95590f"
  dashboard-protein-dark: "#f4bd4c"
  dashboard-carbs-light: "#0e7746"
  dashboard-carbs-dark: "#65d99a"
  dashboard-fat-light: "#116f8d"
  dashboard-fat-dark: "#4ec6e8"
  dashboard-fiber-light: "#a3394b"
  dashboard-fiber-dark: "#ff7c83"
  supporting-text-mobile-dark: "#b4c8d2"
  raised-mobile-dark: "#1d343e"
  divider-mobile-dark: "#30474f"
  dashboard-hydration-light: "#146f8f"
  dashboard-hydration-dark: "#39c9f1"
  dashboard-exercise-light: "#09785d"
  dashboard-exercise-dark: "#21ddb0"
  dashboard-activity-energy-light: "#b54821"
  dashboard-activity-energy-dark: "#ff8052"
  dashboard-energy-amoled: "#1bd8ad"
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
    fontSize: "28px"
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

This record covers the implemented Settings surfaces (`SparkyFitnessMobile/src/screens/SettingsScreen.tsx`, `SparkyFitnessMobile/src/components/SettingsRow.tsx`, and `SparkyFitnessFrontend/src/pages/Settings/SettingsPage.tsx`) and the native mobile Dashboard (`SparkyFitnessMobile/src/screens/DashboardScreen.tsx` and its summary components). It also records the bounded food-search and Diary row patterns used by the mobile logging flow. It is not a claim about every screen in either app. The Settings experience is an **Operate** surface: people check their current context, find a category, and reach a specific setting. The mobile Settings screen leads with server and sync state. The web Settings screen leads with the active profile and five named sections. Dashboard guidance below is scoped to native mobile and does not extend the web rules.

The light themes use warm cream backgrounds, darker text, and a restrained green accent; the dark themes keep the same semantic roles with darker surfaces and brighter green. Status copy reports observed connection and sync history, including checking and unavailable states. Sections and controls use the actual English locale strings, with translations supplied by each app's i18n system.

The mobile Dashboard is also an **Operate** surface: a compact daily summary connects the selected date to energy, logging actions, nutrients, hydration, exercise, and actual meal entries. Its compact header places the approved logo Home action beside the grouped previous-day, date-picker, and next-day controls on the first line, with Today alongside at ordinary text sizes. The Dashboard header has no visible wordmark or tagline. The approved X on Track artwork and “Keep getting better.” identity remain product commitments. The supplied reference establishes the compact composition and navy-teal dark palette; calculations, navigation, labels, and content remain grounded in the application.

**Verification boundary:** The Settings record remains based on source code, theme tokens, and English locale content; its authenticated appearance and viewport behavior were not verified during that documentation pass. Dashboard additions describe the current native source and theme tokens. Prior bounded simulator evidence is recorded in `docs/implementation/evidence/dashboard-simulator-2026-09-26`; the bounded Dashboard alignment is recorded in `docs/implementation/dashboard-alignment-2026-09-26.md`. The subsequent header and mobile control-shape changes, simulator matrix, checks, and remaining verification limits are recorded in `docs/implementation/mobile-header-controls-2026-09-26.md` and `docs/implementation/evidence/mobile-header-controls-2026-09-26`. This documentation refresh adds no rendering or test verification and does not establish physical-device, every-state, or whole-app acceptance. Native measurements in the portable frontmatter use px notation for React Native logical layout units.

**Key Characteristics:**

- Grouped settings with headings that name the user's task.
- Current account or connection context near the top of the page.
- One destination per mobile row; category tabs and expandable settings on web.
- Visible text and accessibility labels for state, with color as a supporting cue.
- A mobile Dashboard with readable summaries, four direct logging actions, and room to scroll as content or text size grows.

## Colors

### Primary

- **Deep green:** The mobile light accent and web light primary identify interactive settings icons and selected or focused navigation. Dark mode uses a brighter green from each platform's theme.

### Neutral

- **Warm canvas:** The mobile and web light backgrounds separate the page from grouped settings and the web profile card.
- **Readable ink:** The primary foreground values carry headings and setting names; secondary foreground values carry status and descriptions.
- **Quiet boundaries:** Mobile row groups use subtle dividers. Web accordion items use borders and the active tab uses a pale green accent fill.

**The Semantic State Rule.** A connection dot may reinforce status, but text must state whether the connection is checking, connected, or unavailable. Sync history must also expose its loading, missing, and unavailable states in words.

### Mobile Dashboard

The Dashboard reuses the mobile canvas, surface, and text roles above. Its dark theme layers navy-teal canvas, card, and raised surfaces with cool light text, brighter mint controls, and visible muted borders. Dedicated energy green distinguishes the energy ring from its quiet track; cyan marks hydration, mint marks exercise, and orange marks activity-energy icons. Protein ochre, carbohydrate green, fat blue, and fiber rose retain the nutrient roles; labels and numeric amounts carry the meaning. Nutrient percentages use their semantic colors only in dark themes; light-theme percentages retain secondary text color. Light remains a warm cream choice. AMOLED retains its black canvas, existing green surfaces, and separate energy/track values from `SparkyFitnessMobile/global.css`; it is not an alias of the dark palette. These are native mobile roles, not new web palette rules. Selected water-container labels retain the primary text color on the muted accent fill.

## Typography

The Settings surfaces inherit each platform's default font stack; neither target sets a custom family. Hierarchy comes from size and weight. Mobile uses a bold page title, bold section headings, semibold row names, and smaller secondary lines. Web uses a semibold page title, section heading, compact tab labels, and muted descriptive copy.

**The Scan First Rule.** Keep section names and setting titles stronger than explanatory text. Preserve meaningful labels when they wrap; the mobile row title has no line limit by default.

### Mobile Dashboard

Dashboard uses the native font stack, a medium-weight date control (14 points), a bold energy value (28 points), bold hydration/exercise summary values (20 points), and readable supporting text. Main Dashboard section titles use semibold type (16 points); compact paired hydration and exercise headers use smaller semibold titles (14 points) and medium-weight Details text (12 points) inside full-size touch targets. Date controls, nutrient labels, values, and action labels retain native text scaling. At font scales above 1.3, the energy summary stacks and removes its decorative ring, nutrient label/value pairs stack, and quick actions wrap into two columns. The custom bottom tab bar is a bounded exception: visible labels fit on one line with a maximum multiplier of 1.2 and retain their full accessible names.

**The Dashboard Reading Rule.** Keep Dashboard text readable and let content scroll or stack; never scale the entire screen to reproduce the reference screenshot.

## Layout

Mobile is a vertical scroll of titled groups with a 20px horizontal gutter. Each group is a single rounded surface with 16px row padding, 40px icon tiles, and subtle separators. The server and health sync rows come first; app experience, tracking, family, and help follow. Connection-dependent rows appear only when connected. The screen adjusts for the safe area, active workout bar, and native iOS tab behavior.

Web uses a centered container capped at 72rem. A heading and active-profile summary sit above five sections: Profile & Account, Nutrition & Tracking, Wellness, Family & Sharing, and Data & Connections. Section tabs form a two-column grid at the narrowest widths, three columns from the `sm` breakpoint (640px), and a sticky 15rem sidebar from `lg` (1024px). The selected section has its own heading and description; its settings are expandable accordion items. URL `tab` and `section` values select and open destinations, including legacy aliases.

**The Destination Rule.** Keep a category label, its controls, and deep-link section IDs aligned when changing the Settings layout. Mobile rows continue to navigate to their existing screens.

### Mobile Dashboard

The native Dashboard scrolls vertically with a 16-point horizontal gutter, 16-point standard card padding, and 12-point gaps between major cards. The energy card, nutrient section, paired summaries, and meal overview use 12-point padding to keep the core summary compact. It accounts for native safe-area behavior and the active workout bar. The sequence is a compact logo Home target and date controls together on the first header line where custom tabs are used, daily energy with four quick actions (Food, Exercise, Water, Scan), nutrient rows, hydration and exercise summaries, then the logged-meal overview. Existing optional tracking cards remain below this core sequence.

Hydration and exercise share a row only at widths of at least 390 logical points and font scales no greater than 1.3; otherwise they stack. Quick-action tiles have a minimum height of 60 points; their natural content height may exceed that minimum. Date navigation, summary links, water actions, and exercise logging use at least 44-point action heights. Compact paired cards reserve equal metric areas with a 92-point minimum height and use logging actions at least 44 points high to align their action rows. In compact paired cards, icon, title, Details caption, and disclosure form one full-width header action at least 44 points high; the caption sits below the title inside that action. Expanded headers retain a separate Details target in a wrapping row. At font scales above 1.3, Today moves below while the logo and grouped date controls remain on the first line; date text may wrap without truncation or reduced font scaling. Native-tab configurations use their existing header.

## Elevation & Depth

The mobile row group and standalone row use the existing small shadow utility; their surface fill and separators do most of the grouping work. The web Settings page uses card fill, accent fill, and borders without a page-specific shadow on its profile card, tabs, or accordion items. Do not imply a stronger elevation hierarchy than these source surfaces establish.

Dashboard's energy, nutrient, hydration, compact exercise, and meal-overview cards use surface fills and subtle borders. The expanded exercise card retains its existing small shadow. The custom tab bar's central Add action retains its platform shadow/elevation. These local treatments do not redefine Settings or web elevation.

## Shapes

Mobile groups use 12px corners and icon tiles use 8px corners. Web section tabs and accordion items use 8px corners; the profile summary uses 12px. Thin separators and borders mark boundaries without turning each mobile row into a separate card.

Dashboard retains softly rounded cards and quick-action tiles, a circular progress ring, and slim rounded nutrient rails. The grouped date selector and Today use 8-point corners. Across the bounded mobile control refresh, horizontal filters, badges, dosage actions, rest controls, copy/date shortcuts, photo guide controls, shared `ui/Button` variants, and Dashboard water/exercise actions use the existing 8-point radius. Floating workout `LiquidGlassSurface` chrome uses 16-point container corners. Avoid capsule shapes for these controls; preserve circles for progress, radio/check states, icon-only controls, camera shutters, and the central Add action. The paired summary cards retain 16-point corners. The energy ring is 144 points across with a 10-point stroke; it is supplementary to the textual balance. These mobile control rules do not change the Settings group or web rules above.

## Components

### Mobile settings group and row

The group supplies a shared surface and separators. A row pairs an optional icon tile with a title, optional subtitle, and chevron or custom right accessory. Pressable rows expose a button role, spoken label, optional hint, and disabled state. Press feedback changes opacity; a disabled action is dimmed and cannot be pressed. A string subtitle joins the spoken label unless a more specific label is passed, as for server status.

### Mobile connection and sync status

Server shows connection text and the configured URL when present, or an add-server prompt. The colored dot uses the current semantic status color. Health Data Sync shows checking, last sync time, never synced, or unavailable history. These rows retain their Server Settings and Sync destinations.

### Web active profile card

A compact card names the active profile and whether it is a family member or the user's own account. It presents loading text until the active profile is available.

### Web section navigation and accordions

Tabs have text labels and decorative icons, with a visible active fill and keyboard focus ring. Their layout changes from grid to sidebar by viewport width. Accordion triggers contain an icon, title, description, and disclosure chevron; focus uses the theme ring and open state rotates the chevron. The underlying Radix primitives supply tab and disclosure semantics.

### Mobile Dashboard energy and quick actions

`DashboardHeader` starts with the approved existing logo (40 points with 8-point corners) in a 44-point Home target that resets the selected day to today. No wordmark or tagline is visible. Previous-day, localized date picker, and next-day controls share a bordered surface with 8-point corners beside the logo on the first line; directional chevrons flank the date and a down chevron marks the picker. Today uses its own bordered 8-point-corner control alongside the group, moving below only at font scales above 1.3. All five actions retain their callbacks and at least 44-by-44-point targets. The date picker exposes the selected ISO date as its accessibility value and allows text to wrap. The header remains available in the unavailable-server state when custom tabs are used. Controls keep spoken names and at least 44-point touch targets. The existing semantic `Icon` component supplies platform symbols, including SF Symbols on iOS; target, clock, and activity-energy indicators use native icons with their corresponding semantic colors. `CalorieRingCard` retains the “Daily energy” accessibility label without a visible section heading. Its side statistics align icons in a fixed 28-point column; a neutral divider separates them from the ring. It exposes consumed energy, base target, and activity burned or total expenditure according to the BMR preference. Its center states remaining, over target, or consumed when no target exists. Any allowance adjustment is shown separately from expenditure, using the server-provided balance. The ring caps its visual fill while the text preserves the actual amount; `ProgressRing` renders SVG circles with a 500ms cubic-out transition, removes its duration when reduced motion is enabled, and schedules animation only while its screen is focused.

The four labelled quick actions preserve their real destinations. Food opens dated food search, Exercise opens exercise logging, Water adds the configured amount or opens container setup, and Scan opens dated food scanning. They do not imply unimplemented profile, notification, or photo actions from the reference.

### Mobile Dashboard saved and unavailable states

A configured but unreachable server is labelled unavailable. Saved summaries are scoped to the selected server account and day, limited to seven cached days, and expire seven days after saving. A displayed saved summary carries an explicit saved-at timestamp. Without a saved summary, the screen explains that the selected day is unavailable and offers Retry. Available Apple Health steps and active energy appear separately as device data for that day; missing readings remain unknown, and local activity does not change the saved energy allowance.

### Mobile Dashboard nutrient rows

`MacroCard` in row mode places the nutrient name, slim progress rail, amount/goal, and explicit percentage on one line at ordinary text sizes. Rows have a 28-point minimum height, 13-point medium labels, 12-point values, and an 8-point rail. At ordinary text sizes, the label uses 26% of the row, the amount uses 72 points, the percentage uses 30 points, and the gaps are 5 points. The compact carbohydrate label is “Carbs” in English and “KH” in German; the full localized nutrient name remains in the accessible label. At font scales above 1.3, the same content stacks across multiple lines. The Dashboard follows nutrient visibility preferences, includes supplement nutrition, and offers the existing nutrition-detail destination. A missing goal omits the denominator, rail, and percentage rather than displaying a false zero target. Amounts and percentages use the app's localized number formatting; visual fill is capped while the numeric percentage can exceed the goal.

### Mobile Dashboard hydration, exercise, and meal overview

`HydrationGauge` keeps confirmed consumption, food-derived water, pending actions, and saved actions needing attention distinct in text. Its selected container exposes selected state and primary-colored text; logging and retry actions preserve their real behavior. Compact cards omit the selection chip when only one container exists, while retaining the add amount and all choices when multiple containers are available. Expanded cards retain the single-container chip. `ExerciseProgressCard` shows the available exercise values and goals with its logging action, switching between compact and expanded layouts with the surrounding Dashboard.

Both cards use `DashboardSectionHeader` with a section-specific accessible name. In compact cards, the icon, title, Details caption, and disclosure are a single pressable header at least 44 points high; title and caption occupy two lines within that target. Expanded cards retain a separate Details action with a minimum 44-by-44-point target. Exercise Details opens the existing exercise report with the Dashboard’s selected date.

`HydrationDetailsModal` is a read-only ledger for that selected day. Each recorded drink shows its amount in the preferred unit, container name, local time, and source. The dated ledger states that food water and older daily totals may have no matching individual entries; it does not claim to reconcile unknown aggregate amounts. Loading, error with retry, and empty states remain explicit. It opens as a native page sheet with a slide transition and swipe dismissal. Its close control stays in a fixed header outside the scroll content. The modal owns its background and bottom safe inset, uses 12-point top padding inside the iOS sheet, and uses the top safe inset on other platforms. A separate Water containers action opens configuration.

`DashboardDayOverview` groups actual logged food entries by meal type, lists their names and calculated meal energy, and opens the selected day's diary. Empty days say that no food was logged. Its logged-entry note makes incomplete coverage explicit. The reference does not authorize invented meals, imagery, counts, or an unsupported “on track” status.

### Mobile food search and Diary rows

Food search gives its input a full-width row below the header controls, followed by visible All, Recent, and Favorites tabs. Close, selection, overflow, and scanning retain their existing actions. Search starts across configured providers and keeps manual provider narrowing available. Labels and empty states follow the app language.

Diary food rows reserve a consistent thumbnail area (48 points) for an actual entry or food image, with an icon fallback when an image is missing or fails to load. Text keeps the same alignment in either state; available photos retain their lightbox action. Decorative food photography does not stand in for missing entry data.

## Do's and Don'ts

### Do:

- **Do** put current context before the detailed controls on these Settings surfaces.
- **Do** keep labels task-oriented and use the English locale entries as the copy source.
- **Do** keep connection and sync information truthful in loading and error states.
- **Do** preserve accessible names, focus indicators, navigation destinations, and URL section aliases.
- **Do** keep native Dashboard actions at usable touch sizes and let larger text stack and scroll.
- **Do** derive Dashboard balances, meals, goals, and pending hydration states from actual app data.
- **Do** preserve the approved X on Track assets and “Keep getting better.” product identity; show only the approved logo in the Dashboard Home target, beside the date controls on the first line.
- **Do** preserve the selected day in Dashboard detail destinations and explain gaps between hydration totals and individual drink entries.

### Don't:

- **Don't** present a color dot as the only status indicator.
- **Don't** invent account, connection, sync, or health status from decorative UI.
- **Don't** collapse unrelated settings into one unlabelled group.
- **Don't** turn the Dashboard reference's sample calculations, profile, bell, imagery, or counts into product facts.
- **Don't** shrink the Dashboard as a whole to fit a screenshot or apply its native composition to web Settings.
- **Don't** use capsule shapes for the refreshed mobile filters, badges, or actions; retain the meaningful circular controls and progress indicators.
