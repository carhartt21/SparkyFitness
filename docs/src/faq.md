# X on Track FAQ

## What is X on Track?

X on Track is a private, self-hosted companion for nutrition, training, activity, health data, and progress relative to your own baseline. **Keep getting better.** is its guiding line. An “on track” status is shown only when the app has enough data to support it; a missing log is missing information, not a failure.

## Where is my data stored?

The mobile app can keep local drafts and sync with the server you configure. Health data is read with your permission and sent to that server when you enable synchronization. Connected food, fitness, and AI providers have their own data-handling terms. Review the relevant provider settings before enabling them.

## Can I install X on Track from the App Store or Google Play?

The owner app uses an internal TestFlight program. Use the owner's invitation; do not use upstream store/TestFlight links as X on Track downloads. A newly uploaded build still needs Apple processing and tester assignment. See the [mobile app guide](/mobile-app/mobile-app).

## Why do some paths and settings still say SparkyFitness or PersonalBest?

X on Track is built on SparkyFitness. Source packages now use `XoTFrontend`, `XoTServer` and `XoTMobile`. Some environment variables, URL schemes, bundle identifiers, App Groups, storage/database keys, MCP tool names and the Expo project's `personalbest` slug are retained for compatibility with installed data and integrations. These identifiers do not name the product in the interface.

## Does the mobile app need HTTPS?

Yes. Use an HTTPS server connection for mobile sign-in and synchronization. If you are testing a local server, use a trusted secure tunnel or a correctly configured certificate; plain HTTP will be rejected by the mobile app.

## Is there an Apple Watch companion?

The iPhone release includes a companion for live workouts and supported complications. Install/open it through the iPhone Watch app; add a compatible complication manually. See [Widgets and Live Activities](/mobile-app/widgets-live-activities). Device acceptance is recorded per build; a source change alone does not prove a new Watch feature works.

## How do I deploy the server?

The [installation guides](/install/docker-compose) describe the upstream-compatible SparkyFitness server foundation used by X on Track. Keep the documented package paths and environment-variable names when following them. Some older pages retain upstream names and links because they identify that software or its community rather than the X on Track brand.

## What license and support channels apply?

The repository retains the [upstream SparkyFitness license](https://github.com/CodeWithCJ/SparkyFitness/blob/main/LICENSE) and attribution. Upstream GitHub, Discord, and App Store links are not X on Track release or support channels. The older upstream FAQ is preserved in this repository under `docs/upstream/faq.md`; its product and release claims should not be assumed to describe X on Track.
