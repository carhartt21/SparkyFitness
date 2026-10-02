# X on Track mobile app

X on Track supports food and workout logging, local saves, Apple Health or Health Connect synchronization, and a connection to your server over HTTPS. The iPhone build includes an Apple Watch companion, widgets and Live Activities.

## Install and connect

The owner app is distributed through its internal TestFlight program. Use the owner's invitation and release notes; the upstream store links below are a different application. Availability of a newly uploaded build depends on Apple processing and tester assignment, not just build success.

Install an update over the existing X on Track app without deleting it to retain local entries and settings. Sign in to the same server/account, then check a previous entry and sync status. The app retains its bundle IDs, deep-link schemes and sharing identifiers so branding changes do not create a new data container. The iOS identifier `com.cg.phi` is a signing/compatibility identifier, not the product name; a build with it replaces an app already using that identifier.

Use a trusted **HTTPS server URL** for the first-run connection and sign-in. A secure Expo tunnel loads a development app's JavaScript; it is not the nutrition/workout API server. Do not enter an Expo development-server URL into the account's server-connection field. Localhost on your Mac is not localhost on the phone.

Open the app after an update to refresh shared widget data and reconcile local reminders. Install/open the paired Watch companion separately through the iPhone Watch app when needed.

## Guides

- [Weekly training plans](/features/exercises/weekly-planning): schedule whole activities and presets without recording them as completed.
- [MCP-based training](/features/exercises/mcp-training): assistant reads, preset changes, mobility planning and current limits.
- [Notifications and reminders](/features/settings/notifications): permissions, optional quota, remote delivery and intake follow-ups.
- [Widgets, Watch complications and Live Activities](/mobile-app/widgets-live-activities): place widgets and enable active-session presentation.
- [Proxy setup](/mobile-app/proxy-setup) and [Troubleshooting](/mobile-app/troubleshooting): server connection and diagnostic checks.

For maintainers, the [TestFlight release runbook](https://github.com/carhartt21/SparkyFitness/blob/main/XoTMobile/docs/testflight-release.md) covers cloud builds, the local fallback, signing/export and upload verification. Current deployment/build results belong in dated release records, not this evergreen guide.

## Upstream store builds

The following are **SparkyFitness upstream builds**, not X on Track downloads. Follow upstream instructions for their identifiers, screenshots and release schedule:

- [Upstream iOS App Store listing](https://apps.apple.com/us/app/sparkyfitness/id6757314392)
- [Upstream TestFlight program](https://testflight.apple.com/join/9Yz8PzpR)
- [Upstream Android releases](https://github.com/CodeWithCJ/SparkyFitness/releases)
- [Upstream Google Play beta](https://play.google.com/store/apps/details?id=com.SparkyApps.SparkyFitnessMobile)
