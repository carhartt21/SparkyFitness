# More Browse rows — 2026-10-08

The phone’s More → Browse section now uses `SettingsRowGroup` and `SettingsRow` for every destination. The owner selected an icon on every row. Icons reuse the existing semantic symbol map with the active theme’s primary tint; titles, subtitles, counts, chevrons, separators, padding and press feedback share one presentation.

Health & Routines no longer nests a standalone bordered card inside the grouped list. Recommendations and Training & Routines now have the same chevron and title typography as neighboring rows. Existing localized labels, counts, selected-day route arguments and destinations are retained. Long labels and subtitles wrap instead of colliding with the trailing count or chevron. Grouped rows retain button semantics and complete spoken labels, including counts.

## Verification

Mobile validation and the two existing relevant suites passed: 22 tests across LibraryScreen and SettingsRow. Native iOS review passed in German at 390 points in dark/light and 430 points with accessibility-extra-large text. The review scrolled through the list, checked visible row bounds and minimum 44-point touch targets, and opened Training & Routines. Batched inspection confirmed matching leading columns, separators and chevrons; enlarged text intentionally wraps and scrolls.

[Dark](evidence/more-browse-2026-10-08/390-de-dark.png), [light](evidence/more-browse-2026-10-08/390-de-light.png), [enlarged text](evidence/more-browse-2026-10-08/430-de-large.png), and [sanitized results](evidence/more-browse-2026-10-08/results.json) are retained. A private launch-smoke assertion initially expected Home calorie values below the enlarged-text viewport; it was corrected to inspect visible fixture content and only that case was rerun. No application change was needed.

The fixture contains synthetic data. These checks do not establish physical-device, Android, VoiceOver or server-persistence acceptance. Release and rollout status belongs in the separate release record.
