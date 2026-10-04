# Dashboard widget motion

Branch: `feat/dashboard-motion-20261004`, based on the whole-card navigation change at `d0dbb161b`. This is a mobile presentation change; it does not change goals, intake, completion rules, logging, synchronization or notification delivery.

## Motion policy

The focal moment is one quiet halo when a visible, known Daily Progress value reaches 100%. Other motion acknowledges actual data changes and presses. There are no looping glows, numeric count-ups, entrance staggers or automatic zero-to-value replays.

| Surface                    | Behavior                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily Progress X           | Canonical arc-length reveal, 480 ms from the currently rendered endpoint, including decreases. The separate halo rises for 160 ms and settles for 350 ms after completion.   |
| Progress categories        | Changed state fades from 72% to full opacity in 180 ms, with the same row position and immediately correct status text.                                                      |
| Calories                   | Existing 450 ms gauge easing retained; changed support rows fade for 180 ms. Exact energy values and arithmetic update immediately.                                          |
| Hydration                  | Existing 450 ms confirmed-water bar easing retained; changed cup markers illuminate/fade for 200 ms. Pending water does not fill confirmed cups. Corrections can empty cups. |
| Macros                     | Both the dashboard row and existing card variants retarget for 300 ms. Initial/focus renders no longer reset to zero. Nutrient colors and over-goal semantics are preserved. |
| Actions and tappable cards | Shared `MotionPressable` compresses to 98.5% over 100 ms, then returns over 150 ms. Existing pressed opacity, callbacks, disabled/loading behavior and touch bounds remain.  |

Native Reduce Motion suppresses spatial/value animations and completion pulses. The existing pressed opacity still confirms presses. Native preference changes are observed during the session; a delayed initial preference query cannot overwrite a newer event. Hidden screens and backgrounded apps cancel motion and settle to actual values without replaying on return.

Unknown progress remains explicitly unknown, distinct from 0%. Unknown-to-known resolution is immediate instead of advancing from an invented zero. Accessibility and numeric progress report the actual input immediately, independently of the decorative reveal. Mounting at 100%, restoring an unknown value as 100%, repeated renders and returning to a complete screen do not celebrate.

## Reusable components

- `useMotionPreferences()` returns `{ active, reducedMotion }`, combining optional screen focus, native foreground state and the accessibility preference. It also works in standalone previews without a navigation provider.
- `useTweenedValue(target, durationMs = 450)` returns a visual number, or `null` for an explicitly unknown target. Keep exact text outside the tween. Callers validate/normalize their domain inputs before passing them.
- `ValueChangeFade` accepts a scalar `changeKey`, children, optional style/class name, and `duration` (180 ms). Mounting/unchanged/null keys do not fade. The new content is immediately accurate; there is no duplicate old text layer.
- `MotionPressable` retains native pressable callbacks, accessibility props, disabled state, class names and fixed view styles. Existing array transforms are preserved. A caller-supplied string transform is retained instead of overwritten.
- `DashboardSummaryRow.changeKey` enables change feedback without changing row navigation or layout. Progress passes its category state; energy passes the actual support value.
- `ProgressTrackX` keeps its existing API and canonical geometry. Completion feedback is internal and visually separate from the mark.

Shared `NeonButton`, `ActionTile`, interactive `GlowCard` and the progress card's outer tap target use press feedback. This also gives existing callers consistent feedback without altering their routes or actions.

## Validation

- Mobile `pnpm run validate`: passed, including TypeScript, lint, locale/override audits, Knip, native asset contracts and formatting.
- Complete mobile Jest suite: **548 suites, 7,723 tests passed** after correcting two navigation mock failures and one nondeterministic hydration motion assertion.
- Final focused motion suite: **5 suites, 46 tests passed**, including the additional slow-preference-query regression added after the full run.
- Review runner runtime checks: **3 passed**.
- Production iOS JavaScript/assets export: passed with `XOT_UI_REVIEW` unset. Review-only markers and the synthetic credential are absent from the exported Hermes bundle.
- Impeccable scan of the edited production UI: no findings.
- Native simulator presentation harness: German 390-point dark/light and 430-point accessibility-extra-large passed. It exercises 43% → 57% → 100%, a corrected decrease, unknown → 100%, macro changes, water additions and the real shared buttons.
- Native iOS Reduce Motion run: passed, with the simulator's native preference confirmed by the harness. It performs the same interactions and confirms immediate correct state.
- Production Dashboard summary navigation/layout checks: recorded separately in the evidence directory, including normal dark/light and enlarged German text.

The full suite exposed a test that replaced all navigation exports with `useIsFocused`; its mock now preserves real exports. The hydration transition test fixes motion preferences locally while native preference handling is tested separately. Neither correction changes production business logic. Initial native harness attempts also needed explicit splash dismissal and grouped accessibility queries; failed attempts are not acceptance evidence.

## Evidence and limits

[Evidence and recording](evidence/dashboard-widget-motion-2026-10-04/README.md) contain synthetic component states and production Dashboard captures. The recording shows intermediate reveal frames, immediate exact numbers and settled results. It is an isolated component gallery, not a replacement production Dashboard or invented account data.

No dependencies, native assets, migrations or server configuration changes are required. Review code is selected only by the existing development-simulator entrypoint override. The normal entrypoint remains unchanged.

Physical iPhone performance, Android rendering, live/offline server synchronization, VoiceOver speech timing and Watch/WidgetKit hosting were not tested in this batch. The native checks run current JavaScript in the existing compatible development simulator binary and compile the XCTest harness; they are not a new signed device archive or TestFlight publication. Phone dashboard cards are the motion target; system widgets and Watch surfaces retain their existing behavior.
