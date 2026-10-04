# Serving ingestion simulator evidence

Captured on 2026-10-04 from the real mobile components in
`fix/off-serving-ingestion-20261004`, with uncommitted source changes over
`e19713b84`. `results.json` records that base revision and the two passed cases.

| Case                                       | Available portions                              | Two portions / total weight                        |
| ------------------------------------------ | ----------------------------------------------- | -------------------------------------------------- |
| German, 390×844, normal text               | [Picker](390-de-dark-food-serving-options.png)  | [43 g](390-de-dark-food-serving-two-portions.png)  |
| German, 430×932, accessibility-extra-large | [Picker](430-de-large-food-serving-options.png) | [43 g](430-de-large-food-serving-two-portions.png) |

Both cases passed native `testFoodDetailsLayout`. Screenshots were visually
inspected for localized units, a single weight label and an accessible serving
option within the screen bounds. Enlarged text uses the existing stacked quantity
layout. Longer menus remain scrollable.

Reproduce from `XoTMobile/` with a compatible development simulator app:

```sh
node scripts/review-ios.mjs \
  --app /absolute/path/to/DevelopmentSimulator.app \
  --output /tmp/xot-serving-review-unique \
  --interactions --food-details-review \
  --case '^(390-de-dark|430-de-large)$'
```

The transport serves synthetic yogurt nutrition. The 21.5 g serving illustrates
the imported record shape; its calories are derived from that synthetic food,
not from Kinder Bueno. No owner account, production server or personal records
are involved. Server database persistence, actual OFF networking from the app,
offline replay, Android, tablet and physical-device checks are not established
by these captures. See the [implementation record](../../open-food-facts-serving-ingestion-2026-10-04.md)
for API fixture validation and remaining integration checks.
