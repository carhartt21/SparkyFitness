# Dashboard v11 follow-up evidence

All committed screenshots and interaction records use synthetic data in disposable iOS simulators. Private Todoist screenshots were inspected through the connector and are not copied here.

## Before and after

- [Before, 390 German](before-390-de-dark.png)
- [After, 390 German dark](390-de-dark.png)
- [After, 430 English dark](430-en-dark.png)
- [Light](390-de-light.png), [enlarged text](430-de-large.png), [empty](390-en-empty.png), [over-target AMOLED](390-en-over.png), [error](390-en-error.png)
- [Hydration ledger](390-de-dark-hydration-details.png), [exercise safe-area header](390-de-dark-exercise-details-safe-header.png), [summary Details](390-de-dark-dashboard-details-links.png)
- [German note with keyboard](390-de-dark-food-note-keyboard.png), [English note with keyboard](430-en-dark-food-note-keyboard.png)

The actual standalone reference is mobile/01-dashboard.png in the user-supplied archive. It was inspected directly; the repository already retains the supplied reference image in the prior Dashboard evidence folder.

## Verification and provenance

See checks.txt, render-results.json, native-results.json, contrast.json, i18n-audit.txt and the native summaries/events. The baseline revision in generated result files is d967633ef; results include implementation commit `8f578a22d`. Seven final captures were refreshed after the last adjustment to German label width. The native flow captures precede only that label-width and loading-fallback correction; both full flows passed. Image hashes are recorded in screenshots.sha256.json.

The native flow adds 250 ml water (1000 → 1250 ml), reads one 250 ml ledger entry, opens and returns from the selected-day exercise report, then searches food, sets a 200 g portion, types and saves a 442-character note above the keyboard, edits to 100 g and deletes the synthetic entry. Fixture state and refreshed summaries are asserted; this is not production backend persistence.

Full mobile suite: 480 suites / 7,224 tests passed. Focused suite: 112 tests passed. TypeScript, changed-file ESLint and normal production iOS export passed. The localization audit has three existing dynamic-key findings in unchanged HealthDataWriteback/SyncScreen; no new blocking string findings remain. Numerical normal-text contrast for the updated dark surfaces is at least 5.87:1.

## Review outcome and limits

The fresh Impeccable review returned fix for four density/native-interaction findings. The correction verdict returned **ship**, resolving all four listed fixes; it was scoped to that list, not a full-surface re-audit. Hydration and exercise values now appear in the initial viewport while 44-point targets remain.

Real backend water writes, TestFlight installation, current-build Health/Watch synchronization, physical progress-photo deletion, VoiceOver traversal, Settings/library visual checks, and complete app-wide German localization remain unverified. Enlarged-text screenshots demonstrate adaptive rendering, not a complete accessibility traversal. Search-layout and app-icon shortcut requests are separate pending batches; Todoist statuses were not changed.
