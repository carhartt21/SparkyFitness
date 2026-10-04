# iOS UI review

Run the real app with deterministic synthetic responses, independently of the user's account and server. This is a local macOS/Xcode gate, not a cloud CI job or a screenshot-only mock.

```sh
node scripts/review-ios.mjs \
  --app /absolute/path/to/DevelopmentSimulator.app \
  --output /tmp/xot-review-unique-run \
  --interactions
```

Prerequisites: Xcode with iOS 26.2 runtime (override with `--runtime`), an existing compatible Expo development **simulator** app with bundle ID `com.cg.phi`, installed project dependencies, Swift/Vision, and Ruby's `xcodeproj` gem. Use a fresh output directory. Ports 43990 and 43991 must be free. `--single` runs the German 390-point baseline case only. The app no longer offers the Liquid Glass tab bar, so `--native-tabs` has no effect. The package shortcut is `pnpm ui:review:ios --app ...`.

Use normal Xcode simulator signing for the runnable app. A build with `CODE_SIGNING_ALLOWED=NO` is only a compilation check: the current HealthKit native source lookup can abort at startup without Xcode-generated simulator entitlements. The verified local build uses `CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=-`; it does not sign or publish a physical-device archive.

The runner creates/reuses only simulators named `XOT UI Review …`; it does not erase the user's simulator or launch a physical phone. It installs the supplied native app into those disposable review devices and serves current JavaScript through a dedicated Metro process. It uses iOS launch arguments for the actual date locale, theme preferences for the app, and system Dynamic Type for the large-text case.

## Gates and artifacts

- 390×844 German dark/light; 402×874 German dark; 430×932 English dark and German accessibility-extra-large; empty day, over-target AMOLED and summary error.
- OCR waits for expected fixture metrics and rejects known untranslated dashboard labels/developer menus. It is a render smoke test, **not a visual-fidelity score**.
- Runtime errors and unknown fixture endpoints fail the run. Expected simulated HTTP 503 errors do not. Unsupported writes fail just like unknown GET routes.
- With `--interactions`, XCTest scrolls the German 390-point and English 430-point dashboards, checks the four quick actions are hittable and at least 44×44 points, and opens food search with one tap. It then searches for the synthetic yogurt, selects 200 g, types a long note, checks that the field clears the floating Save action, saves, opens the entry through Diary, edits to 100 g, and deletes. The final capture waits for Diary return and absence of the deleted row. Explicit mutation acknowledgments assert quantity and complete note retention; fixture unit tests reconcile 600 → 900 → 750 → 600 kcal. The other five cases remain Dashboard render checks, not nutrition interaction checks.
- Output includes PNGs, OCR JSON, `results.json`, Metro log, native test logs, `.xcresult` bundles exported flow attachments and per-case `.events.json` fixture audit logs. Inspect images against the reference before accepting a change; successful OCR does not prove layout quality.

`results.json` records the base Git revision; screenshots include uncommitted source edits. Record the working-tree diff with review evidence when needed. Native-test `null` means not run, never passed.

## Isolation and limits

`--interactions --motion-review --case '^(390-de-dark|390-de-light|430-de-large)$'`
mounts an isolated gallery of the production energy, X, summary row, macro,
hydration and press-feedback components. It checks exact accessible states
through 43% → 57% → 100%, decreases, unknown → complete, macro updates and
confirmed-water additions. Each case records a `.motion.mov` alongside the
ordinary PNG/XCTest evidence. The gallery contains synthetic data only.
Add `--reduce-motion --case '^390-de-dark$'` to set the native preference on
the dedicated review simulator, confirm it in rendered copy and repeat the
interactions. The runner resets that preference afterward. For production
Dashboard navigation/layout use `--summary-cards-review` separately.

`XOT_UI_REVIEW=1` changes only Metro's resolution of the entrypoint's `./App` import. Normal exports retain the production entrypoint. The review wrapper refuses release builds and physical devices, allows only the synthetic `ui-review.invalid` origin, supplies explicit GET fixtures, and accepts only enumerated in-memory nutrition and wellness mutations plus a timezone bootstrap response. Created IDs use `review-created-`; other writes and origins are rejected. Each scenario starts with a fresh fixture. Loopback audit events contain synthetic records only. No credentials or personal records belong in fixtures or committed screenshots. Do not set this variable in EAS/deployment profiles.

The synthetic transport deliberately does not verify authentication, server persistence, offline mutation replay, HealthKit, Watch sync, camera permissions or physical-device performance. Search, portion, save, quantity edit and delete are tested against memory only; persistence across process restart and editing a note with the keyboard open remain unverified. An unpaired Watch warning is expected. The review preference set hides health trend series and optional modules; those require separate scenario coverage.

Before release: run the normal type check, lint and relevant tests; export iOS without `XOT_UI_REVIEW`; verify review markers are absent from the bundle; review captures; then use a real TestFlight device for integration gates.

Runner error detection has its own tests:

```sh
node --test review/runtime-check.test.mjs
```

## Daily tracking tour

`--interactions --tracking-tour` opens Daily Check-In, Habits, Supplements, Daily Progress and Weekly Planning from More and captures top, lower and bottom views, including the weekly-plan editor. It also runs on `430-de-large` for Dynamic Type. `review/trackingFixture.ts` supplies synthetic habits, habit logs, supplements, configured objectives, planned sessions and check-ins for the populated scenario; the names are illustrations only. The tour proves navigation/rendering, not real backend persistence or physical-device synchronization.

The corresponding web persistence check runs with `XOT_VISUAL_URL=http://localhost:<isolated-web-port> node scripts/review-weekly-plan.mjs` from `XoTFrontend/`. It accepts loopback demo servers only, creates a synthetic two-session plan, verifies failed-save input retention and reload persistence against the database, then removes its synthetic plan.

## Wellness logging tour

`--interactions --wellness-tour --case '390-de-dark|390-de-light|430-de-large'`
opens More → Wellness, checks the Sauna preset's 44-point target, logs it for
the selected calendar day and expands history. It then returns to Diary, verifies
that the recorded entry appears without creation controls, and undoes that day's
entry. Each case captures More, empty, logged, history, Diary and after-undo states. `review/wellnessFixture.ts` accepts
only schema-validated wellness creations and completion/removal writes for known
synthetic activity IDs. It preserves other routine fixtures and resets per run.
This checks native behavior against memory; server persistence and real RLS are
verified separately by the wellness browser script and PostgreSQL integration test.

Run `scripts/review-wellness.mjs` from `XoTFrontend/` with `XOT_VISUAL_URL` set to
the isolated loopback web URL. It accepts loopback demo
servers only, uses synthetic names, verifies reload persistence, concurrent saves,
day-specific undo, failed-save input retention and unchanged Daily Progress, then
removes only wellness definitions it created.

## Launch-icon shortcuts

After building a simulator app that includes `expo-quick-actions`, run:

```sh
node scripts/review-ios.mjs \
  --app /absolute/path/to/DevelopmentSimulator.app \
  --output /tmp/xot-launch-icon-review-unique-run \
  --case '390-de-dark|430-en-dark' --interactions --launch-icon-actions
```

This selects a separate XCTest: long-press the real SpringBoard icon, open scan,
food, activity and measurements, and capture the native menu and destinations.
Food uses a terminated app to exercise the initial shortcut; other actions resume
the process. Scan may land on the existing camera permission screen. Camera
capture, saved entries and Android launcher behavior are outside this gate.
Shortcuts register after the first launch and follow the app language; system
menu rows follow the device language. Old native binaries need rebuilding.

## Food detail layout matrix

`--interactions --food-details-review` opens a synthetic search result and captures its amount controls, saved portions and expanded nutrition details. It also runs the light 390-point and German enlarged-text 430-point cases. The test checks that scrolling from the quantity field preserves the amount, while holding before dragging changes it. It opens Food Edit, checks the title stays between Cancel and Save, and captures the serving editor and preview. Controls may scroll into view; quantity/options and the add-serving icon have 44-point targets. It does not save in this mode. Use the default interaction flow separately for portion/save/edit/delete and keyboard-note acknowledgements.

## Meal actions from Goals

`--interactions --meal-status-review --case '390-de-dark|390-de-light|430-de-large'` opens an empty synthetic meal from Daily Progress, taps to complete it, long-presses to select “No meal,” returns to the refreshed Goals row, and reopens the meal to verify its state. The control must expose a 44×44-point target. The scenario enables meal tracking only within the isolated fixture and accepts validated, in-memory status writes scoped to the selected date. Normal fixtures continue rejecting these writes. It checks native navigation, German empty copy, action-sheet accessibility and cache refresh; it does not verify persistence against a production database or across app restarts.

## v38 corrections

```sh
node scripts/review-ios.mjs \
  --app /absolute/path/to/DevelopmentSimulator.app \
  --output /tmp/xot-v38-review-unique-run \
  --case '^(390-de-dark|390-de-light|430-de-large)$' \
  --interactions --v38-review
```

This checks the compact goal action, a pending task's real destination, fractional and unknown micronutrients, note draft retention after interactive keyboard dismissal, meal icon selection/save/reopening, and localized weekly-plan calendar controls. It also opens the 24-hour session-time picker, confirms the time and clears it without opening a keyboard. It captures the meal-settings row before editing to expose accessibility-text layout regressions. Enlarged-text screens scroll controls into view; a partially visible element's XCTest `isHittable` alone does not prove its center is above the keyboard. The fixture is isolated and resets for every case: native saves prove cache/UI behavior, not server persistence.

Add `--workout-plan-time-review` to run only the time-entry flow. At enlarged text it scrolls both bounded hour/minute lists, selects 08:05, confirms the displayed value and clears it. It checks that opening the picker never opens a text keyboard.

## Dashboard/provider/food keyboard refinements

Use `--interactions --ui-refinement-review --case '^(390-de-dark|390-de-light|430-de-large)$'` with a fresh output directory. This uses the isolated v38 fixture and captures the energy card, pending tasks, Food Settings and food details. It opens a real task destination, enters the decimal amount field, dismisses its keyboard, then writes and saves a long synthetic note. The transport acknowledgement checks the retained amount and complete note; it is not a server-persistence test.

For this geometry check the **software keyboard must be visible** in the dedicated review simulator. Use Simulator → I/O → Keyboard → Toggle Software Keyboard while an input is focused if needed. XCTest can expose a keyboard in its accessibility tree even when the visible keypad is hidden by the simulator's hardware-keyboard mode; `exists` alone is insufficient evidence. The test requires the action bar's lower edge to meet the OS-reported keyboard panel's upper edge within two logical points (XCTest's key-region rectangle omits the panel inset), rejects a duplicate English “Done” button, and checks that the long note stays above the confirmation action. Do not weaken that gate or record a hidden-keyboard run as passed.

Add `--food-keyboard-only` to focus just on amount entry, dismissal, the note and save. The visible-note boundary is the **top of the entire bar**, including the Done button when actions stack at enlarged text. The screen reserves the measured bar height rather than assuming a fixed 96-point footer, and uses UIKit keyboard insets on iOS (controller scrolling on Android) so changing a multiline note cannot contract its keyboard reserve. The existing visibility helper also protects the focused amount field. The test records note/bar bounds as well as keyboard geometry, and requires the focused numeric input to remain above the bar. Keyboard action test IDs belong to their native gesture containers; the accessible child retains its button role and localized label. The gate taps the current visible container center.

For database-backed meal-icon persistence, start the isolated web stack and run `XOT_VISUAL_URL=http://localhost:<isolated-web-port> node scripts/review-meal-type-icons.mjs` from `XoTFrontend/`. It creates, reloads, edits and resets a synthetic custom meal, checks omission-preserving and invalid-value API behavior, captures desktop/narrow pickers, then deletes its synthetic meal. It accepts loopback only. Normal startup applies the additive icon migration; production and cross-account permission checks remain separate gates.

## Paired dashboard summaries

Use `--interactions --summary-cards-review --case '^(390-de-dark|390-de-light|430-de-large)$'` with a fresh output directory. This uses the existing isolated v38 fixture and runs only the energy/task summary review, without provider or keyboard flows. It measures matching visual/supporting columns, checks normal-size row and visual heights, verifies minimum touch targets and horizontal bounds, captures both cards and opens a real pending task destination. Enlarged text uses stacked layouts. The date navigator's next-day control is deliberately excluded from the task selector. Synthetic habit names remain literal fixture data; the capture is not a localization assertion about those names.

Include `402-de-dark` for the 402×874 iPhone Pro viewport, using the available
iPhone 17 Pro simulator. At ordinary text sizes the same native test now checks
all four quick actions **before scrolling**, including their full frames and
24-point clearance above the tab bar's central Add-button overhang. This makes
first-viewport density an acceptance gate rather than relying on `isHittable`.
The smaller 390-point case must pass too. Accessibility text intentionally stacks
and scrolls; it is not required to fit the entire dashboard into one viewport.
There is no physical iPhone 18 Pro or Android claim from these captures.

It then opens the full Daily Progress screen, captures its summary and measures
the card/count frames. The count must stay within the card's horizontal bounds;
enlarged text can legitimately continue below the viewport. Measurements support
before/after height comparison rather than imposing a fixed height on content.
The same review opens the breakdown from the X graphic, count and card padding,
while retaining category-row destinations. Each target is positioned inside the
visible viewport before tapping, including in the stacked enlarged-text layout.

## Food macro column fitting

Use `--interactions --food-macro-review --case '^(390-de-dark|390-de-light|430-de-large)$'` with a fresh output directory. This opens the synthetic yogurt through real food search, checks the nutrient columns' horizontal bounds, captures 150 kcal, then edits an unsaved quantity draft to display 15,000 kcal. German formatting uses `15.000`. Inspect both captures for glyph containment: accessibility bounds alone cannot prove text fits. At enlarged text the existing two-column layout applies; the normal capture shows its first row and the long-value capture shows all four nutrients. This mode makes no saves and does not verify backend persistence.

## Caffeine and hydration sources

`--interactions --hydration-review` renders the selected-day caffeine curve with an older residual dose, opens the unified hydration card/details, and captures sources/history in German dark/light at 390×844 and enlarged text at 430×932. It asserts navigation and the absence of the separate options card. Source fixtures are synthetic and read-only; PostgreSQL reconciliation and owner-only authorization are covered separately in server tests.

## Native Watch daily goals

```sh
node scripts/review-watch-goals.mjs --output /tmp/xot-watch-goals-review-unique
```

Requires the installed watchOS 26.2 simulator runtime and Xcode. The script builds
actual `targets/watch` sources with a separate synthetic entrypoint, installs only
`com.cg.phi.watchkitapp.review` on its dedicated `XOT UI Review Watch v39 corrections`
simulator, runs 16 native assertions, and captures the German goals page. The fixture
refuses any other bundle identifier. It checks unsupported actions, duplicate taps,
account-scoped queue/replay, old-context compatibility and canonical X reveal states.
It does not grant HealthKit permission, pair a phone, access a server, or publish a
build. `results.json` records a source hash and these limits. Inspect the screenshot;
native logic checks alone do not verify every scrolled row or confirmation dialog.

The phone summary review now measures four compact **category** rows and opens their
breakdown. It captures both the category card's top and its lower rows; at enlarged
text they scroll separately. Category counts are not the daily progress denominator.
Actual confirmations, phone undo, reconnect, midnight, account switch and signed
complication delivery still require the paired-device release check.

## v40 review corrections

`--interactions --v40-review --case '^(390-de-dark|390-de-light|430-de-large)$'`
combines the summary-column/tap-target checks with Supplements captures and a
custom Check-In tag create → deselect → reopen → reselect flow. The review wrapper
resets its synthetic tag options before each case. Native input is literal (no
autocorrection), and the test checks the entered value before submitting. This
checks device preferences and navigation; it does not prove backend persistence.

`--interactions --supplements-review` with the same cases opens populated
synthetic supplement rows, checks the menu's 44-point target, and captures the
summary and separated settings actions. Only these enumerated GET responses use
the populated fixture; production requests and unsupported writes are unchanged.
User-entered dose units and names are displayed literally in this fixture too.

`node scripts/review-watch-goals.mjs --output /absolute/private/review-directory`
compiles the real Watch sources with a separate synthetic host, runs the native
goal/receipt and localization assertions, and captures German Daily Goals and
intake (known, unknown and over-target) at 42 mm. The host is never part of the
shipped app. Real phone–Watch sync and physical complication appearance remain
device checks.

## v41 inbox corrections

Use `--interactions --v41-review --case '^(390-de-dark|390-de-light|430-de-large)$'`
with a compatible simulator app and a fresh output directory. This extends the
summary/check-in review with one water quick-action confirmation showing the
synthetic 250 ml amount, then opens the supplement editor and verifies fiber,
magnesium and the expanded native nutrient section. German dark/light and enlarged
text cases use the same real components. The isolated transport accepts the
schema-validated water action in memory, with operation replay detection; it never
accesses a production account. Offline retry, actual Health writeback and paired
Watch round-trips remain unit/device gates rather than screenshot claims.

## Mobility flow

`--interactions --mobility-review --case '^(390-de-dark|390-de-light|430-de-large)$'`
seeds one synthetic two-step mobility routine in the existing local store, paused
before the tour. The transport accepts only that routine and its sessions with
schema-validated mutations and retained operation IDs. XCTest resumes, captures
the halfway state, confirms the first exercise, captures transition/automatic
start, confirms the second and opens its diary entry. Health workout recording is
disabled in this simulator fixture. These captures verify UI/flow, not audible
playback, real backend persistence or Apple Health/Fitness export.
