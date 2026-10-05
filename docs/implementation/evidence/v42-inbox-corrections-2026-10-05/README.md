# v42 inbox correction simulator evidence

Captured on 2026-10-05 using uncommitted changes on
`feat/v42-inbox-corrections-20261005`, over `0c14fc15b`. The unchanged base revision
in [results.json](results.json) identifies the review checkout's HEAD at capture,
not the finished feature commit. Every case passed native `testV42Corrections`
and the render smoke check. The development simulator host was reused; its
JavaScript bundle came from the feature worktree.

| Case | Diary | Other selected captures |
| --- | --- | --- |
| German dark, 390×844 | [Timeline](390-de-dark-diary.png) | [Energy](390-de-dark-energy.png), [search](390-de-dark-search.png), [refreshed portion](390-de-dark-portion.png) |
| German light, 390×844 | [Timeline](390-de-light-diary.png) | Native interactions passed the same checks. |
| German dark, 430×932, accessibility-extra-large | [Timeline](430-de-large-diary.png) | [Refreshed portion](430-de-large-portion.png) |

The selected images were visually inspected. Enlarged text retains the edit
button inside screen bounds and stacks calories beneath the food name/quantity.
Normal text retains the compact row. Food at 08:30 precedes water at 10:00.
The energy gauge separates its status from the center digits.

All names, food nutrition, timestamps and writes are synthetic. The 21.5 g
portion illustrates OFF metadata but uses the fixture's yogurt nutrition.
Literal synthetic food/container names are not German localization evidence.
No personal records or production credentials appear here.

Reproduce from `XoTMobile/` with a compatible development simulator app:

```sh
node scripts/review-ios.mjs \
  --app /absolute/path/to/DevelopmentSimulator.app \
  --output /tmp/xot-v42-inbox-review-unique \
  --interactions --v42-review \
  --case '^(390-de-dark|390-de-light|430-de-large)$'
```

This establishes simulator presentation and navigation with an isolated
transport. It does not establish live provider networking, real database
persistence, phone-offline replay, physical-device accessibility, Android,
tablet, Watch or a signed release build. See the
[implementation record](../../v42-inbox-corrections-2026-10-05.md) for the scope,
automated checks and device follow-up.
