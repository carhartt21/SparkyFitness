# Implementation records

Dated records describe what was verified at that revision. They are evidence, not proof that a later release passes the same checks.

## Current runbooks and reviews

- [Feature merge strategy](feature-branch-merge-strategy-2026-09-30.md) and [combined integration evidence](feature-batch-integration-2026-09-30.md): branch order, blocker corrections and release/device gates.
- [TestFlight release](../../XoTMobile/docs/testflight-release.md): signing, local/cloud build and submission. Confirm the actual submission state independently of a successful archive.
- [Repository cleanup](repository-cleanup-2026-09-29.md): current package layout, compatibility boundaries and cleanup verification.
- [Serving sizes](serving-sizes-2026-09-29.md) and [German localization](german-localization-review-2026-09-29.md): latest food-entry and localization review.
- [BLS display language](bls-display-language-2026-09-30.md): provider request language, cache correction and regression results.
- [Optional upstream features](upstream-v1.7.3-stage3-evaluation-2026-09-29.md): evaluation only; optional features are not approved by this document.
- [Design specification](../../DESIGN.md), [product requirements](../../PRODUCT.md), and [current mark specification](../../x-on-track-design/implementation.md).

## Historical evidence

The early Dashboard iterations and pre-redesign web critique are in [archive/ui-2026-09-26](archive/ui-2026-09-26/). Their screenshots remain under `evidence/`; no new release should use an archived ship verdict as current acceptance. Other dated implementation records remain available for feature history and outstanding checks.
