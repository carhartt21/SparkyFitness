# Daily Progress card navigation — 2026-10-04

These captures use the isolated synthetic v38 review fixture and the production
Dashboard/Daily Progress components. They contain no private account records.
The runner loads the working source on top of `c2afba676`; the tested source
hashes and three native results are recorded in [results.json](results.json).

- [German dashboard card](390-de-dark-card.png)
- [Breakdown after tapping the X](390-de-dark-open-visual.png)
- [Enlarged-text breakdown after tapping the count](430-de-large-open-count.png)

The native test first opens a category through its own button, then opens Daily
Progress separately through its heading, graphic, count and padding. Targets must
be inside the visible viewport before tapping. The destination retains the
fixture's selected calendar day. It also preserves the ordinary-text first-screen
action bounds and the enlarged-text stacked layout checks.

Reproduce from `XoTMobile/` with a compatible development simulator app:

```sh
node scripts/review-ios.mjs \
  --app /absolute/path/to/DevelopmentSimulator.app \
  --output /tmp/xot-progress-card-navigation-new-run \
  --interactions --summary-cards-review \
  --case '^(390-de-dark|390-de-light|430-de-large)$'
```

The native review host compiled in Xcode. Its synthetic transport tests rendering
and navigation rather than production authentication, persistence or health sync.
The first enlarged-text run failed because full-page test swipes overshot the
target; the final test uses measured scrolling and still requires visible bounds
and a successful actual tap. The X's non-accessible layout container is tested
by coordinates; text and button controls retain their native hittability checks.
No physical-device, Android, spoken VoiceOver, TestFlight
or deployment check was performed.
