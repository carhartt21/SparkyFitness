# Mobile troubleshooting

## Connection and sign-in

Use your trusted HTTPS **API server URL**, not the Expo URL that loads a development build. Check the same server opens from the phone's network. Mac localhost is not reachable as phone localhost. If the app opens but sign-in fails, record the error and URL type without sharing credentials; do not reset/delete the app as the first troubleshooting step.

See [Mobile setup](/mobile-app/mobile-app) and [Proxy setup](/mobile-app/proxy-setup). A development tunnel and an installed TestFlight build have different launch requirements.

## Missing reminders or widgets

Check [Notifications and reminders](/features/settings/notifications) for permission, local/remote ownership, quiet hours, quota, resolved subjects and delivery status. Accepted pushes do not prove on-screen presentation. Intake follow-ups are independent of the optional reminder quota.

See [Widgets and Live Activities](/mobile-app/widgets-live-activities) for manual widget/Watch placement and iOS Live Activity permission. A planned session or completed diary log does not start a Live Activity.

## A save or setting looks stale

Verify the active account/server, connection and pending sync. Reopen the relevant screen to refresh. If settings changed on web or through MCP, reread before retrying a failed edit. For an uncertain logging request, inspect the saved diary before resending so it is not duplicated.

## Diagnostic report

Use the diagnostic-report action near the bottom of mobile Settings. It collects application logs, sanitized configuration and query/system state to help investigation. Redaction reduces exposure, but do not assume an export is guaranteed free of personal information: inspect it before sharing, especially URLs, free-text errors and provider/user-entered values.

Report the installed version/build, expected behavior, steps, relevant time/timezone and error message. Remove account details, credentials, tokens and private health records from screenshots or attachments. Keep private evidence out of public issues.

![Diagnostic-report action in an earlier interface](/diagnostic.png)

The image shows an earlier layout; current labels and placement can differ.
