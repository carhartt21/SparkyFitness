---
name: X on Track Settings and Mobile Dashboard
description: Bounded Settings patterns for mobile and web, plus the native mobile Dashboard
colors:
  brand-green-mobile-light: "#0b5e46"
  brand-green-mobile-dark: "#11a67e"
  background-mobile-light: "#f6f0e3"
  surface-mobile-light: "#f0eadd"
  text-mobile-light: "#171c22"
  supporting-text-mobile-light: "#40554c"
  divider-mobile-light: "hsl(213, 16%, 90%)"
  background-mobile-dark: "#171c22"
  surface-mobile-dark: "#242d32"
  text-mobile-dark: "hsl(220, 15%, 92%)"
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
  dashboard-energy-dark: "#1bd8ad"
  dashboard-energy-track-light: "#d6e5df"
  dashboard-energy-track-dark: "#24524a"
  dashboard-protein-light: "#95590f"
  dashboard-protein-dark: "#f4bd4c"
  dashboard-carbs-light: "#0e7746"
  dashboard-carbs-dark: "#65d99a"
  dashboard-fat-light: "#116f8d"
  dashboard-fat-dark: "#4ec6e8"
  dashboard-fiber-light: "#a3394b"
  dashboard-fiber-dark: "#ff7c83"
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
  dashboard-brand-title:
    fontSize: "20px"
    fontWeight: 700
  dashboard-energy-value:
    fontSize: "24px"
    fontWeight: 700
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
    padding: "{spacing.regular}"
  mobile-dashboard-quick-action:
    backgroundColor: "hsl(0, 0%, 100%)"
    textColor: "{colors.text-mobile-light}"
    rounded: "{rounded.dashboard-action}"
    padding: "8px 4px"
  mobile-dashboard-macro-row:
    textColor: "{colors.text-mobile-light}"
    padding: "4px 0"
---

# Design System: X on Track Settings and Mobile Dashboard

## Overview

**Creative North Star: "Status overview plus clear sections"**

This record covers the implemented Settings surfaces (`SparkyFitnessMobile/src/screens/SettingsScreen.tsx`, `SparkyFitnessMobile/src/components/SettingsRow.tsx`, and `SparkyFitnessFrontend/src/pages/Settings/SettingsPage.tsx`) and the native mobile Dashboard (`SparkyFitnessMobile/src/screens/DashboardScreen.tsx` and its summary components). It is not a claim about every screen in either app. The Settings experience is an **Operate** surface: people check their current context, find a category, and reach a specific setting. The mobile Settings screen leads with server and sync state. The web Settings screen leads with the active profile and five named sections. Dashboard guidance below is scoped to native mobile and does not extend the web rules.

The light themes use warm cream backgrounds, darker text, and a restrained green accent; the dark themes keep the same semantic roles with darker surfaces and brighter green. Status copy reports observed connection and sync history, including checking and unavailable states. Sections and controls use the actual English locale strings, with translations supplied by each app's i18n system.

The mobile Dashboard is also an **Operate** surface: a compact daily summary connects the selected date to energy, logging actions, nutrients, hydration, exercise, and actual meal entries. Its branded header uses the approved X on Track artwork and “Keep getting better.” identity. The supplied reference establishes the compact composition; calculations, navigation, labels, and content remain grounded in the application.

**Verification boundary:** The Settings record remains based on source code, theme tokens, and English locale content; its authenticated appearance and viewport behavior were not verified during that documentation pass. Dashboard additions describe the current native source and theme tokens. Bounded simulator captures and checks are recorded in `docs/implementation/evidence/dashboard-simulator-2026-09-26`; they do not establish physical-device, every-state, or whole-app acceptance. Native measurements in the portable frontmatter use px notation for React Native logical layout units.

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

The Dashboard reuses the mobile canvas, surface, and text roles above. Dedicated energy green distinguishes the energy ring from its quiet track. Protein ochre, carbohydrate green, fat blue, and fiber rose distinguish nutrient bars; labels and numeric amounts carry the meaning. Dark and AMOLED modes use the brighter energy and nutrient variants from `SparkyFitnessMobile/global.css`. These are Dashboard data accents, not new web palette rules. Selected water-container labels retain the primary text color on the muted accent fill.

## Typography

The Settings surfaces inherit each platform's default font stack; neither target sets a custom family. Hierarchy comes from size and weight. Mobile uses a bold page title, bold section headings, semibold row names, and smaller secondary lines. Web uses a semibold page title, section heading, compact tab labels, and muted descriptive copy.

**The Scan First Rule.** Keep section names and setting titles stronger than explanatory text. Preserve meaningful labels when they wrap; the mobile row title has no line limit by default.

### Mobile Dashboard

Dashboard uses the native font stack, a compact bold brand heading, bold energy value, existing mobile section titles, and readable supporting text. Date controls, nutrient labels, values, and action labels retain native text scaling. At font scales above 1.3, the energy summary stacks and removes its decorative ring, nutrient label/value pairs stack, and quick actions wrap into two columns. The custom bottom tab bar is a bounded exception: visible labels fit on one line with a maximum multiplier of 1.2 and retain their full accessible names.

**The Dashboard Reading Rule.** Keep Dashboard text readable and let content scroll or stack; never scale the entire screen to reproduce the reference screenshot.

## Layout

Mobile is a vertical scroll of titled groups with a 20px horizontal gutter. Each group is a single rounded surface with 16px row padding, 40px icon tiles, and subtle separators. The server and health sync rows come first; app experience, tracking, family, and help follow. Connection-dependent rows appear only when connected. The screen adjusts for the safe area, active workout bar, and native iOS tab behavior.

Web uses a centered container capped at 72rem. A heading and active-profile summary sit above five sections: Profile & Account, Nutrition & Tracking, Wellness, Family & Sharing, and Data & Connections. Section tabs form a two-column grid at the narrowest widths, three columns from the `sm` breakpoint (640px), and a sticky 15rem sidebar from `lg` (1024px). The selected section has its own heading and description; its settings are expandable accordion items. URL `tab` and `section` values select and open destinations, including legacy aliases.

**The Destination Rule.** Keep a category label, its controls, and deep-link section IDs aligned when changing the Settings layout. Mobile rows continue to navigate to their existing screens.

### Mobile Dashboard

The native Dashboard scrolls vertically with a 16-point horizontal gutter, 16-point card padding, and 12-point gaps between major cards. It accounts for native safe-area behavior and the active workout bar. The sequence is branded/date header where custom tabs are used, daily energy with four quick actions (Food, Exercise, Water, Scan), nutrient rows, hydration and exercise summaries, then the logged-meal overview. Existing optional tracking cards remain below this core sequence.

Hydration and exercise share a row only at widths of at least 390 logical points and font scales no greater than 1.3; otherwise they stack. Quick-action tiles have a minimum height of 72 points. Date navigation, summary links, water actions, and exercise logging use at least 44-point action heights. Native-tab configurations use their existing header rather than duplicating the custom brand header.

## Elevation & Depth

The mobile row group and standalone row use the existing small shadow utility; their surface fill and separators do most of the grouping work. The web Settings page uses card fill, accent fill, and borders without a page-specific shadow on its profile card, tabs, or accordion items. Do not imply a stronger elevation hierarchy than these source surfaces establish.

Dashboard's energy, nutrient, hydration, compact exercise, and meal-overview cards use surface fills and subtle borders. The expanded exercise card retains its existing small shadow. The custom tab bar's central Add action retains its platform shadow/elevation. These local treatments do not redefine Settings or web elevation.

## Shapes

Mobile groups use 12px corners and icon tiles use 8px corners. Web section tabs and accordion items use 8px corners; the profile summary uses 12px. Thin separators and borders mark boundaries without turning each mobile row into a separate card.

Dashboard uses softly rounded card and action corners from its extracted tokens, circular date pills and progress ring, and slim rounded nutrient rails. Its card and action values follow the current mobile theme rather than the older Settings snapshot above. The energy ring is 138 points across with a 10-point stroke; it is supplementary to the textual balance.

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

`DashboardHeader` uses existing approved light/dark artwork with the product name and approved tagline. `CalorieRingCard` exposes consumed energy, base target, and activity burned or total expenditure according to the BMR preference. Its center states remaining, over target, or consumed when no target exists. Any allowance adjustment is shown separately from expenditure, using the server-provided balance. The ring caps its visual fill while the text preserves the actual amount; `ProgressRing` uses a 500ms cubic-out transition and removes its duration when reduced motion is enabled.

The four labelled quick actions preserve their real destinations. Food opens dated food search, Exercise opens exercise logging, Water adds the configured amount or opens container setup, and Scan opens dated food scanning. They do not imply unimplemented profile, notification, or photo actions from the reference.

### Mobile Dashboard nutrient rows

`MacroCard` in row mode places the nutrient name and amount above a slim progress rail and explicit percentage. The Dashboard follows nutrient visibility preferences, includes supplement nutrition, and offers the existing nutrition-detail destination. A missing goal omits the denominator, rail, and percentage rather than displaying a false zero target. Amounts and percentages use the app's localized number formatting; visual fill is capped while the numeric percentage can exceed the goal.

### Mobile Dashboard hydration, exercise, and meal overview

`HydrationGauge` keeps confirmed consumption, food-derived water, pending actions, and saved actions needing attention distinct in text. Its selected container exposes selected state and primary-colored text; logging and retry actions preserve their real behavior. `ExerciseProgressCard` shows the available exercise values and goals with its logging action, switching between compact and expanded layouts with the surrounding Dashboard.

`DashboardDayOverview` groups actual logged food entries by meal type, lists their names and calculated meal energy, and opens the selected day's diary. Empty days say that no food was logged. Its logged-entry note makes incomplete coverage explicit. The reference does not authorize invented meals, imagery, counts, or an unsupported “on track” status.

## Do's and Don'ts

### Do:

- **Do** put current context before the detailed controls on these Settings surfaces.
- **Do** keep labels task-oriented and use the English locale entries as the copy source.
- **Do** keep connection and sync information truthful in loading and error states.
- **Do** preserve accessible names, focus indicators, navigation destinations, and URL section aliases.
- **Do** keep native Dashboard actions at usable touch sizes and let larger text stack and scroll.
- **Do** derive Dashboard balances, meals, goals, and pending hydration states from actual app data.
- **Do** retain the approved X on Track assets and “Keep getting better.” identity on the Dashboard.

### Don't:

- **Don't** present a color dot as the only status indicator.
- **Don't** invent account, connection, sync, or health status from decorative UI.
- **Don't** collapse unrelated settings into one unlabelled group.
- **Don't** turn the Dashboard reference's sample calculations, profile, bell, imagery, or counts into product facts.
- **Don't** shrink the Dashboard as a whole to fit a screenshot or apply its native composition to web Settings.
