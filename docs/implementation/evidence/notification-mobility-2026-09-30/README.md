# Synthetic notification and mobility review evidence

All captures use isolated synthetic data. No production account screenshots, credentials or health records are included.

The `before` image is the first implementation review, not a historical production baseline. It shows the enlarged-header collision corrected in the confirmation pass.

| Surface                        | Normal/narrow                                   | Enlarged/desktop                                          |
| ------------------------------ | ----------------------------------------------- | --------------------------------------------------------- |
| Notification header correction | [First review](before-430-de-large-header.png)  | [Confirmation](430-de-large-notifications-top.png)        |
| Phone notifications — top      | [390×844](390-de-dark-notifications-top.png)    | [430×932 enlarged](430-de-large-notifications-top.png)    |
| Phone notifications — middle   | [390×844](390-de-dark-notifications-middle.png) | [430×932 enlarged](430-de-large-notifications-middle.png) |
| Phone notifications — lower    | [390×844](390-de-dark-notifications-lower.png)  | [430×932 enlarged](430-de-large-notifications-lower.png)  |
| Phone delivery diagnostics     | [390×844](390-de-dark-notifications-status.png) | [430×932 enlarged](430-de-large-notifications-status.png) |
| Widget guide — top             | [390×844](390-de-dark-widget-guide-top.png)     | [430×932 enlarged](430-de-large-widget-guide-top.png)     |
| Widget guide — bottom          | [390×844](390-de-dark-widget-guide-bottom.png)  | [430×932 enlarged](430-de-large-widget-guide-bottom.png)  |
| Web notification settings      | [390×844](web-settings-390-de.png)              | [1280×800](web-settings-1280-de.png)                      |
| Web mobility editor            | [390×844](web-mobility-390-de.png)              | [1280×800](web-mobility-1280-de.png)                      |

[Mobile render/interaction results](mobile-results.json) and [web overflow/runtime results](web-results.json). The mobile result revision is the base commit with the implementation in the working tree at capture time. The native fixture uses an in-memory transport; persistence/RLS are independently tested against disposable PostgreSQL. Physical receipt, OS widget placement and Watch hardware behavior are unverified.

[Validation summary](validation-results.json) records the tests and checks actually run. Package validation wrappers were replaced by their installed constituent commands because pnpm was unavailable.
