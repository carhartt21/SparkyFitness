# Mobile wellness navigation correction

Wellness creation moves from Diary to **More → Wellness**. The full-width More
entry stays readable at enlarged text sizes. Its dedicated tracking screen opens
on the shared selected day and retains date navigation, presets, custom names,
undo, retry and the collapsed 30-day history.

Diary keeps the selected day's recorded wellness entries and undo. It no longer
shows presets, the custom-name input or history; an empty wellness card disappears.
Loading and retrieval failures remain explicit. The existing habit/log API,
permissions and cache invalidation remain unchanged. Wellness still contributes
neither Daily Progress tasks nor exercise energy or HealthKit workouts. Web retains
its existing Diary logging surface.

The shared `WellnessCard` has explicit `log` and `diary` modes. Diary requests
only its selected day, while the logging screen requests the existing 30-day
history. The new typed root-stack `Wellness` route uses `TrackingScreen` and the
normal screen error boundary. English source and reviewed German copy cover the
new connection explanation; existing keys cover navigation and logging.

## Verification

- Mobile `validate` passed on the final source, including types, lint, localization,
  unused-code checks, native locale/asset checks and formatting.
- Documentation build passed with the existing bundle-size warning.
- Full mobile Jest: **542 suites, 7,659 tests passed**. The final tile-width/copy
  correction was followed by three affected suites, **28 tests passed**.
- Initial focused checks: five suites, **40 tests passed**, including selected-day
  logging, custom names, duplicate taps, failure/retry, history, Diary-only rendering,
  cross-surface cache refresh, date navigation and the header contract.
- Native simulator tour passed at **390×844 German dark/light** and **430×932 German
  dark with largest Dynamic Type**. It logs from More, expands history, returns to
  Diary, verifies absence of creation controls, and undoes the dated entry.
- Visual inspection found a truncated new tile title at enlarged text. Making
  Wellness a full-width row fixed it; the dark and enlarged-text confirmation
  tours passed. Existing surrounding More tiles and Diary summary rings still
  truncate/crowd at the largest text size and need a separate accessibility pass.

[Synthetic screenshots and native results](evidence/wellness-more-navigation-2026-10-02/README.md)
record the checked states. Simulator mutations use an isolated in-memory fixture,
not a real server. Physical-device and Android rendering were not performed for
this navigation change. No native configuration, server code or persisted record
format changed; no production deployment or mobile publication was performed.
