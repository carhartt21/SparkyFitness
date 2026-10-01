# v37 corrective batch evidence

These captures contain synthetic data only. The mobile tour uses an isolated in-memory transport; web plan creation and reload use an isolated PostgreSQL-backed demo account. No production account or task-attachment images are included.

- `390-de-dark-*`: normal German tracking, objectives, weekly-plan list and editor.
- `430-de-large-*`: enlarged German tracking and weekly-plan editor.
- `web-*`: German web plan layout, persisted week and recoverable save failure.
- `mobile-results.json`: native navigation/render checks and their transport limitation.
- `web-plan-results.json`: creation, persistence, recovery and overflow outcomes.
- `validation-results.json`: tests and checks actually run, with explicit exclusions.

The form preserves scrolling instead of shrinking enlarged text. The native title can truncate while Save remains accessible. The current calendar's weekday labels at extreme text enlargement are not declared fixed. Simulator screenshots do not verify physical Watch synchronization, HealthKit or notification receipt. Before-state evidence for the reported failures was the owner's private v37 review and a protected server diagnostic, and is deliberately not published here.
