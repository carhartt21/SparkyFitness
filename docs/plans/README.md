# Implementation plans

These documents describe proposed work, not shipped capabilities. Each plan records its inspected source baseline, implementation stages, acceptance evidence, and activation boundaries.

## Personal AI

[Personal-use AI: MCP-first implementation roadmap](personal-ai-mcp-first-roadmap.md)

Start with a credential-bound read-only external-assistant pilot, add evidence-backed review tools and explicit personal context, then allow selected reviewed changes and native publication only when useful. Immediate capture and phone/Watch workout editing remain native and local-first.

## Live strength workouts

[Bidirectional iPhone and Apple Watch workout plan](https://github.com/carhartt21/SparkyFitness/blob/7352a9d5145cd2effe2c6d062008db5c5dd24ebb/docs/plans/live-strength-workout-watch-sync.md) — proposed separately in [PR #1](https://github.com/carhartt21/SparkyFitness/pull/1).

That plan is linked at its documented commit because it is not present on this branch's mainline baseline. Its implementation is a dependency for future assistant-driven active-workout edits, not for read-only historical reviews. This roadmap does not merge or modify that pull request.

Planning documents live outside `docs/src/` and are not published as current product features by the documentation site.
