# v40 German localization evidence

All captures use isolated synthetic data. English food names and the fixture kitchen name are literal content, not app translations.

- [Phone dark](390-de-dark.png), [light](390-de-light.png), and [enlarged text](430-de-large.png).
- [Nutrition settings](food-settings-de-dark.png), [food details](food-details-de-dark.png), and [numeric keyboard actions](food-keyboard-de-dark.png).
- [Watch daily goals](watch-goals-de.png).
- [Phone machine results](phone-results.json) and [Watch results](watch-results.json).

The phone matrix exercised native navigation, category destinations, food selection, editing, numeric and text keyboards, save and refreshed summaries with an in-memory transport. Captures were visually inspected. At accessibility text sizes the energy summary intentionally stacks and replaces the gauge with readable numeric content. Scrollable content under the bottom bar is not a horizontal overflow failure.

The Watch capture compiles actual Swift views/resources inside a synthetic Watch host. Its 16 assertions cover localization, progress state, confirmations and stale/unknown context. It does not verify signed complication hosting, notifications, paired-device connectivity, server persistence, or physical VoiceOver delivery.
