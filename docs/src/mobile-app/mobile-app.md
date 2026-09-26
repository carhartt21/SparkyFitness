# X on Track mobile app

The iPhone and Android app supports food and workout logging, Apple Health or Health Connect synchronization, and connection to a self-hosted server over HTTPS. The iPhone build also includes an Apple Watch companion, widgets, and Live Activities.

The X on Track identity is implemented in the development app. A production-resolution logo master, signed release build, and physical-device acceptance pass are still required before publishing it as X on Track. The app currently retains its existing bundle identifiers and deep-link schemes so installed data and integrations survive the name change.

## Development and self-hosted testing

Use a server with a trusted HTTPS URL. The app can connect through a secure development tunnel when testing locally. Plain HTTP is not a supported mobile connection. Complete the first-run server connection and sign-in flow, then verify a saved entry remains after a cold launch.

The development iOS bundle identifier is `com.cg.phi`; this is a compatibility and signing identifier, not the public product name. Installing a new development build with that identifier replaces any app already installed under it. The production identifiers are intentionally unchanged in the source configuration.

## Upstream store builds

The following are **SparkyFitness upstream builds** and must not be presented as X on Track downloads:

- [Upstream iOS App Store listing](https://apps.apple.com/us/app/sparkyfitness/id6757314392)
- [Upstream TestFlight program](https://testflight.apple.com/join/9Yz8PzpR)
- [Upstream Android releases](https://github.com/CodeWithCJ/SparkyFitness/releases)
- [Upstream Google Play beta](https://play.google.com/store/apps/details?id=com.SparkyApps.SparkyFitnessMobile)

The upstream APK filename `SparkyFitnessMobile.apk` and package ID are technical release identifiers. Use the upstream documentation for those builds; their screenshots and release schedule do not verify the X on Track app.
