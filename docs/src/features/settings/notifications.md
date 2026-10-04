# Notifications and reminders

X on Track separates **optional logging reminders**, **scheduled medication/supplement intake**, and **active timer alerts**. Enabling a reminder makes it eligible; it does not guarantee an alert at every configured time.

On mobile, open **Settings → App settings → Notifications**. The German screen is **Benachrichtigungen**. Account reminder settings and delivery status are also available in web Settings. Device notification permission and local intake/timer settings are managed on the phone.

## Enable delivery on your phone

1. Enable notifications in the app and grant the operating-system permission. If permission was denied earlier, allow X on Track in system notification settings.
2. Choose your reminder kinds, times, quiet hours and optional daily limit.
3. For reminders while the app is closed, enable remote delivery **on the phone first**, while connected to your server. This registers the device and hands the optional reminders to the server after cancelling their local requests.
4. Reopen the settings screen and check delivery status. Web or MCP can update the account schedule after the initial phone setup.

Local mode schedules optional reminders from data available on the phone and refreshes them when the app runs. Remote mode uses synced account data and the server's push service. The handoff avoids scheduling the same optional reminder in both places. Scheduled intake, rest and fasting timer alerts remain local in either mode.

Remote mode needs a registered, push-capable installed build, network connectivity and a running server planner. A simulator or development build without push support does not establish remote delivery. Offline saves can suppress local reminders immediately; the server needs those saves to sync before it can suppress its pending alert.

## Which reminders share the daily limit?

| Reminder          | When it is eligible                                                                                                                               | Where to configure it                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Hydration         | Within the configured start/end window and interval, while the known hydration goal remains unmet. A real logged drink anchors the next interval. | Notifications; interval 1–12 hours.                                                                      |
| Meal capture      | The selected meal window is unresolved. Food, a meal photo or an explicit completed/skipped meal state resolves it.                               | Notifications: window start/end and preferred time.                                                      |
| Meal photo review | Captured photos still need nutrition review. A photo-only meal is captured, not confirmed zero calories.                                          | Notifications: review time.                                                                              |
| Movement break    | Today's movement-break action has not started. An unrelated exercise log does not necessarily resolve this subject.                               | Notifications: movement-break time.                                                                      |
| Mobility          | A dated mobility plan remains planned.                                                                                                            | Mobility routines/schedules, plus the mobility reminder switch.                                          |
| Daily check-in    | The check-in has not been completed or skipped. A draft is unresolved.                                                                            | Daily tracking preferences.                                                                              |
| Habit             | A configured habit is due and has no resolving record for the day.                                                                                | Habit definition and daily tracking reminder preferences.                                                |
| Weigh-in          | A configured weight reminder is due and no weight has been recorded for that day.                                                                 | Measurement reminders. Remote delivery currently supports weight, not every custom measurement reminder. |

These eight kinds share the optional limit, quiet hours and at least **20 minutes** between slots. The default limit is **3 per day**; you can choose 1–50 or **No limit**. No limit removes the quota, not quiet hours, intervals or spacing. Timed subjects receive slots before hydration fills remaining capacity. Previously attempted/snoozed deliveries can consume the day's allowance.

Times use the account timezone and 24-hour format. Reminder windows must have start before end. A health-context period configured to pause discretionary reminders suppresses optional alerts. Missing required data is reported as unavailable instead of being interpreted as a deficit. Old/expired slots are not replayed as a burst of catch-up notifications.

A weekly training-plan time is not currently a separate push-reminder kind. Saving a plan alone does not schedule a workout notification.

## Medication and supplements

The item's medication/supplement classification determines its reminder wording. **Scheduled intake reminders** use the saved schedule and dose. An as-needed item without a scheduled time does not generate an automatic reminder.

Optional **Intake follow-ups** send at **+10, +20 and +30 minutes**, for today's unresolved scheduled intake only. They are off by default for a new preference; an existing saved choice is kept. Recording **taken** or **skipped** cancels remaining follow-ups. Dismissing the notification does not record intake. These alerts are outside the optional logging-reminder quota.

Supplements due at the **exact same time** on the same intake day share **one notification** listing the unresolved items. Tap it or choose **Open supplements** (**Supplemente öffnen**) to open that day's supplement list and record each item separately. Medications remain individual, and different times are not rounded into a group. A single remaining supplement keeps its individual Taken/Skip actions.

If follow-ups are enabled, items firing together share one alert at each follow-up time too. Recording one item shrinks the future group, including a saved offline decision. Recording every item cancels the remaining alerts. **Hide names** replaces the names and doses with a neutral item count. Opening a group does not mark anything taken or skipped.

Several similar intake alerts may therefore be intentional follow-ups or separate saved schedules at different times. Current scheduling uses a stable account/schedule/day/time identifier to replace an existing pending occurrence instead of appending duplicates. It also defers replacement when cancellation cannot be confirmed. It cannot retract an alert that the operating system already presented.

Enable **Hide names** if you do not want the item name and dose in notification content. The title still distinguishes a medication from a supplement. Notification actions record an intake decision; they do not change a prescribed dose or recommend taking more.

## Read the delivery status correctly

| Status or reason                              | Meaning / next check                                                                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Scheduled                                     | The server reserved a slot; it has not established device delivery.                                                                    |
| Accepted                                      | Expo accepted the push request. This does not prove it appeared on the phone.                                                          |
| Receipt confirmed                             | The push provider confirmed handoff; the app still cannot know whether you saw it.                                                     |
| Unknown                                       | A send's outcome is uncertain. It is not automatically retried, to avoid duplicate alerts.                                             |
| No device / unavailable                       | Open the phone app, check permission and enable remote delivery there. Some older devices/builds do not advertise every reminder kind. |
| Resolved / paused / disabled                  | Today's subject is already resolved, a context pause applies, or the reminder is off.                                                  |
| Daily limit / quiet hours / spacing / expired | The policy did not reserve this slot. Check the quota, windows and available time rather than increasing repeats.                      |

Refresh status after changing settings or syncing a resolving entry. Focus mode, scheduled summaries and system presentation settings can delay or hide an otherwise accepted push. The server normally checks planning and due delivery every five minutes; a configured time is not a second-exact alarm.

For unexpected duplicates, note the installed build, reminder title, scheduled times, whether follow-ups are enabled and whether multiple schedules/installations exist. Share sanitized diagnostics, not push tokens or credentials. If an update changed reminder wording, open the app once to reconcile pending local requests; already delivered notifications retain their old copy.

## MCP notification updates

Use the OAuth endpoint `/mcp/chatgpt`. These tools are not registered at the API-key `/mcp` endpoint:

| Tool                               | Permission  | Purpose                                                                  |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `xot_get_notification_settings`    | `mcp:read`  | Read the current account settings and revision.                          |
| `xot_update_notification_settings` | `mcp:write` | Patch supported account schedule fields using `expected_revision`.       |
| `xot_act_on_reminder`              | `mcp:write` | Snooze or skip an existing occurrence; not a new reminder or intake log. |

Example prompt:

> Lies zuerst meine Benachrichtigungseinstellungen. Zeige mir eine Änderung für Ruhezeit 22:00–08:00, Wasserhinweise zwischen 09:00 und 20:00 im Abstand von drei Stunden und maximal fünf optionale Hinweise pro Tag. Ändere keine Einnahmepläne und aktiviere keine neue Zustellung ohne meine Zustimmung. Speichere nach meiner Bestätigung und lies die Einstellungen erneut.

The update sends only changed fields and the freshly read revision. On conflict, reread and reconcile; do not force an old full settings snapshot over newer web/phone changes. MCP cannot grant iOS notification permission, register the phone, configure local intake follow-ups or install widgets. Initial remote activation still belongs on the phone.

Snooze/Skip uses an existing `occurrence_id` and a UUID `operation_id` retained across retries. Snooze accepts 5–120 minutes and still follows eligibility/quiet-hours/quota rules; it is not a guaranteed alarm. The current MCP surface has no tool to list delivery occurrences: obtain the ID from the existing reminder payload or use the app's reminder action. Do not invent one from a displayed title.

For technical payloads see [Notification and engagement tools](/developer/mcp/engagement). For screen presentation see [Widgets and Live Activities](/mobile-app/widgets-live-activities).
