# v41 inbox corrections

## Scope and reviewed plan

This batch starts from main `36166b9d6`, preserves the separate artwork expansion,
and includes the two reviewed v40 correction commits. It addresses all nine open
X on Track inbox reports, without merging, publishing or deploying.

1. Revalidate the existing Watch daily-goals implementation and the v40 fixes for
   check-in tag retention, supplement spacing, gauge alignment, compact summaries
   and German Watch intake labels. Keep account/day checks and permitted actions.
2. Add truthful confirmation to water additions, including the actual selected
   amount/name, pending offline state and failure state. Keep single-tap logging
   and the existing hydration outbox. Do not infer linked-drink water credit.
3. Expand the phone supplement editor using the existing nutrient catalog,
   fixed nutrient fields and custom definitions. Include fiber and all 27 native
   vitamins/minerals. Blank is unknown, not zero. Preserve stored units, unshown
   metadata, dose snapshots and medication/supplement classification. Review the
   actual Health export path rather than claiming the form alone provides export.
4. Resolve compatible imported activities against whole-activity goals on the
   same day. Require known sport and every configured duration/distance target;
   reserve explicitly assigned/linked records and use one record only once.
   Never count plan prefills, future records, unrelated sports or planned sets.
   Keep reads pure and never create Diary, calories or completion rows.
5. Run regression tests and package validation for affected consumers, then one
   batched German phone/Watch simulator review at ordinary/enlarged text sizes.
   Record physical-device limits and task-by-task evidence below.

## Cause established

- Water additions currently display errors but no success/pending confirmation.
- The phone supplement form offers 12 hard-coded fields; the web uses the wider
  canonical nutrient catalog. Existing supplement nutrition uses fixed fields
  and a custom-nutrient map, so no new table is needed.
- Activity completion filters evidence by plan assignment ID. An imported Apple
  Health run has no assignment ID and consequently remains an unresolved goal.

## Validation and remaining checks

All nine reports have a code response in this branch. The Watch Daily Goals
feature was already on main; its entry point and real native views were verified
rather than reimplemented. The v40 corrections were reused through cherry-picks,
with their original evidence retained as historical evidence. New changes are
covered separately below. This branch is not merged or deployed.

| Inbox issue                                        | Response and verification                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Watch daily-goals screen (`6hgMxpqfQGJ8xhR7`)      | Confirmed `ContentView` starts on Daily Goals. Real Watch source compiles; 19 native assertions cover permitted confirmation, source identity, stale-day/account rejection and pending state. Actual phone/Watch round-trip remains a device gate.                                                                                                                               |
| Supplement layout (`6hgV8JH4wGWXC387`)             | Neutral card borders, spaced settings actions and a 44-point menu beside dose details. Populated phone screens reviewed at ordinary/enlarged text.                                                                                                                                                                                                                               |
| Save custom check-in tags (`6hgVWxhHRVwpR8cf`)     | Immediate account/server-scoped option retention, independent of the current answer; deselect/reopen/reselect tested on all three German phone cases.                                                                                                                                                                                                                            |
| Gauge label position (`6hgVcCFcR822jp5f`)          | Labels use the measured square visual area; centering/column geometry asserted in the native summary review.                                                                                                                                                                                                                                                                     |
| Main card height (`6hgVcfm3W83ccpmf`)              | Compact matching summary columns and a smaller Daily Progress hero. Normal layout fits under the header; enlarged text stacks and scrolls.                                                                                                                                                                                                                                       |
| German Watch intake text (`6hgXMR7PC9qW9FQ7`)      | Short visible labels with full accessibility descriptions, reviewed for known/unknown/over-target states.                                                                                                                                                                                                                                                                        |
| Water-button feedback (`6hgcXHQ2hxq4R7Pf`)         | Immediate logging feedback, then an amount-specific themed confirmation or truthful locally-saved/sync-pending message. Errors remain explicit. Intentional repeated taps continue logging separate drinks. Native quick-action and offline/synced unit cases pass.                                                                                                              |
| Supplement nutrient coverage (`6hgcchFv3X234c5f`)  | Fiber and magnesium in the common set; More nutrients exposes all 27 native vitamin/mineral identities plus existing fat/nutrition fields. Canonical binding, actual units, decimal commas, unknown values and late-loading draft preservation tested. Confirmed snapshots now enter the existing Health writeback pipeline.                                                     |
| Automatic activity completion (`6hgf6fXGpfWr2gX7`) | Same-day unassigned, confirmed whole activities match known sport and every target. Walks, prefills, earlier/unrelated/future/ambiguous records cannot complete a run. Explicit decisions reserve records; one record resolves one task. Plan edits retain the original prescription and deleting evidence removes inferred completion. Pure projection tests confirm no writes. |

## Additional verified causes and safeguards

The nutrient editor alone was insufficient: native nutrition writeback previously
loaded food entries only. It now loads confirmed supplement snapshots before
replacing any native records. If snapshot/definition retrieval fails, previously
exported records are retained and the existing sync engine retries. Dose scaling
matches server aggregation. The actual intake timestamp is retained; missing
energy is not manufactured as zero. Skipped/snoozed, injection and native-imported
rows are excluded. Water stays on the hydration path, preventing double export.
Replay/deletion and actual-unit tests cover Apple Health and Health Connect.
Historical corrections outside the existing sync date window require its existing
range/re-sync workflow; no additional journal or scheduler was added.

Native catalog provisioning reuses the owner-scoped resolver with compatible
units and exact canonical identity. Loose aliases cannot establish an identity.
Its zero resolver input provisions definitions only: no observation, dose,
preference or goal is written. Existing custom values and hidden-view preferences
are retained. Non-native catalog provisioning keeps its existing policy. Web
cache refresh now includes identity binding/reactivation even with zero created
rows. API responses continue returning active definitions only.

The shared JSON nutrient schema mirrors already-stored caffeine, water and alcohol
fields, and the entry contract exposes the existing immutable nutrition snapshot.
There are no new database columns, migrations, dependencies or environment flags.
Updated clients and the server are required together for native catalog binding.

## Validation

- Frozen offline dependency installation succeeded without lockfile changes.
- Server, mobile and web `pnpm validate` wrappers pass, including type checks,
  lint, formatting, German overlay/copy audits, mobile locale generation, native
  locale/geometry/brand checks and unused-code checks.
- Mobile full suite: **545 suites / 7,699 tests passed**.
- Web full suite: **174 suites / 1,483 tests passed**.
- Server: **16 targeted suites / 229 tests passed**; final catalog/projection
  recheck: **53 tests passed**. Database integration/full backend suites were not
  run; unit fixtures are not live database verification.
- German phone dark/light at 390×844 and accessibility-extra-large at 430×932:
  render smoke and native interactions pass. The populated supplement layout was
  checked separately at ordinary/enlarged text. Numeric section counts avoid an
  inappropriate generic “items” noun; long headings can wrap within their column.
- Watch simulator: **19 assertions passed**, real source compilation and four
  German captures (goals, intake, unknown intake, over-target intake).
- Review-runtime guard tests, repository layout check and documentation build pass.

[Curated screenshots and results](evidence/v41-inbox-corrections-2026-10-03/results.json)
use isolated synthetic fixtures only. Owner screenshots, private nutrition or
search history, credentials, full noisy logs and generated build directories are
not committed. Successful OCR is a render smoke check, not visual approval; the
selected screenshots were inspected for layout and German text.

## Remaining acceptance and release steps

1. On matching updated phone/server builds, create a synthetic supplement intake
   with fiber and magnesium, sync with explicitly enabled write permissions,
   inspect actual Apple Health samples/timestamps, re-sync without duplicates,
   then correct/delete it. Also check separately denied nutrient permission and
   an offline intake replay. Android real Health Connect receipt is unverified.
2. Install/open the matching Watch companion, refresh phone context and confirm a
   permitted habit/meal. Check acknowledged counts and offline reconnection. An
   unpaired simulator cannot prove WCSession or complication delivery.
3. Check one real imported run against a configured same-day activity, then a walk,
   partial run and explicit skip. Projection fixtures establish logic but do not
   prove the currently deployed provider data or the owner's specific records.
4. Review/merge this branch and run the normal release/deployment workflow in a
   separately authorized cycle. Inbox tasks remain open for release/device
   acceptance; no production build, publication, goal/dose change or migration
   was performed by this batch.

Tooling follow-up: Impeccable setup flagged legacy product-context metadata and
web-only platform inference despite the native target. Native guidance was loaded
explicitly. Its suggested context refresh/update was not applied as an unrelated
side effect of this corrective batch.
