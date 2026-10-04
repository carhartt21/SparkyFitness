# Mobile wellness navigation correction

Wellness creation moves from Diary to **More → Wellness**. At normal text sizes,
the More entry now shares its row with **Mobility**, completing eight daily-tracking
tiles. Larger text switches the tile grids to full-width rows with wrapping labels.
Its dedicated tracking screen opens
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

## Original navigation correction verification (2026-10-02)

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

## More grid refinement (2026-10-04)

The new **Mobilität → Routinen** shortcut opens the existing `GuidedMobility`
route. It uses the shared `CreateTile`, semantic yoga symbol, cyan accent,
navigation guard and reviewed German copy. The Browse shortcut remains available.
Wellness retains its selected-day route and uses the shorter **Erfassen** caption.

Both tile grids keep two equal-width columns at font scales up to 1.3. Above that
threshold, the daily-tracking and creation tiles become full-width rows and opt
into `CreateTile.wrapText`; text remains scalable and complete. Other callers keep
the original compact behavior. This follows the Dashboard's existing large-text
layout threshold.

- Mobile `validate` passed on the final source.
- Three affected Jest suites passed: **29 tests**, including Wellness selected-day
  navigation and the screen-header contract.
- The final native wellness tour passed in **390×844 German dark/light** and
  **430×932 German accessibility-extra-large**. It checks equal tile widths,
  separation, horizontal bounds, minimum 44-point targets and selected-day wellness
  logging/Diary undo against the existing isolated in-memory fixture.
- The mechanical design detector reported no findings.

[Final More screenshots and runner results](evidence/more-tracking-grid-2026-10-04/README.md)
show the checked layouts. The first inspection exposed large-text truncation;
the final pass includes the responsive rows and shorter Wellness caption. Existing
long labels still use the established compact ellipsis at ordinary text sizes.
Mobility's persisted runner and server synchronization were unchanged and were
not exercised by this wellness tour. Physical-device and Android checks, mobile
publication and production deployment were not performed.
