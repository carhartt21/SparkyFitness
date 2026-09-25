---
name: X on Track Settings
description: Settings surface patterns for the mobile and web applications
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
rounded:
  web-card: "8px"
  mobile-icon: "8px"
  mobile-group: "12px"
  web-profile-card: "12px"
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
---

# Design System: X on Track Settings

## Overview

**Creative North Star: "Status overview plus clear sections"**

This record describes the implemented Settings surfaces only: `SparkyFitnessMobile/src/screens/SettingsScreen.tsx`, `SparkyFitnessMobile/src/components/SettingsRow.tsx`, and `SparkyFitnessFrontend/src/pages/Settings/SettingsPage.tsx`. It is not a claim about every screen in either app. The Settings experience is an **Operate** surface: people check their current context, find a category, and reach a specific setting. The mobile screen leads with server and sync state. The web screen leads with the active profile and five named sections.

The light themes use warm cream backgrounds, darker text, and a restrained green accent; the dark themes keep the same semantic roles with darker surfaces and brighter green. Status copy reports observed connection and sync history, including checking and unavailable states. Sections and controls use the actual English locale strings, with translations supplied by each app's i18n system.

**Key Characteristics:**

- Grouped settings with headings that name the user's task.
- Current account or connection context near the top of the page.
- One destination per mobile row; category tabs and expandable settings on web.
- Visible text and accessibility labels for state, with color as a supporting cue.

## Colors

### Primary

- **Deep green:** The mobile light accent and web light primary identify interactive settings icons and selected or focused navigation. Dark mode uses a brighter green from each platform's theme.

### Neutral

- **Warm canvas:** The mobile and web light backgrounds separate the page from grouped settings and the web profile card.
- **Readable ink:** The primary foreground values carry headings and setting names; secondary foreground values carry status and descriptions.
- **Quiet boundaries:** Mobile row groups use subtle dividers. Web accordion items use borders and the active tab uses a pale green accent fill.

**The Semantic State Rule.** A connection dot may reinforce status, but text must state whether the connection is checking, connected, or unavailable. Sync history must also expose its loading, missing, and unavailable states in words.

## Typography

The Settings surfaces inherit each platform's default font stack; neither target sets a custom family. Hierarchy comes from size and weight. Mobile uses a bold page title, bold section headings, semibold row names, and smaller secondary lines. Web uses a semibold page title, section heading, compact tab labels, and muted descriptive copy.

**The Scan First Rule.** Keep section names and setting titles stronger than explanatory text. Preserve meaningful labels when they wrap; the mobile row title has no line limit by default.

## Layout

Mobile is a vertical scroll of titled groups with a 20px horizontal gutter. Each group is a single rounded surface with 16px row padding, 40px icon tiles, and subtle separators. The server and health sync rows come first; app experience, tracking, family, and help follow. Connection-dependent rows appear only when connected. The screen adjusts for the safe area, active workout bar, and native iOS tab behavior.

Web uses a centered container capped at 72rem. A heading and active-profile summary sit above five sections: Profile & Account, Nutrition & Tracking, Wellness, Family & Sharing, and Data & Connections. Section tabs form a two-column grid at the narrowest widths, three columns from the `sm` breakpoint (640px), and a sticky 15rem sidebar from `lg` (1024px). The selected section has its own heading and description; its settings are expandable accordion items. URL `tab` and `section` values select and open destinations, including legacy aliases.

**The Destination Rule.** Keep a category label, its controls, and deep-link section IDs aligned when changing the Settings layout. Mobile rows continue to navigate to their existing screens.

## Elevation & Depth

The mobile row group and standalone row use the existing small shadow utility; their surface fill and separators do most of the grouping work. The web Settings page uses card fill, accent fill, and borders without a page-specific shadow on its profile card, tabs, or accordion items. Do not imply a stronger elevation hierarchy than these source surfaces establish.

## Shapes

Mobile groups use 12px corners and icon tiles use 8px corners. Web section tabs and accordion items use 8px corners; the profile summary uses 12px. Thin separators and borders mark boundaries without turning each mobile row into a separate card.

## Components

### Mobile settings group and row

The group supplies a shared surface and separators. A row pairs an optional icon tile with a title, optional subtitle, and chevron or custom right accessory. Pressable rows expose a button role, spoken label, optional hint, and disabled state. Press feedback changes opacity; a disabled action is dimmed and cannot be pressed. A string subtitle joins the spoken label unless a more specific label is passed, as for server status.

### Mobile connection and sync status

Server shows connection text and the configured URL when present, or an add-server prompt. The colored dot uses the current semantic status color. Health Data Sync shows checking, last sync time, never synced, or unavailable history. These rows retain their Server Settings and Sync destinations.

### Web active profile card

A compact card names the active profile and whether it is a family member or the user's own account. It presents loading text until the active profile is available.

### Web section navigation and accordions

Tabs have text labels and decorative icons, with a visible active fill and keyboard focus ring. Their layout changes from grid to sidebar by viewport width. Accordion triggers contain an icon, title, description, and disclosure chevron; focus uses the theme ring and open state rotates the chevron. The underlying Radix primitives supply tab and disclosure semantics.

## Do's and Don'ts

### Do:

- **Do** put current context before the detailed controls on these Settings surfaces.
- **Do** keep labels task-oriented and use the English locale entries as the copy source.
- **Do** keep connection and sync information truthful in loading and error states.
- **Do** preserve accessible names, focus indicators, navigation destinations, and URL section aliases.

### Don't:

- **Don't** present a color dot as the only status indicator.
- **Don't** invent account, connection, sync, or health status from decorative UI.
- **Don't** collapse unrelated settings into one unlabelled group.
