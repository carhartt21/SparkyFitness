# v38 correction evidence

All captures use isolated synthetic data. No Todoist attachments, personal entries,
credentials, production logs or private catalogue responses are included.

Before captures are from `29ec1495b`; after captures are from the feature branch's
working tree before its commits. The native runner records the base revision, not a
clean released commit. [Capture provenance](capture-provenance.json) lists original
capture labels and SHA-256 hashes of the unmodified PNGs.

## Before and after

| Surface                      | Before                                        | After                                                                                                                                                                                                                                                   |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard hierarchy          | [390 dark](before-390-dashboard.png)          | [390 dark](390-de-dark-dashboard.png), [light](390-de-light-dashboard.png), [enlarged](430-de-large-dashboard.png)                                                                                                                                      |
| Weekly-plan dates            | [390 dark editor](before-390-weekly-plan.png) | [date controls](390-de-dark-plan-date-controls.png), [calendar](390-de-dark-plan-calendar.png), [enlarged calendar](430-de-large-plan-calendar.png)                                                                                                     |
| Nutrient precision/unknowns  | No focused baseline capture available         | [390 dark](390-de-dark-nutrients.png), [light](390-de-light-nutrients.png), [enlarged](430-de-large-nutrients.png)                                                                                                                                      |
| Keyboard draft/actions       | No focused baseline capture available         | [keyboard open](390-de-dark-note-keyboard.png), [dismissed draft](390-de-dark-note-dismissed.png), [enlarged keyboard](430-de-large-note-keyboard.png)                                                                                                  |
| Meal settings/icons          | No focused baseline capture available         | [settings](390-de-dark-meal-settings.png), [picker](390-de-dark-meal-icon-picker.png), [reopened choice](390-de-dark-meal-icon-reopened.png), [enlarged settings](430-de-large-meal-settings.png), [enlarged picker](430-de-large-meal-icon-picker.png) |
| Pending-task navigation      | No focused baseline capture available         | [actual destination](390-de-dark-next-task-destination.png)                                                                                                                                                                                             |
| Web icon persistence         | No focused baseline capture available         | [desktop picker](web-meal-icon-picker-1280.png), [narrow picker](web-meal-icon-picker-390.png)                                                                                                                                                          |
| Existing web plan correction | See the prior v37 evidence record             | [saved week](web-saved-week.png), [error retains draft](web-save-error-retains-input.png)                                                                                                                                                               |

## Results and limits

- [Native results](mobile-results.json): render smoke and interactions passed for
  German dark/light at 390×844 and enlarged German dark at 430×932. Corresponding
  root PNGs are initial render smoke captures; the named interaction captures above
  show the reviewed flows. The native transport is synthetic and in memory.
- [Web icon results](web-meal-icon-results.json): creation, reload, edit, omission
  preservation, invalid-value rejection and reset passed against the isolated
  PostgreSQL-backed stack. The runner removed its synthetic record.
- [Web plan results](web-plan-results.json): creation/reload, draft retention after
  an injected API error, target reconciliation and no horizontal overflow passed.
- [Validation summary](validation-results.json): actual checks, final-tree coverage
  boundaries and explicitly unverified release checks.

Large-text layouts scroll and may ellipsize long row names; accessible labels keep
the full text. Literal synthetic food/habit names are not translated. Screenshot
inspection is separate from OCR smoke checks and automated interaction assertions.

The native checks exercise navigation, draft retention and UI/cache refresh; they
do not establish database persistence, physical keyboard behavior or signed-device
installation. Cross-account permissions, live provider nutrients, Watch, HealthKit,
offline replay, production deployment and TestFlight publication remain unverified
in this batch. Backend test suites were skipped as requested.

Repeat commands and scenario boundaries are in the
[mobile review README](../../../../XoTMobile/review/README.md#v38-corrections).
