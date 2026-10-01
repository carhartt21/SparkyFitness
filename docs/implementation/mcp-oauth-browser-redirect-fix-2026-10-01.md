# MCP OAuth browser redirect correction — 2026-10-01

## Report and cause

The desktop custom MCP connection discovered `/mcp/chatgpt`, but the browser showed “Authorization could not be completed.” Production OAuth discovery is enabled and the running frontend/server source is `53c7092ef642154e2254d16ede70d2ff6ed02a6a`.

Both web login continuation and consent read `redirect_uri` from the response. Better Auth 1.7.4 returns `{ redirect: true, url }` for these browser requests. `redirect_uri` belongs to the authorization request, not the current JSON response. Consequently, the web app could reject a successful response and fail to return control to the desktop client. An existing browser session can skip the visible login prompt.

## Correction

- Share typed response parsing between login continuation and consent, using the current `url` field and retaining compatibility with older `redirect_uri` responses.
- Request JSON explicitly for both OAuth POSTs, preserve signed query/state values, and display provider error descriptions on unsuccessful responses.
- Retain the same client registration, consent, scope enforcement and revocation behavior. No server, database, mobile, or permission changes are needed.
- Document the desktop form's post-save authentication flow and its separate API-key option.

## Verification

- Twelve frontend regression cases cover current login/approve/decline redirects, legacy response compatibility, malformed data, provider errors and non-JSON proxy responses.
- An actual Better Auth 1.7.4 flow using a disposable in-memory identity/client issued a signed login URL, continued to consent, and issued an authorization code with the original state. All three responses contained `redirect` and `url`. No production account or token was used.
- Production metadata was checked through the authorized SSH deployment access. An earlier public Python request was denied by Cloudflare error 1010; this is a separate ingress observation, not evidence that the user's browser failed there.

- Frontend `pnpm run build` passed, including typecheck, ESLint, formatting, Knip and German overlay/copy checks. The full frontend suite passed: **164 suites / 1,446 tests**. The documentation build passed.

Production rollout evidence will be recorded after completion. The owner's live desktop OAuth round trip remains a manual acceptance check.
