# v44 corrective refinement evidence

This folder records the unreleased `feat/v44-diary-refinement-20261006` implementation. All app data in captures is synthetic. No owner health records, account credentials or production responses are included.

- `approved-direction.png`: the left Home and middle Diary are the selected composition. The right Training-tab alternative was not selected. `mockup-provenance.md` records the reference and exact prompt.
- `home-*.png`: native Home at German dark/light 390-point and enlarged-text 430-point widths.
- `v44-diary-recorded-*.png`: recorded-first timeline; `v44-diary-planned-*.png` and `v44-diary-resolved-*.png` are intentionally scrolled native captures around planned/state interactions, not full-page captures.
- `v44-food-moved-*.png`: edit-mode result after the real gesture. The enlarged-text case includes edge scrolling to an initially offscreen target.
- `v44-training-hub-*.png`: the actual subordinate training destination, including its empty state.
- `web-clock-*.png`: actual shared clock controls on an isolated review page, desktop dark and narrow light; no authenticated settings claim.
- `widget-after-de-*.png`: actual SwiftUI widget content previews with a Favorites shortcut; no installed WidgetKit or physical-device claim.
- `native-results.json`, `validation-results.json`: final outcomes and their scope. Temporary log paths are provenance, not required repository files. Test-run counts overlap.
- `finish-review.md` and `finish-verdict.md`: the initial scoped findings and follow-up scoring. A verdict scores its listed fixes rather than every app surface.

Native reproduction: from `XoTMobile`, use `node scripts/review-ios.mjs --app <compatible-development-simulator.app> --output <isolated-output-dir> --interactions --v44-review`. `--case '^430-de-large$'` selects the enlarged-text case. The runner blocks production network origins and checks the existing synthetic bulk-move request retains its quantity, time and snapshot. Widget content reproduction uses `node scripts/review-widget-content.mjs --output <isolated-output-dir>`.

See [the implementation record](../../v44-diary-refinement-2026-10-06.md) for verified causes, remaining hypotheses and release/device checks.
