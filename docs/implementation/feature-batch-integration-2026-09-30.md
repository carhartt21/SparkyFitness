# Feature branch integration — 30 September 2026

## Scope and disposition

The owner authorized another review and execution of the [seven-branch merge strategy](feature-branch-merge-strategy-2026-09-30.md). Integration starts from `main`/`origin/main` at `f80035495` in `integration/feature-batch-20260930`. The final functional revision is `824139c5a`; subsequent documentation commits do not change application behavior. Production deployment, mobile publication and real-record migration are outside this execution.

| Order | Branch                                           | Integrated tip |
| ----- | ------------------------------------------------ | -------------- |
| 1     | `chore/xot-repository-cleanup-20260929`          | `0e5f94124`    |
| 2     | `fix/bls-display-language-20260930`              | `10286a29a`    |
| 3     | `feat/notification-mobility-corrective-20260930` | `1b4320cfc`    |
| 4     | `chore/web-favicon`                              | `8f24bb95f`    |
| 5     | `feat/serving-sizes-ui`                          | `ec5a85a7c`    |
| 6     | `feat/watch-progress-x`                          | `75e0e5eeb`    |
| 7     | `feat/watch-food-layout`                         | `f93d8918e`    |

Each branch has its own merge commit. Source branches were not rewritten. New-file conflicts were resolved into `XoTMobile`/`XoTFrontend`; old package directories were not recreated. Both sets of reviewed German keys were retained in catalog conflicts, then catalogs were regenerated and checked. Main's intake-gauge fix remains in the combined tree. Unrelated dirty FDDB worktrees and the pre-existing `.impeccable/critique/` directory were excluded and preserved.

## Corrections made during execution

- Workspace CI jobs use `pnpm -w run repository:check`, including fresh-install and upgrade jobs. The root command was executed from package directories.
- Amount drafts propagate to the food submission path even when blank, zero or malformed. Add refuses invalid quantities before and after blur; valid decimal-comma input still logs. No previous valid amount is silently reused. Disabled spinner accessibility actions cannot mutate the amount.
- Food hero transforms respect reduced motion. Macro category names remain above amounts/units, with the goal percentage last. Quick-add and nutrition section headings no longer compete horizontally with long German subtitles.
- The visual matrix caught quantity clipping and colliding labels at enlarged text. Amount and unit controls now stack and grow with font scale; macros use two columns at enlarged text. Normal text retains the compact layout. The ordinary food CTA is **Hinzufügen / Add**, with the full action in its accessibility label; meal, photo and picker modes retain their appropriate action labels.
- Progress geometry validation uses the existing `tsx` runner, verified under actual Node 20.20.2, rather than relying on Node's native TypeScript stripping. Canonical geometry is unchanged.
- Watch food and Progress X have separate English/German native resources, reviewed German overlays and interpolation-aware lookup. Native locale validation covers both targets, missing keys and placeholder parity. Watch food transitions respect reduced motion, and portion/meal targets have 44-point minimum heights.
- Complication setup guidance now includes Progress X and its supported families. Bundle IDs, schemes, authentication storage and `group.com.cg.phi` remain unchanged.

The [notification/mobility correction record](notification-mobility-review-corrections-2026-09-30.md) details all twelve original findings. This integration repeats the database and package checks rather than relying only on earlier branch evidence.

## Validation on the combined tree

Pinned pnpm 10.33.4 was used. No dependency or lockfile update was needed.

| Check                                                | Result                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Frozen dependency install                            | Pass                                                                                         |
| Server, mobile and web `validate` wrappers           | All pass                                                                                     |
| Full server Vitest suite                             | 5,213 passed; 334 skipped; 437 passing and 10 skipped suites                                 |
| Full mobile Jest suite                               | 7,444 passed; all 514 suites pass                                                            |
| Full web Jest suite                                  | 1,427 passed; all 162 suites pass                                                            |
| CI policy tests                                      | 11 passed                                                                                    |
| PostgreSQL notification/mobility integration         | 18 passed against an isolated synthetic database                                             |
| Fresh database startup                               | Pass through the normal runner; 254 migrations recorded                                      |
| Upgrade from main's migration set                    | Pass through the normal runner on a separate disposable database                             |
| Web production bundle                                | Pass; HTML favicon URLs resolve to the generated ICO, SVG and 32/180 px PNG files in `dist`  |
| Progress geometry under Node 20.20.2                 | Pass                                                                                         |
| Clean Expo iOS prebuild and Pod install              | Pass                                                                                         |
| Watch app + Watch widget linked simulator build      | Pass, SDK 26.5; English/German resources present in both bundles                             |
| Full iOS simulator build including companion targets | Pass                                                                                         |
| Production iOS JS export                             | Pass; no `ui-review.invalid`, `review-created-` or `XOT_UI_REVIEW` markers in the iOS bundle |
| Repository layout and whitespace checks              | Pass                                                                                         |

The four new migration names are `20260930100000_mobility_planning.sql`, `20260930101000_engagement_v2.sql`, `20260930120000_mobility_review_corrections.sql` and `20260930121000_mobility_snapshot_indexes.sql`. Upgrade tests cover pending reminder preservation, indexed relationship/date repair, explicit deletion versus history retention, read-only snapshots, owner isolation, retry receipts and legacy-device settings. The schema backup is untouched; CI owns regeneration.

One initial full server run returned 401 instead of 400 in the invalid-display-name route test. The isolated 29-test route suite and a subsequent full run passed without changing authentication code or the expectation. Its transient cause remains undetermined; it is not evidence of a repaired authentication defect.

Native verification uses simulator builds, not a signed device archive. Disabling all signing produced a startup abort in HealthKit's `HKSource.defaultSource` on the fresh simulator binary; an earlier same-day report has the same native stack. Rebuilding with `CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=-` applied Xcode simulator signing and resolved startup; the final matrix uses that fresh app. Hand-signing only the app was insufficient. No production credential or entitlement source was changed. This is distinct from a physical distribution-signing check.

## Simulator review

The review harness uses disposable 390 × 844 and 430 × 932 simulators and synthetic fixtures. `--food-details-review` is a read-only layout mode; the default interaction mode separately exercises save/edit/delete and keyboard notes. The new layout mode is documented in [the harness README](../../XoTMobile/review/README.md).

Final captures and runtime results are recorded in [the evidence directory](evidence/feature-batch-integration-2026-09-30/). All four final render and native layout checks pass; visual review confirms readable quantities/units, macro hierarchy and localized section headings. Dark/light 390-point and English/enlarged German 430-point cases are covered. The final default interaction run also passes in German 390-point and English 430-point cases: search, 200 g selection, keyboard-safe long note/save, Diary return, edit to 100 g, delete and hydration/exercise Details. Synthetic mutation acknowledgements retain the complete note and reconcile 600 → 900 → 750 → 600 kcal. Earlier layout assertions passed but visual inspection rejected the enlarged-text clipping; those captures are before evidence, not acceptance.

## Remaining release/device checks

- Physical iPhone/Watch in-place upgrade, custom food amounts and servings, offline enqueue/reconnect exactly once, complication layout at small wrist/enlarged text, and reduced-motion transitions.
- Notification delivery while closed, local/server handoff, permission denial, lock-screen and Dynamic Island interactions on the signed release.
- Live BLS language/source availability and actual provider lookup; this batch verifies locale forwarding/cache behavior through tests, not a production catalogue repair.
- Browser favicon appearance across browser/OS masks; built paths and exported sizes are verified.
- GitHub checks/review threads require an authenticated `gh` session; local validation does not establish remote CI status.

Before any separately authorized rollout, retain the current deployment image/release and database backup references. Apply compatible API/web before releasing the new mobile client. Lookup-repair constraints intentionally abort on conflicting existing records; investigate instead of deleting records or bypassing constraints. Application rollback does not reverse database migrations.
