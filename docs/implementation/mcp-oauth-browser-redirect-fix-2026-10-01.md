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

## Production rollout

The frontend correction is deployed from commit `14e993582adc0c52735ff57e5450cac6ac81e28b` as `x-on-track-frontend:14e993582` (image ID `sha256:118d6db8613b196de55bca2f14af5eb4e6010838fc7acc3d12680ba71cf7bdad`). The backend retains its `53c7092ef` image and no database changes were made. This rollout does not include the separate pending coaching workflow.

The pinned Git source archive was SHA-256 verified before building on the private linux/amd64 host. A fresh encrypted matched backup, `sparkyfitness-20261001T105412Z.cms`, was checked on the server and in the protected off-host workstation backup store. Its SHA-256 is `8ce7c11a24558ba450f456c91249a52a2e0f41e74005c41647c71fd07dad55d4`.

The release directory `/opt/sparkyfitness/releases/mcp-oauth-20261001-14e993582` retains the source archive, Docker build log, previous Compose file and previous release lock. The former frontend image remains available for rollback. Private deployment configuration and release records were synchronized after the switch.

Verified through authorized server access after rollout:

- Frontend and backend containers are healthy; the backend image ID is unchanged.
- Served login HTML and the `Auth`, `McpConsent` and `useMcpAuthorization` assets match the new image byte for byte.
- API health and protected-resource metadata return 200; anonymous OAuth MCP returns 401 with the discovery challenge.

The owner's live desktop OAuth round trip remains a manual acceptance check. Close the old authorization window, refresh the application and start a new authorization request; do not reuse a stale signed URL. Public client access remains subject to the site's Cloudflare rules.
