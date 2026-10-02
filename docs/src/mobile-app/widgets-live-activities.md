# Widgets, Watch complications and Live Activities

Widgets are added manually to the Home Screen, Lock Screen or Watch face. Live Activities appear while a supported session or timer is active. They are separate from [optional push reminders](/features/settings/notifications); enabling remote delivery does not install a widget or create a Live Activity.

The mobile **Notifications → Widgets & Live Activities** guide reports whether Live Activities are enabled, disabled, unsupported or unverified in that build. It cannot verify whether you placed a widget or saw a notification.

## iPhone widgets

Open X on Track once after installing or updating to refresh shared data.

- **Home Screen:** touch and hold an empty area, choose the system's add-widget action, then **X on Track**. Available overviews include energy, macros, meal capture and routines.
- **Lock Screen:** touch and hold the Lock Screen, customize it, then add an **X on Track** widget. Meal-capture and routine shortcuts support Lock Screen placement; energy and macro overviews are Home Screen widgets.

Exact system labels vary by iOS version. Tapping a shortcut opens the corresponding app flow. A saved snapshot may be stale until the app refreshes; a widget is not a continuously streaming dashboard.

## Live Activities and Dynamic Island

Allow **Live Activities** in the iOS settings for X on Track. This is distinct from notification permission. Start a live workout, fasting timer, movement break or guided mobility session in the app. Its current state can appear on the Lock Screen and, on supported iPhones, Dynamic Island. There is no separate persistent “enable Dynamic Island widget” switch.

If nothing appears, check the permission, whether a supported session is actually running, the installed build and system support. Timers can still work when presentation is unavailable. A completed diary entry or a planned training session is not an active timer. Starting a session through the mobile app is different from logging an exercise through MCP.

## Apple Watch

Install/open the companion using the iPhone Watch app, then edit a compatible watch face's **Complications** and select X on Track in a supported slot. Tapping it opens the companion.

Energy-goal and water complications use circular slots. **Daily Progress X** also supports rectangular, corner and inline slots where the face provides them. It represents completed applicable daily tasks, not a combined health score. If you still see only energy rings or water, check the selected complication and face slot and verify the installed companion is current.

### Daily goals on the Watch

The updated companion has a **Daily goals** page. Open the phone app to send its
current-day task count and unfinished goals; tapping **Daily Progress X** opens
this page. This requires matching updated phone and Watch builds. Older companions
retain the nutrition overview and do not acquire a new page from a server update.

Tap a completion habit or meal to review an explicit confirmation. Completing a
meal changes its status only; it does not create food or calories. Counts,
measurements, supplements and workouts that need more details direct you to the
phone. The page does not automatically mark an intake or workout complete.

A disconnected confirmation stays **Waiting for phone**. After reconnection, the
phone validates the account, current day and source state before saving. If saving
was uncertain, refresh and inspect the goal on the phone before confirming again.
Old-day actions are not carried into today's progress. The list is bounded to 64
unfinished goals; the full breakdown stays available on the phone. Unknown data and
optional tasks are distinct from completed progress.

The companion's live-workout screen is separate from a complication. Open an active phone workout to use the existing phone/Watch set and rest-timer synchronization.

## Android

Add X on Track from your launcher's widget picker. Available calorie/macro overviews use the existing Android widget pipeline; launcher steps vary. Android has no iOS Dynamic Island or ActivityKit Live Activities. Existing workout and timer notifications remain separate.

For installation and secure server connections see the [Mobile app guide](/mobile-app/mobile-app). Maintainers should use the [release runbook](https://github.com/carhartt21/SparkyFitness/blob/main/XoTMobile/docs/testflight-release.md) and validate the signed widget/Watch app-group entitlements before claiming device support.
