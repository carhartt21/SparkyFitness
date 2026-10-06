# Documentation map

The VitePress site serves user guides and developer contracts from `src/`. Dated implementation/review evidence lives outside the site in `implementation/`. Release procedures belong beside the affected package, such as `../XoTMobile/docs/testflight-release.md`.

## Current entry points

- User guides: [feature index](src/features/index.md), [settings](src/features/user-settings.md), [mobile setup](src/mobile-app/mobile-app.md).
- Training: [weekly plans](src/features/exercises/weekly-planning.md), [MCP workflow](src/features/exercises/mcp-training.md), [exercise tool contracts](src/developer/mcp/exercise.md).
- External reviews: [cloud setup and recaps](src/features/agent-recommendations.md), [versioned MCP review contract](src/developer/mcp/recommendations.md).
- Notifications: [setup/troubleshooting and MCP updates](src/features/settings/notifications.md), [tool payloads](src/developer/mcp/engagement.md), [delivery architecture](src/developer/engagement-delivery.md).
- Native presentation: [widgets, Watch and Live Activities](src/mobile-app/widgets-live-activities.md).
- Evidence and historical notes: [implementation index](implementation/README.md).

## Maintain the right document

Keep evergreen guides about supported behavior. Put version/build numbers, deployment outcomes, screenshots and unperformed device checks into dated evidence, not installation instructions. Preserve historical results as historical; an old branch's acceptance verdict is not current release acceptance.

Verify tool names/actions against the endpoint that publishes them. `/mcp` API keys, `/mcp/chatgpt` legacy OAuth and `/mcp/coaching` proposal-only protocol-2 OAuth have different surfaces. Retained `sparky_` tool names, environment variables, bundle IDs and the `/SparkyFitness/` documentation base path are compatibility identifiers, not permission to use the old display brand.

Update the navigation in `.vitepress/config.mts` and link new pages from the relevant feature guide. Avoid “coming soon” placeholders where code already implements the feature. Mark real limitations clearly rather than documenting an unmerged branch as shipped. Keep provider/user-entered names literal and private credentials or health records out of examples.

The docs header/hero image `src/public/logo.png` mirrors `XoTFrontend/public/images/brand/progression-x.png`; `src/public/x-on-track-icon.png` mirrors the app's `images/icons/icon-192x192.png`. When approved exports change, refresh these copies from the canonical pipeline instead of drawing another logo.

## Build and review

From the repository root, install the pinned workspace dependencies with `pnpm install --frozen-lockfile` (or filter to `xot-docs...` for docs-only work). From `docs/` run `pnpm run build`; VitePress checks internal dead links while rendering. Use `pnpm run preview` to inspect navigation, tables and code examples on desktop and narrow screens. Build output under `.vitepress/dist/` is not source and must not be committed.

## Historical implementation plans

- [Live workout and Watch roadmap](plans/live-strength-workout-watch-sync.md), with current implementation status separated from outstanding device gates.
