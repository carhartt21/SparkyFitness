# Deferred-task verification — 7 October 2026

These captures use isolated synthetic fixtures. See the [implementation record](../../deferred-tasks-completion-2026-10-07.md) for exact checks and remaining acceptance gates.

- `results.json` and four `watch-*.png` images: actual SwiftUI content compiled for a 42mm Watch simulator; 19 harness assertions. Its SHA is the combined Watch sources and synthetic harness, not a single-file hash. No swipe or phone pairing acceptance.
- `launch-results.json` and five `launch-icon-*.png` images: all four actual SpringBoard quick actions reached the expected phone screen, including food entry after cold launch. The activity destination capture predates the Notes correction.
- `notes-results.json` and `activity-notes-de-corrected.png`: later native activity-form navigation and visible-copy OCR passed with “Notizen”, excluding “Neintes”. No activity saved.
- `source-manifest.json`: relevant working-tree source hashes before commit. Native result `revision` fields identify the base commit; they do not claim that working-tree changes had already been committed or released.

Simulator idle/accessibility and unpaired-Watch warnings occurred. Physical devices, real-account permissions, offline replay and release publication remain unverified. Backend persistence was tested separately in the guarded, disposable PostgreSQL database, never with production mutations.
