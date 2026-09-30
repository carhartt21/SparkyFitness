# X on Track repository audit — 26 September 2026

## Decision summary

The next investment should be **trust, recovery, and fast daily use**, before another visual overhaul or a large new feature. The existing architecture supports that direction: shared calculation helpers, account-scoped offline actions, diary snapshots, native navigation, and reusable UI tokens are already present.

Prioritize three integration callback fixes and dependency triage; establish repeatable signed-in verification; correct the meal-label and contrast regressions; then improve report loading and nutrition completeness. Add a unified sync/recovery view and web diary bulk actions after those foundations.

Audited revision: `f4ad584fe5acfe6cc3f3fdee2da5ef8b46a99e09`, branch `feat/personalbest-rebrand`. Scope: React/Vite web, Expo/React Native mobile and Watch-facing flows, shared contracts/calculations, Express/PostgreSQL API, CI, and documented deployment protections. This is a source-level audit with focused executable checks, **not** a penetration test, exhaustive endpoint review, authenticated visual acceptance run, or measured production performance study.

At inspection, iOS 1.7.2 (9) had finished building and uploading to App Store Connect. TestFlight processing/availability was not verified. The private web deployment was at the audited revision. No application changes or deployment were performed for this audit.

## Evidence and confidence

- **Confirmed:** directly traceable source behavior, or an executed check. Source-confirmed UI behavior still needs a rendered regression check.
- **Conditional:** the unsafe code/configuration exists, but actual exposure depends on environment or input reachability.
- **Opportunity:** proposed improvement; user benefit remains a hypothesis to validate.
- Effort: S = roughly less than one engineering day; M = 1–3 days; L = several days across layers. These are planning estimates, excluding external release processing and owner testing.

No P0 outage or proven account compromise was established. The register contains **8 P1 and 6 P2 findings**. P1 means major user impact, a confirmed normal-text contrast failure, or security work to prioritize before wider distribution; conditional security findings are not assertions of current exploitation.

| ID  | Priority | Scope                | Finding                                                                       | Confidence                                        | Effort |
| --- | -------- | -------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- | ------ |
| S1  | P1       | API/integrations     | Oura, Fitbit, Strava callbacks do not validate an authorization nonce         | Confirmed gap; exploitability not tested          | M      |
| S2  | P1       | API/media            | Broad public upload mount relies on a sensitive-directory denylist            | Confirmed; current private ingress mitigates      | M      |
| S3  | P1       | Auth                 | Private-network CORS settings can disable Secure cookies for HTTPS            | Conditional configuration risk                    | S–M    |
| S4  | P1       | Dependencies         | Production dependency graph has unresolved advisories                         | Confirmed scan; runtime reachability unverified   | M      |
| U1  | P2       | Web Diary/navigation | Renamed system meals retain original labels outside Settings                  | Confirmed source inconsistency                    | S      |
| U2  | P1       | Both apps/reports    | Missing nutrient measurements become numerical zero                           | Confirmed data semantics                          | L      |
| U3  | P1       | Mobile Diary         | Bulk Apply label fails normal-text contrast in dark themes                    | Confirmed calculation                             | S      |
| U4  | P1       | Mobile charts        | Shared chart interaction lacks an equivalent accessible value-navigation path | Confirmed component gap; device impact unverified | M      |
| U5  | P2       | Mobile Diary         | Bulk date input and drag feedback make moving entries unnecessarily difficult | Confirmed implementation; usability inferred      | M      |
| U6  | P2       | Web shared UI        | Small action targets and component styling bypass consistent tokens           | Confirmed source; responsive impact unverified    | M      |
| P1  | P2       | Web/API reports      | Unrelated queries gate reports; failures can resemble empty sections          | Confirmed data flow                               | M–L    |
| P2  | P2       | API/performance      | Large default bodies, broad reports, and missing runtime query budgets        | Confirmed settings; saturation unmeasured         | M      |
| S5  | P2       | Uploaded images      | Extension/MIME checks without decode validation or image normalization        | Confirmed inspected routes                        | M      |
| Q1  | P1       | Verification/CI      | Signed-in UI evidence is missing; real RLS tests have a narrow trigger        | Confirmed coverage gap                            | M–L    |

## Security and operational findings

### S1 — Bind every integration callback to the initiating account and browser flow

**Evidence:** `XoTServer/integrations/oura/ouraService.ts:130`, `integrations/fitbit/fitbitService.ts:34`, and `integrations/strava/stravaService.ts:32` use a user identifier as state. Their callback handlers in `routes/ouraRoutes.ts:60`, `routes/fitbitRoutes.ts:56`, and `routes/stravaRoutes.ts:45` consume the authorization code without validating state. No equivalent PKCE verifier was found in those flows. GET authorize routes require the self actor; callbacks do not apply the same explicit self-only gate.

**Impact:** the callback lacks proof that this account initiated this authorization exchange. Existing authentication, permission middleware, provider behavior, and RLS still matter; this audit did not demonstrate account takeover or a successful delegated credential write.

**Correction:** reuse the opaque, expiring, actor-bound, single-use state pattern already implemented for Withings/Polar in `utils/oauthState.ts`. Require the self actor consistently; bind provider and redirect context. Review Strava's caller-supplied redirect against a configured allowlist.

**Verify:** reject missing, wrong, expired, replayed, wrong-provider, and wrong-actor state before token exchange. A valid flow completes once. Test real DB policy enforcement as well as mocked route tests. This follows the callback CSRF protections in [OAuth Security BCP](https://www.rfc-editor.org/info/rfc9700/).

### S2 — Make private media authorization an application guarantee

**Evidence:** `XoTServer/XoTServer.ts:414–490` mounts the upload tree publicly, excluding particular sensitive first-level directories. `routes/exerciseEntryRoutes.ts:35–54` and `:348–352` save workout images under `exercise_entries`, outside that denylist. Static media has a seven-day immutable cache policy. Avatar storage is another public subtree.

**Impact:** in a standard deployment, knowledge of a private workout-image URL can bypass per-user access checks. Random filenames are not authorization. Current private deployment documentation records an authenticated media gateway and anonymous-request rejection, so this is **not a finding of an exposed image on the current private site**.

**Correction:** authorize private media through an ownership-aware identifier route and existing family permissions. Explicitly allow public catalog assets separately. Give sensitive responses account-safe cache behavior and test sign-out/account switching.

**Verify:** anonymous and unrelated-account requests fail, including encoded/case variants; authorized owner and permitted family access work. Verify both direct API and proxy paths. Keep download/nosniff protections.

### S3 — Separate HTTPS session security from CORS convenience

**Evidence:** `XoTServer/auth.ts:406–413` disables Secure cookies when private-network CORS is enabled or an extra trusted origin contains `http://`, even if the primary frontend uses HTTPS. Forwarded host/protocol headers are trusted at `:419`.

**Impact:** enabling a development connectivity option can weaken cookie transport settings. The running environment values were not read; this is conditional, not a confirmed insecure production cookie.

**Correction/verify:** keep HTTPS cookies Secure independently of the CORS allowlist. Isolate explicit HTTP development behavior and document the trusted proxy boundary. Test HTTPS alone, HTTPS plus an HTTP extra origin, local HTTP development, and forwarded-header spoofing through the supported ingress.

### S4 — Triage dependency advisories by execution path

`pnpm audit --prod --json` reported **61 findings: 1 critical, 44 high, 14 moderate, 2 low**, across 1,494 dependencies and 45 unique advisory records. These counts include dependency-path effects and build/development tools declared within production dependency chains; they are not counts of exploitable shipped-app vulnerabilities.

| Dependency/path                                         | Installed | Registry remediation floor                                  | Triage                                                                    |
| ------------------------------------------------------- | --------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| Server → Express → router → path-to-regexp              | 8.3.0     | 8.4.0                                                       | Runtime server dependency; inspect registered route-pattern prerequisites |
| Web → better-auth → defu                                | 6.1.4     | 6.1.5                                                       | Determine whether hostile defaults can reach the affected operation       |
| Expo → React Native → react-devtools-core → shell-quote | 1.8.3     | 1.8.4 for quote advisory; 1.9.0 for separate parse advisory | Toolchain path; not evidence of on-device shell execution                 |
| Web → quagga2 → sharp                                   | 0.34.5    | 0.35.4 covers both scanned advisory floors                  | Check build/native processing use; not browser-native image execution     |

Primary notices: [path-to-regexp](https://github.com/pillarjs/path-to-regexp/security/advisories/GHSA-j3q9-mxjg-w52f), [defu](https://github.com/unjs/defu/security/advisories/GHSA-737v-mqg7-c878), [shell-quote](https://github.com/ljharb/shell-quote/security/advisories/GHSA-w7jw-789q-3m8p). The shell-quote maintainer rates the quote issue high while the scanned registry rates it critical; exploitation requires attacker-controlled object operator content reaching shell execution. No such application path was proven here.

**Correction/verify:** make compatible, scoped dependency updates; rescan; exercise authentication, routing, scanning and native builds. Preserve Expo compatibility. Record justified reachability exceptions with expiry dates rather than hiding all high advisories or force-upgrading the entire graph.

### S5 — Validate and normalize uploaded image content

**Evidence:** `middleware/uploadMiddleware.ts:13–22` checks extension and MIME text, with a 10 MB limit. `routes/auth/userProfileRoutes.ts:40–57` uses a similar 5 MB filter. Inspected exercise-entry/avatar save paths construct URLs from uploaded files without decoding/re-encoding them.

**Impact:** the server cannot establish that submitted content is a safe, bounded image, and original image metadata/oversized dimensions are retained. Existing attachment and nosniff headers reduce risk; this is not a demonstrated script execution or RCE vulnerability.

**Correction/verify:** decode using maintained libraries, cap dimensions/pixel count, strip location metadata, generate useful thumbnail sizes, and define deliberate GIF handling. Test disguised content, malformed/truncated files, oversized dimensions, EXIF location removal and authorized retrieval. This also reduces image transfer costs.

## UI, data integrity, and performance findings

### U1 — Propagate custom meal labels without changing identity

**Evidence:** `XoTServer/models/mealType.ts:46` exposes `display_name`. Web `pages/Settings/MealTypeManager.tsx:149` uses it, but `pages/Diary/Diary.tsx:420–451` passes canonical `name` to headings and meal presentation. `utils/nutritionCalculations.ts:586–622` translates the original name; `layouts/MainLayout.tsx` quick-log meal labels do the same.

**Impact/correction:** a Breakfast→Morning meal rename appears successful in Settings but is not reflected where food is logged. Share a display-label helper taking the meal object, preserving canonical IDs/names for history matching and calculation.

**Verify:** renamed system and custom meal labels agree across Settings, Diary, add-food and quick-log menus; historic entries, ordering, totals and translations remain unchanged. Suggested design pass: `impeccable harden`.

### U2 — Distinguish unknown nutrient values from measured zero

**Evidence:** `XoTServer/models/reportRepository.ts:37–69` and `:184–200` coalesce nutrient fields to zero. Mobile `src/screens/DailyNutritionDetailsScreen.tsx:131–142` sums known numbers from an initial zero, then displays a numeric total. Consequently, entries without sodium information can look like a measured 0 mg sodium total.

**Correction:** return additive coverage information per nutrient, alongside existing sums. Show a known total with partial-coverage context or an unknown state when nothing was measured. Separate source completeness from whether the user considers the day's logging finished. Do not silently change goal formulas.

**Verify:** shared fixtures cover all-known, partly-known, all-null, explicit zero, supplements, imported meals, local midnight/DST, units and rounding. Web/mobile reconcile. Do not interpret incomplete food logging as a confirmed deficit. Whole-day missing-data filtering was recently improved using recorded dates; retain that work. Suggested pass: `impeccable clarify`.

### U3 — Reuse the theme-aware button foreground

**Evidence:** mobile `src/components/DiaryBulkActionSheet.tsx` uses `text-white` on `bg-accent-primary`, while `src/components/ui/Button.tsx:55` correctly uses `text-accent-text`. The dark/AMOLED accent in `global.css` is `#11a67e`.

**Measured:** white on that accent is **3.10:1**, below the 4.5:1 normal-text threshold. Existing dark foreground `#171c22` yields **5.53:1**. White on the light-theme accent `#0b5e46` yields **7.77:1**. [WCAG contrast guidance](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) supports this finding.

**Correction/verify:** use the shared Button or its foreground token; test normal/disabled/pressed/busy states in all themes and enlarged text. Suggested pass: `impeccable harden`.

### U4 — Expose chart values without touch gestures

**Evidence:** mobile `src/components/ChartTouchOverlay.tsx:307–324` implements raw touch responders. `src/components/TrendBarChart.tsx` has no equivalent accessible value navigation or table; its tooltip uses fixed `h-6` and module-level chart font sizing.

**Impact/correction:** a visual touch tooltip is insufficient for a screen-reader user to inspect the same values. Add an accessible summary and expandable value list, or previous/next value actions with units/date announcements. Let tooltips grow and account for font scaling.

**Verify:** VoiceOver reaches every date/value without sighted touch targeting; values match chart fixtures; test large text, sparse days, long units and reduced motion. Fixed-height clipping is a risk to verify, not an observed screenshot defect. Suggested pass: `impeccable adapt`.

### U5 — Make bulk moves feel native and predictable

**Evidence:** `src/components/DiaryBulkActionSheet.tsx:90–107` requires a manual ISO date although the app already has a CalendarSheet. `src/components/SwipeableFoodRow.tsx:83–95` handles drag start/release with highlighting but no moving preview; meal destinations are measured at release without automatic scrolling. Bulk selection provides an alternative.

**Correction/verify:** reuse localized date selection with Today/Yesterday shortcuts; add visible source/destination feedback and cancellation, and support offscreen destinations or clearly route to the bulk move picker. Test long lists, interrupted gestures, keyboard dismissal and assistive technology. Preserve server restrictions for unsupported imported/composite entries. Suggested passes: `impeccable adapt`, then `impeccable polish`.

### U6 — Finish shared interaction sizing and theme consistency

**Evidence:** web `components/ui/button.tsx:29–33` uses 40 px defaults/icons and 36 px small buttons; Diary `MealCard.tsx:591–624` edit/delete controls are 36×36 px. Shared dark styling also hard-codes slate/white rather than consistently expressing semantic action colors.

**Correction/verify:** provide at least 44 px touch areas for primary/touch-oriented controls while retaining useful desktop density. Use tokens for foreground/background pairs and focus states. Check keyboard focus, zoom, long translations and all themes. A 36 px target misses this project's 44 px acceptance goal; it is **not automatically a WCAG 2.2 AA target-size failure**, whose minimum differs. Suggested pass: `impeccable adapt`.

### P1 — Render Reports progressively and preserve failure context

**Evidence:** web `pages/Reports/Reports.tsx:115–150` starts mood, raw stress, exercise, fasting, core-report and calorie-balance queries; `:431–435` gates the page on their combined loading state. Error arrays can default to empty; the global QueryCache toast is present, but persistent section-level retry/error context is missing. Report subviews are statically imported inside the already lazy-loaded route.

**Correction:** show nutrition as soon as its data arrives. Enable secondary queries on demand, split substantial secondary charts, and provide inline retry/stale timestamps. Keep empty distinct from failed or not-yet-loaded. `hooks/Reports/useReports.ts:19–50` additionally fetches all raw stress-category entries; request bounded date ranges rather than filtering all history in the browser.

**Verify:** hold stress/sleep requests pending or make them fail; nutrition remains usable with truthful local status. Measure request count, bytes and time-to-first-useful-report on fixed 30/90/365-day fixtures before/after. No speedup percentage is claimed without those measurements. Suggested pass: `impeccable optimize`.

### P2 — Bound expensive work at the API and database

**Evidence:** `XoTServer.ts:250,266` installs 50 MB parsers before the relevant authentication boundary. `routes/reportRoutes.ts:31–65` and subsequent report handlers validate date presence without consistently enforcing a strict bounded range. `services/reportService.ts:135–204` loads 13 datasets and then performs serial custom-category queries. `db/poolManager.ts:22–49` caps pools at 10 with connection timeout but sets no runtime statement/lock timeout.

**Impact/correction:** ordinary large requests or long histories can monopolize memory/query capacity. Use smaller defaults and scoped large-body paths, reusable strict date-range contracts, selective report datasets, batched category queries, cancellation/timeouts and an appropriate export route for large ranges. Model the already bounded `dailySummaryRoutes` and batched `dailySummaryRangeService` rather than rewriting them.

**Verify:** oversized bodies fail predictably, bounded reports return complete correct data, expensive statements terminate cleanly, and concurrent imports do not starve day logging. Compare p95 latency, memory, rows, query count and response bytes under synthetic load. Existing capacity has not been benchmarked.

## Q1 — Make verification repeatable before increasing scope

**Evidence:** previous redesign evidence explicitly lacks authenticated captures for all target screens. Current unit coverage is extensive, but it cannot prove keyboard visibility, responsive layouts, actual callback binding, or live RLS behavior. `tests/rlsPermissionMatrix.integration.test.ts` can skip when the DB is unreachable. `.github/workflows/ci-tests.yml:52–66,206–210` enables the real migration/RLS lane for selected migration/policy/test paths, not all relevant auth, middleware, or model changes.

**Correction:** create a disposable synthetic account/seed harness for web and simulator, with deterministic dates, entries, imports and pending sync states. Trigger the real DB permission matrix for security-sensitive code and fail that CI lane on unexpected skips. Add focused signed-in journey tests and screenshot evidence rather than more implementation-mirroring unit tests.

**Exit checks:** search→portion→save, edit/delete, date navigation, hydration, workout completion and reconnect all reconcile to persisted summaries. Capture 390×844 and 430×932 mobile plus 1280×800 and 1440×900 web; test long names, large text, dark/light/AMOLED, keyboard, focus, reduced motion, error/empty/permission/offline states. Use synthetic data in committed artifacts. Suggested passes: `impeccable audit` and `impeccable harden`.

## Highest-value feature opportunities

These are product hypotheses, separate from the confirmed defect register.

| Rank | Feature                          | Why it is useful now                                                      | Existing foundation / guardrail                                                                                                 | Acceptance                                                                                                                                                              |
| ---- | -------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Unified sync and recovery center | Explains where a food/workout is saved and what needs attention           | Mobile `nutritionActionOutbox` already has account-scoped pending/syncing/attentionRequired/synced states; preserve idempotency | Show last success and actionable errors per server/Health/Watch/import source; retry never duplicates entries; account switching cannot expose another account's queue  |
| 2    | Data provenance and completeness | Builds confidence in totals across imported foods, supplements and Health | Build on U2 and existing energy-policy helpers                                                                                  | Known/partial/unknown nutrient coverage, source where available, and a clear base-target/activity/intake/remaining explanation; no unsupported deficit or health claims |
| 3    | Web diary multi-select parity    | Reduces repeated edits and moves across days/meals                        | Reuse the newly added atomic bulk endpoint; existing day-copy and saved meals remain                                            | Select supported rows, preview move/copy/delete, execute once, refresh all summaries; exclusions explain why                                                            |
| 4    | Focused dashboard/report presets | Reduces equally prominent information and supports different review tasks | Existing widget preferences and progressive chart controls                                                                      | A small saved selection of useful metrics/date periods; all current destinations remain reachable; measure logging/report task time                                     |

A persistent desktop navigation rail is a reasonable design direction for rank 4: `MainLayout.tsx:538–605` still uses a horizontal grid/More pattern. This is a reference-alignment opportunity, not a demonstrated broken route. Test it with the desktop workspace before changing mobile navigation. Do not prioritize new AI coaching, disease scores, social/premium surfaces or a framework rewrite ahead of these fundamentals.

## Impeccable assessment

**Implementation integrity: pass at the source-system level, with exceptions.** Approved identity, semantic mobile tokens, shared energy logic and recognizable component patterns exist. New isolated controls still bypass that system. `DESIGN.md` documents Settings rather than the full dashboard/diary/report system; extend its scope when consolidating the components.

**Native conformance: fail for complete conformance, with an established native foundation.** Native navigation and virtualized food search are positives. The manual ISO bulk date field, touch-only chart inspection and incomplete drag feedback need correction. This is not a finding that the entire application behaves like a website.

Provisional source-review scores below use 0–4 per dimension; unrendered behavior prevents a release-quality or accessibility certification. Scores are prioritization aids, not measured user satisfaction.

| Web dimension            | Score     | Main constraint                                                      |
| ------------------------ | --------- | -------------------------------------------------------------------- |
| Accessibility            | 2         | Target sizing/systematic focus and chart verification incomplete     |
| Performance              | 2         | Report-wide query/loading coupling                                   |
| Responsive design        | 2         | Source support exists; required signed-in viewport matrix unverified |
| Theming                  | 3         | Shared system present; action overrides persist                      |
| Implementation integrity | 2         | Meal label drift and incomplete-data ambiguity                       |
| **Total**                | **11/20** | **Significant work remains**                                         |

| Mobile dimension     | Score     | Main constraint                                                         |
| -------------------- | --------- | ----------------------------------------------------------------------- |
| Accessibility        | 2         | Confirmed bulk-button contrast and chart interaction gap                |
| Performance          | 3         | Virtualized search and image handling present; device profiling missing |
| Appearance/theming   | 3         | Coherent tokens with local exceptions                                   |
| Platform conformance | 2         | Bulk date/drag interaction and chart access                             |
| Adaptivity           | 2         | Large-text and full viewport matrix unverified                          |
| **Total**            | **12/20** | **Significant work remains**                                            |

Suggested design sequence: `impeccable harden` → `impeccable optimize` → `impeccable adapt` → `impeccable clarify` → `impeccable polish`. Individual passes can be run separately or together; repeat `impeccable audit` after corrections. Backend security work needs its own implementation/tests, not a cosmetic design pass.

## Preserve these strengths

- Shared calorie-balance policy already distinguishes key energy concepts; avoid creating a second formula in redesigned cards.
- Mobile missing-day trends use recorded dates. Keep that behavior while adding nutrient-level coverage.
- Offline nutrition actions, pending feedback, retry behavior and account scoping already exist. Improve visibility instead of replacing the queue.
- Credentials use secure storage; web authentication clears query state on sign-out. Do not regress these while adding recovery views.
- Diary snapshots survive library deletion; atomic bulk operations intentionally restrict unsupported entry types.
- Native tab/date targets, food-search virtualization, cached images with bounded retries, web route lazy loading, skip navigation and active-state labels provide useful foundations.
- RLS, role-separated pools, permission middleware, outbound URL checks and safer Withings/Polar nonce flows are reusable security patterns.
- Current private media ingress adds protection beyond the generic application mount.

## Staged implementation recommendation

| Stage                                | Scope                                                                                            | Completion gate                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 — Establish evidence               | Q1 synthetic seed and signed-in smoke journeys; capture current baselines                        | Reproducible auth without personal credentials/data; both apps render the required matrix; existing behavior recorded                                        |
| 1 — Close trust gaps                 | S1, S3, S4; S2 before expanding access; broaden real RLS CI trigger                              | Callback negative tests + real RLS matrix pass; cookie matrix verified; advisory reachability/update record; private media isolation demonstrated            |
| 2 — Repair daily-use inconsistencies | U1, U3, U4, U5, U6                                                                               | Correct labels, accessible chart values, theme contrast, date selection and gesture alternatives; screenshots and logging journeys pass                      |
| 3 — Make reports fast and truthful   | U2, P1, P2, S5                                                                                   | Cross-platform coverage fixtures reconcile; independent report loading; bounded requests/queries; measured performance comparison; normalized private images |
| 4 — Add focused capabilities         | Sync/recovery center, web bulk parity, then dashboard presets                                    | Account-safe retries, no duplicate/lost history, supported bulk actions and faster measured core tasks                                                       |
| 5 — Review and release               | Repeat UI audit, relevant validate/tests/builds, visual review, correction, signed-device checks | No attributable validation failures; all unavailable checks explicitly listed; preserve entries during upgrade                                               |

The small U1/U3 corrections can ship alongside Stage 1 without waiting for all infrastructure. Avoid bundling dependency upgrades, report contract changes and navigation restructuring into one unreviewable commit. Document broader semantic tokens and replace legacy type suppressions only at touched boundaries; 1,725 suppression/explicit-any-disable occurrences across 107 inspected server route/model/service files indicate maintenance debt, not 1,725 established defects.

## Checks actually executed

| Check                            | Result                                                         | Limit                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused server security suite    | **6 files, 99 tests passed**                                   | Existing OAuth-state, safer-provider callbacks, upload-denylist, outbound URL and permission-gate tests; does not validate missing checks in S1 |
| Production dependency audit      | **Completed; exit 1 for advisories**                           | Exposure/reachability remains to be triaged                                                                                                     |
| Web mechanical design detector   | **5 warnings inspected; all dismissed**                        | Each border-accent warning was an animated loading spinner, not a decorated card                                                                |
| Bulk-button contrast calculation | **3.10:1 failing pair; 5.53:1 existing replacement token**     | Rendered interaction states still need checking                                                                                                 |
| Repository status                | Existing untracked asset archive and critique folder preserved | Only audit documentation/evidence added                                                                                                         |

Focused test command, from `XoTServer`:

```sh
node_modules/.bin/vitest run tests/oauthState.test.ts tests/withingsOauthCallback.test.ts tests/polarOauthCallback.test.ts tests/uploadsStaticMount.test.ts tests/outboundUrlPolicy.test.ts tests/integrationRoutesPermissionGating.test.ts
```

Machine-readable evidence: [audit evidence](./evidence/repository-audit-2026-09-26.json). Previous broad package validation was documented during the release work; it was not rerun or counted as a new audit pass.

**Unverified:** current authenticated browser/device screenshots, real VoiceOver and large-text behavior, current-build Watch/Health end-to-end regression, production response-time/load measurements, query plans against representative volumes, live OAuth exploitation, every dependency's input reachability, current runtime cookie configuration and a fresh restore drill. Prior owner tests on earlier builds are useful history, not a substitute for these current-revision gates.
