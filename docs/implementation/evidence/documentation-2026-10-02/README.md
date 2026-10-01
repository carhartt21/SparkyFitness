# Documentation verification — 2026-10-02

Application baseline: `899ac67bc`. This evidence contains public guide text only; no account credentials or personal health data.

## Checks

- Filtered frozen offline workspace install for `xot-docs...`: passed with pnpm 10.33.4.
- `pnpm run build` in `docs/`: passed. VitePress 1.6.4 rendered the site and checked internal routes. Its bundle-size advisory remains; this batch adds no client library.
- Whole-site Markdown internal-link/fragment check: **101 links, zero missing routes/anchors** (`link-check.json`). Two obsolete comparison→FAQ anchors were corrected.
- Four reviewed JSON examples parse. Notification settings/action examples additionally pass the actual `engagementSettingsPatchV2Schema` and `engagementActionSchema` from the merged source. The revision and UUIDs are illustrative, not executable account values.
- Advertised tool identifiers in reviewed pages match the current registry/OAuth registrations; zero unknown names. Endpoint/action/scope distinctions were also read manually in the source.
- Installed Google Chrome with playwright-core 1.63.0: **22 revised/new site pages, 44 viewport checks** at **1440×900** and **390×844**, returned HTTP 200, had headings, no document-level horizontal overflow and no page runtime errors. Detailed page/viewport results are in `results.json`.
- Six additional shell checks passed: the home page in light/dark at both widths and local search finding the new MCP training guide at both widths. Mobile sidebar navigation to Weekly Training Plans also succeeded (`shell-check.json`).
- Current docs header/hero PNG and favicon PNG match the canonical app exports byte-for-byte; no mark was redrawn. The HTTP-served logo also matches the source. Restart the preview after rebuilding: its cached asset size can otherwise truncate a replaced PNG.
- `git diff --check`: passed.

## Render review

The four new user guides were reviewed visually at desktop and narrow width. The MCP notification section was captured separately. Tables use VitePress's horizontally scrollable container on narrow screens; the page itself does not overflow. Captures show the guide layout, not a physical app/device acceptance test.

| Guide                     | Desktop                                     | Narrow                                     |
| ------------------------- | ------------------------------------------- | ------------------------------------------ |
| MCP training              | [Capture](mcp-training-1440.png)            | [Capture](mcp-training-390.png)            |
| Weekly planning           | [Capture](weekly-planning-1440.png)         | [Capture](weekly-planning-390.png)         |
| Notifications             | [Capture](notifications-1440.png)           | [Capture](notifications-390.png)           |
| MCP notification section  | [Capture](notification-mcp-1440.png)        | [Capture](notification-mcp-390.png)        |
| Widgets / Live Activities | [Capture](widgets-live-activities-1440.png) | [Capture](widgets-live-activities-390.png) |
| Home, light               | [Capture](home-light-1440.png)             | [Capture](home-light-390.png)             |
| Home, dark                | [Capture](home-dark-1440.png)              | [Capture](home-dark-390.png)              |

External requests were blocked during automated preview to keep it local and deterministic. Older upstream screenshots on the Preferences page were therefore not loaded/visually verified; their prior URLs remain and the guide labels them as earlier upstream UI. This does not claim the external links or screenshots are currently available.

## Not performed

Live OAuth authorization/writes, private authenticated app review, notification receipt, Watch/Live Activity device tests, native signing and app package test suites were not repeated for a docs-only change. No production or mobile publication ran. Optional MCP feature drafts are not represented as implemented.
