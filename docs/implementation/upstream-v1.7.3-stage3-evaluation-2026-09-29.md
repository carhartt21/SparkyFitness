# Upstream v1.7.3 — Stage 3 evaluation

Stage 3 is an evaluation branch based on `feat/upstream-v1.7.3-stage2` (`5e648d11a`). No optional upstream feature or proxy change is enabled here. Stage 2 supplies the interval formats, sequential plans, and workout-history snapshot on which some of these features depend. Product choices and physical-device behavior remain separate acceptance gates.

| Candidate | Upstream starting point | Current X on Track state | Decision and next verification |
| --- | --- | --- | --- |
| Guided workouts | `71f68ccbb`, `2c2ff9d83` | No guided narration mode. Stage 2 adds interval clocks and existing rest cues remain in place. | **Defer.** Review speech and auto-completion behavior for timed sets, pause/resume, audio mixing, accessibility captions, translations, and backgrounding. Test manual set completion and interval transitions on iPhone and Watch before enabling. Keep the mode opt-in. |
| Adaptive coaching | `655e62fd0`, `7341a0dfc` | Existing progression suggests weights; there is no new feedback domain or adaptive override. | **Defer.** Requires its own migration, RLS/acting-user review, user-facing explanation of suggestions, pain/discomfort language review, and checks that logged values remain distinct from suggested values. The upstream default-on policy needs an X on Track product decision; avoid silently changing progression. |
| Live Watch heart-rate telemetry | `18e10adb1`, `24e8a321e`, `5ad07294a`, `1331f7e25` and related follow-ups | X on Track has a different `useWatchCheckInBridge` and persisted operation-ID deduplication. Stage 2 does not replace either side of that protocol. | **Defer.** Do not cherry-pick the upstream `useWatchWorkoutBridge`: it would replace the existing exactly-once set path. Design an additive telemetry payload with account/server ownership, bounded encrypted buffering, acknowledgment/replay, and exercise attribution. Verify with paired hardware, including offline/reconnect, account switching, finish, and retry. |
| COROS | `2540a4c2d` and fixes through `6a4563117` | No COROS OAuth credentials, connection, or scheduler in this branch. | **Defer.** Review consent and token storage, quota handling, activity identity/deduplication, private web callback routing, and whether the provider is useful for this personal installation. Use a test account and a repeat sync before considering production configuration. |
| New dashboards | `87a72a1dd`, `eccd4bbab`, `9cfdb7565`, `ceccc9dbc`, `6668959cc` | X on Track already has an exercise reports dashboard and its own mobile/web visual system. Stage 2 adds WOD history filtering but does not import these layouts. | **Evaluate screen by screen.** Compare with `PRODUCT.md`, `DESIGN.md`, and real-data semantics. Test incomplete data, locale, light/dark themes, narrow widths, saved dashboard layouts, and chart period/units. Port only changes that improve task completion without reviving upstream branding or mockup numbers. |

## Food ranking: already integrated, retain the query-aware policy

The upstream `0cbca4fe8` commit is already an ancestor of this branch. Mobile and web use `rankFoodSearchCandidates` from `shared/src/foodSearch/relevance.ts`; identity-token coverage and preparation compatibility take precedence over provider, favorite, and presentation signals. Exact barcodes have their own path, and brand tokens participate in explicit product queries. A broad unconditional preference for unbranded BLS foods would weaken branded searches, so it should not be added. This review used the existing deterministic tests, not a live catalogue claim:

- Server `foodSearchRelevance` and `blsFoodService`: 14 passed.
- Web `topMatches` and `foodSearch`: 12 passed.
- Mobile `topMatches` and `foodSearchComparison`: 6 passed.

Before another ranking change, measure candidate retrieval and top-three rank separately for `tomate`, `tomate roh`, `reis gekocht`, `reis trocken`, and `tomate frito freshona` against the deployed catalogue. The tests cover policy; they do not establish live BLS availability.

## Proxy: separate routing review required

Upstream `918572600` makes nginx resolve the backend dynamically and changes `proxy_pass` to a variable; follow-up commits normalize resolver addresses. That is not a mechanical merge for X on Track. `docker/nginx.conf` also routes OAuth discovery under `/.well-known/`, `/mcp` streaming, `/health-data` rewriting, `/uploads`, and the frontend SPA. Private HTTPS and Tailscale Serve sit outside this template. Before adopting the resolver change, render the final nginx template in an isolated container, run `nginx -t`, and exercise each route through the same private ingress, including streaming and backend-container replacement. Confirm that the intended `/api/health` deny rule is actually effective: its regex currently competes with the `^~ /api/` prefix, which nginx prefers. Review and test that rule in the proxy-specific change rather than assuming the upstream resolver patch fixes it. Do not alter the live proxy as part of Stage 3.

## Release gates carried forward

Stage 2 package validation passed in server, mobile, and web. The full server suite passed 5,115 tests with 316 skipped; targeted mobile workout/Watch-store/Health-export tests passed. A disposable PostgreSQL cluster applied all migrations on a fresh install, and a second disposable cluster upgraded from the Stage 1 schema through all three new Stage 2 migrations with RLS reapplied. Existing user-data migration behavior was not exercised. Phone–Watch interval-format behavior and exactly-once reconnect remain **unverified on physical devices** for this branch; the earlier TestFlight checks apply to the previous release only. No optional feature is approved for deployment by this evaluation.
