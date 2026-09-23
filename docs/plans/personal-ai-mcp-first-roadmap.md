# Personal-use AI: MCP-first implementation roadmap

**Status:** Planned; documentation only. No endpoint, permission, model connection, automation, or application feature is enabled by this document.  
**Recorded:** 2026-09-23.  
**Target repository:** `carhartt21/SparkyFitness`.  
**Inspected baseline:** `3c84e8007fb4f2541c58238ec71a2dcbb7d458a4`.  
**Scope:** A single owner's personal, non-commercial use over an indicative 3–6-month implementation horizon.  
**Product context:** PersonalBest is the owner-facing direction previously called HealthIntel; SparkyFitness remains the application/backend foundation. Follow the actual implementation branch's naming and preserve persistent identifiers. This plan is not another rebranding task.

## 1. Decision

Use an external MCP-connected assistant for substantial reviews, questions, and planning first. Keep immediate food, hydration, supplement, and workout capture in the application, widgets, notifications, and Apple Watch. Bring an AI workflow into the application only after repeated use shows that the native integration removes meaningful friction.

The first milestone is not a new chatbot:

> Retrieve bounded, permitted records; answer a useful personal question with traceable evidence; propose changes without silently applying them.

Personal use reduces the need for broad onboarding, many model providers, billing, multi-person personalization, and a general AI product platform. It does not reduce the need for accurate records, permission enforcement, privacy, recovery, or duplicate-safe execution.

SparkyFitness is the primary product and data system. Preserve useful HealthIntel specifications and analytical concepts, but do not reinstate its runtime as an obligatory parallel backend. Do not duplicate existing in-app photo interpretation or the existing chat interface.

### Where each interaction belongs initially

| Interaction | Initial location | Boundary |
| --- | --- | --- |
| Record weights, repetitions, and set edits | Phone and Watch | Direct, deterministic, local-first; no model round trip required. |
| Capture meal photos, log drinks, confirm actual supplement intake | App, widgets, and notification actions | Preserve original timestamps and durable operation identity. |
| Interpret a captured meal | Existing in-app AI flow, improved incrementally | Enrich the same saved entry; AI is optional and failure cannot lose the capture. |
| Review training or nutrition history | External assistant through restricted MCP | Read-only first; numbers come from bounded evidence tools. |
| Discuss a shorter routine or a meal-template change | External assistant | Draft/proposal first, with explicit review before execution. |
| Show a useful weekly finding | Later, small in-app result card | Requires a publication contract; external chat text does not automatically become app state. |
| Adapt reminder preferences | Later, reviewed suggestion | Deterministic scheduling and owner-configured intake plans remain authoritative. |

## 2. Verified starting points and important gaps

The following observations refer to the inspected source, not to the production deployment, an installed mobile build, or uncommitted work. Re-audit the actual implementation branch before coding.

| Existing component | Source evidence | Consequence |
| --- | --- | --- |
| In-process MCP endpoint using Streamable HTTP, authenticated actor scoping, and `core`/`full` profiles | [MCP route][src-mcp-route] | Reuse the transport. Profile size is not a read-only authorization boundary. |
| MCP adapter republishes the chat tool registry and wraps text results | [MCP adapter][src-mcp-adapter] | Add explicit restricted exposure/execution and structured evidence without rewriting every domain tool. |
| Registry combines food, exercise, goals, reports, coaching, medications, and other categories | [Tool registry][src-tool-registry] | Categories can contain both reads and writes; allowlisting only a category is insufficient. |
| Exercise tools can inspect, log, create, update, and delete records/presets | [Exercise tools][src-exercise-tools] | Review-style workflows should expose only known read actions. Existing model-supplied `confirmed` arguments are not trusted proof of human approval. |
| Workout-plan tool lists, inspects, and deletes plans; day-by-day authoring is directed to the UI | [Workout-plan tools][src-workout-plans] | Do not promise full plan authoring through existing MCP. Start with a preview or a copied preset when that is actually supported. |
| Statistics expose exercise comparisons, lifting volume, records, and estimated one-repetition maxima | [Exercise statistics][src-exercise-stats] | Reuse calculations, but verify completion filters, comparability, and coverage before summarizing. |
| Coach tools provide summaries, trends, threshold-based pattern detection, and fallback-based targets | [Coach tools][src-coach] | Audit the mathematics and return evidence/limitations; do not present a heuristic coaching function as validated personal inference. |
| Food photos already have stored/provider candidate matching | [Food-photo matching][src-photo-match] | Improve personal aliases, portions, and whole-meal reuse rather than rebuild existing matching. |
| Medication tools include schedule and intake mutations | [Medication tools][src-medication] | Explicitly exclude dose, schedule, injection, and medication mutations from the initial external-assistant surface. |
| Provider dispatch supports structured/image requests and multiple endpoint families | [Provider dispatch][src-provider] | Keep the existing provider boundary. An external assistant's model configuration is separate from in-app image inference. |
| A configured progression engine already exists | [Progression engine][src-progression] | Let code determine configured numerical progression; the assistant explains or proposes a reviewed change. |

Upstream [MCP setup documentation][src-mcp-doc] describes bearer-key access and the `/mcp` endpoint. Actual credential scopes, client compatibility, and transport reachability must be proven in Stage 0/1. Do not create an enabled AI provider with dummy credentials merely to obtain a tool list.

The separate [live strength-workout synchronization plan][watch-plan] is proposed in [PR #1][watch-pr]. It was still open when this roadmap was recorded. Its implementation is not assumed complete.

## 3. Scope and non-goals

### In scope

- One chosen external MCP-capable assistant client, with a verified connection recipe.
- A server-enforced read-only profile with bounded data access.
- Evidence-backed review tools and reusable personal analysis playbooks.
- Explicit, editable preferences and approved personal aliases.
- A small proposal/review/apply flow for selected low-risk changes.
- A structured publication path for useful findings that earn an in-app surface.
- A regression set, privacy controls, and practical task-level evaluation.

### Not in scope

- Replacing the existing app chat with a new general chatbot.
- A new health database, synchronization backend, or model-training platform.
- Commercial hosting, billing, multi-customer access, or public assistant distribution.
- Autonomous medication/supplement doses or schedules, calorie/fluid prescriptions, injury prediction, or diagnostic claims.
- Arbitrary SQL, shell access, administrative MCP tools, bulk exports, or unbounded retrieval.
- AI in the critical path of live set entry, local food capture, or reminder delivery.
- Full Watch voice control before reliable bidirectional session operations exist.
- Automatically migrating historical HealthIntel data or copying private records into Git.

## 4. Architecture and trust boundaries

```text
Phone / Watch / widgets / notification actions
                  |
          Existing durable domain actions
                  |
      Existing synchronization and server records
                  |
      Bounded analytical services + evidence envelopes
                  |
    Credential-bound read-only MCP surface
                  |
        Chosen external assistant
          |                 |
     Explanation       Optional proposal
                            |
                 Trusted owner review surface
                            |
            Validated, revision-bound execution
                            |
                 Existing domain services

Selected useful result
        -> explicit publication -> private finding store -> optional app card
```

The production server may not know about unsynchronized device records. Every review must describe its dataset/as-of boundary. A server-side summary must not claim to include pending Watch or phone actions that have not arrived. Prefer a bounded sync/coverage indicator where available; report unknown completeness otherwise.

Keep authentication, validation, calculations, and execution in trusted application code. The assistant receives the minimum necessary context and produces explanations or proposals. Retrieved names, recipe text, notes, and external descriptions are data, not executable instructions.

Use the existing route → service → repository organization and shared schemas. Introduce no generic agent orchestration framework without a demonstrated need. A thin policy adapter is acceptable; a second backend is not the default.

## 5. Delivery sequence and stage gates

All stages below start **not implemented** in this roadmap. Complete a small vertical slice at each stage before broadening the tool surface.

| Stage | Outcome | Depends on | Initial gate |
| --- | --- | --- | --- |
| 0 | Deployed-version, client, permission, and data-flow inventory | None | Exact connection and permission gaps documented; no real-data egress yet. |
| 1 | Enforced read-only MCP pilot | 0 | Reads work and all attempted mutations fail through every exposed path. |
| 2 | Trustworthy analytical evidence | 1 | Fixture-derived facts, source references, missingness, and limits validate. |
| 3 | Useful external review workflows | Minimum slice of 2 | Repeatable manual reviews pass a task-based evaluation. |
| 4 | Explicit personal context and better capture suggestions | 2–3 | Approved preferences improve suggestions without corrupting history. |
| 5 | Controlled low-risk changes | 1–3 | Preview/approve/apply is revision-safe and duplicate-safe; read-only access remains available. |
| 6 | Selective native integration and result publication | Proven workflow from 3–5 | Published findings are private, traceable, stale-aware, and removable. |
| 7 | Optional scheduling and bounded personal insights | 3/6 plus explicit opt-in | Automatic runs are limited, observable, and safe to disable; exploratory claims remain qualified. |

Indicative allocation: Stages 0–3 are the main first-three-month scope; Stages 4–6 are selected additions during months 3–6; Stage 7 is conditional. This is scope prioritization, not a completion-time guarantee. Dependable local capture and phone/Watch synchronization may take priority without blocking read-only reviews of existing server records.

### Stage 0 — Audit the deployed path and choose one client

**Work**

- Record fork commit, deployed server/image version, relevant app version, API/MCP protocol behavior, and unresolved local work. Do not equate repository `main` with production.
- Inspect root/package instructions, MCP route/adapter/registry, authentication middleware, API-key implementation, proxy configuration, and relevant tests.
- Inventory tools at tool **and action** level: reads, mutations, implicit actions, administrator functions, exports, and secondary egress to providers.
- Choose one client with verified support for the deployed transport/authentication. Prefer an existing compatible client; use a pinned minimal local bridge only if required. Do not expand this into a universal client compatibility project.
- Use a dedicated non-admin credential or constrained identity for the same owner's data. A newly created empty account is not a substitute for a scoped credential on the actual dataset.
- Verify HTTPS, client origin/transport behavior where applicable, timeouts, key revocation, and proxy routing in an isolated test context.
- Document whether inference is external/cloud or local. Obtain explicit approval before real health records, images, notes, or precise timestamps leave the owner's environment. A desktop UI connected to a cloud model is still external processing.
- Use placeholders such as `${SPARKY_MCP_URL}` and `${SPARKY_MCP_TOKEN}` in documentation, not real credentials, host configuration dumps, or personal health records.

**Deliverables:** Connection runbook, read/write inventory, trust-boundary diagram, sanitized configuration, and a test-fixture dataset.

**Gate:** A synthetic initialize/list/read sequence succeeds in the selected client; actual deployment status and missing permission controls are explicit. No connection is called read-only just because the instructions say so.

### Stage 1 — Enforce a narrow read-only surface

**Work**

- Prefer a small policy extension around existing MCP registration/dispatch, bound to the authenticated credential and owner. Do not let a request select its own stronger access profile.
- Expose explicit known read actions; split/wrap multiplexed `manage_*` tools where necessary. Validate allowed action discriminants **before** handlers infer defaults or mutate.
- Filter discovery and enforce invocation independently. A hidden tool must still fail when called by its known name. Reject all mutation variants, null/alias normalization tricks, dynamic tool escalation, and administrator/dev tools.
- A `readOnlyHint`, a smaller `core` profile, or a client approval checkbox is not the authorization boundary. Follow the [MCP tool security requirements][mcp-tools].
- Verify that the client-visible credential cannot bypass the restriction through normal REST routes or another MCP endpoint. If the current key has broad rights, add a minimal credential-bound policy across those entry points; alternatively use a narrowly scoped gateway credential while keeping any broader backend key exclusively inside the trusted service. Do not expose the broad key to the assistant client.
- Keep token audiences/uses separate and follow the [authorization][mcp-auth] and [security guidance][mcp-security]; do not implement blind token passthrough.
- Preserve existing owner scoping and RLS. Test with two synthetic owners even though production is single-user. Never enable developer tools as a shortcut to data access.
- Bound dates, result size, pagination, execution time, and request rate. Do not accept arbitrary URLs, SQL, local filesystem paths, or unrestricted export requests.
- Deny unknown/new upstream tools by default after upgrades. Include policy revision/credential context in any caches and prove revocation is not masked by cached registry instances.
- Keep raw notes/photos, credentials, and sensitive configuration outside the initial read set. Enable only the specific data domains needed for the pilot.

**Deliverables:** Restricted policy/profile, validated schemas, enforced credential boundary, negative tests, revocation/disable procedure.

**Gate:** Useful reads succeed; create/update/delete/schedule actions, guessed hidden tools, direct API bypass, cross-owner access, and revoked credentials fail with zero domain-record changes. Document any narrowly scoped internal audit/cache writes so “read-only” is not misrepresented as literally no database activity.

### Stage 2 — Add evidence contracts and repair analytical ambiguity

**Work**

Start with the two review tasks that provide the most value: comparable strength history and nutrition logging completeness. Reuse existing calculation/repository services and add only missing bounded projections.

Proposed interfaces below are capabilities to implement or map, **not claims about existing endpoint names**:

| Capability | Required output |
| --- | --- |
| Review data coverage | Requested period; observed and missing dates; source/as-of boundary; captured versus nutritionally reviewed days where known. |
| Comparable exercise history | Stable exercise/equipment identity, actual completed sets, canonical units, session references, excluded variants, and previous-period comparison. |
| Nutrition review | Logged totals, partial entries, unknown nutrients, denominator used for averages, and food/supplement contribution rules. |
| Routine review | Planned supplement occurrences versus actual/skip/unresolved reports; water logs and optional configured targets; self-reported movement versus sensor evidence. |
| Focused trend comparison | Explicit alignment/window, inclusion criteria, sample counts, raw/derived distinction, and limitations; no unsupported causal conclusion. |

Use a versioned evidence envelope containing:

```text
schemaVersion, evidenceId, generatedAt
period { startDay, endDay, timezone }
dataBoundary { asOf, sourceRevisionOrDigest, pendingDeviceCoverage }
coverage { observed, expectedIfDefined, partial, unknown, exclusions }
facts[] { factId, value, unit, calculationVersion, recordRefs }
limitations[], suggestedFollowUp?, pagination?
```

- Validate numbers/units in code; do not ask the model to reconstruct totals from prose. Return structured MCP content with a compatibility text representation where supported. Structured tool output is distinct from a model's schema-constrained generation [MCP tools][mcp-tools].
- Missing nutrition and partial-day totals remain explicitly incomplete. “Logged day” is not proof that all food was recorded. Known zero, no rows, and unavailable data remain distinguishable.
- Compute averages with explicit denominators; do not silently divide by logged days while labelling an all-calendar-day average.
- Separate planned sets and suggested placeholders from completed actual sets. Preserve equipment/variant identity, kg/lb conversion, and revisions. Do not combine different machines into one strength trend without explicit mapping.
- Separate supplement schedules from taken/skip records. Avoid adding supplement nutrients twice. Missing intake confirmation is not proof of a missed dose.
- Preserve volume/mass distinction; do not equate ml with g. Preserve measured, label-derived, provider-derived, and AI-estimated nutrient provenance. Missing imported micronutrients must not be promoted to measured zero.
- Audit existing coach defaults and pattern thresholds before allowing their outputs into trusted summaries. Disable misleading recommendations in this pilot rather than rewriting the entire analytical suite first.
- Reuse the configured progression engine for numerical suggestions. Preserve its assumptions and label estimates appropriately.
- Provide authenticated record/detail links or opaque references that the app can resolve. Never include access tokens in links. Return stable evidence identities and data revisions so later changes can be recognized.
- Initial server-only review must state that unsynchronized device data may be missing. Do not demand an entire new offline architecture solely to enable descriptive reviews.

**Deliverables:** At least two end-to-end review projections, output schemas, calculation fixtures, and evidence-linked examples.

**Gate:** Every displayed numeric fact matches deterministic fixture expectations. Unknown/incomplete cases return limitations or abstention, not fabricated totals or a fallback personal prescription.

### Stage 3 — Validate external-assistant workflows manually

**Work**

Create reusable, versioned playbooks in repository documentation; keep their real executions and health results in private storage. Run with synthetic records first, then with owner-approved bounded real data in the chosen client.

Start with these workflows:

1. Four-week comparable strength-training review.
2. Weekly nutrition capture/completeness review.
3. Configured routine review across supplements, hydration, and movement, with observed versus unknown status.
4. A draft-only shorter version of a saved workout, constrained to known exercises/equipment and the owner's stated time budget.
5. A focused personal question only when its required data and analytical checks exist.

Each response should provide a few useful findings, supporting evidence IDs/record references, explicit limitations, and at most one primary next action. Do not require every answer to be a long report.

Use a small evaluation set covering English/German names, decimal quantities, repeated exercise names, different equipment, partial days, conflicting records, DST, and injected instructions inside names/notes. External content cannot authorize a tool call or a new disclosure.

Record task completion, correction count, response latency, usefulness feedback, cost when available, and unsupported-claim failures. If the client does not expose token/cost data, record unavailable rather than inventing a price. Keep a model/client version record; do not assert that different models produce identical prose.

Do not add scheduled jobs at this stage. A useful manual weekly review is a successful milestone in its own right.

**Deliverables:** Playbook pack, synthetic examples, private evaluation procedure, and a short keep/change/defer decision for each workflow.

**Gate:** The owner finds at least two workflows useful over repeated use; all evaluation-set numeric claims are traceable and no forbidden writes occur. This is a pilot gate, not a statistical guarantee of model reliability.

### Stage 4 — Make personal context explicit and improve capture incrementally

**Work**

- Store approved aliases, preferred food records, named portions, recurring meal templates, equipment/exercise mappings, display preferences, and explanation style in a small owner-scoped structure.
- Record provenance, approval, version, and optional expiry. Support inspection, correction, export, and deletion. A conversation does not silently become a permanent instruction.
- Separate a suggested preference from an approved rule. One food correction must not globally change a product or all future meals.
- Make the context readable through the restricted surface; stage proposals for edits without granting general preference writes.
- Retain existing in-app photo analysis and item matching. Add high-value improvements such as whole-meal reuse, approved portions, and a focused clarification instead of repeated broad questioning.
- Recognizing a saved recipe does not establish the amount eaten. Keep food identity, portion uncertainty, and measurement provenance distinct.
- Bind an enrichment suggestion to the existing entry ID/revision. Never overwrite a newer manual correction or replace the original capture timestamp. AI failure leaves the captured meal usable.
- Reuse existing structured storage before adding a vector database or fine-tuning pipeline. Evaluate retrieval/rules first; introduce more infrastructure only for a measured gap.

**Deliverables:** Minimal preference schema/UI or existing-setting extension, explicit memory controls, and one measured improvement to a recurring capture task.

**Gate:** Accepted context lowers correction effort in test cases; revoking an alias/portion stops its use; no historical nutrition changes retroactively and no private cross-owner context leaks.

### Stage 5 — Enable small, reviewed changes without giving away control

Keep read-only mode available permanently. Implement writes as a separate capability and credential/policy grant, not a hidden expansion of the original pilot.

**Initial permitted changes, only after approval:** Create a copied/inactive workout preset, create a reusable meal-template draft from existing foods, or save an approved alias/portion mapping. Changes to discretionary reminder preferences can follow after the engagement coordinator supports validated patches.

**Excluded initially:** Active-workout edits, deletes/bulk rewrites, raw health measurements, HealthKit writeback, supplement/medication amounts or schedules, injections, calorie/fluid prescriptions, and automatic nutrient-log creation from inferred behavior.

Proposed lifecycle:

```text
read evidence -> propose bounded patch -> preview concrete differences
-> owner approves through trusted UI/control -> validate again -> apply once
-> return receipt -> refresh normal clients
```

**Work**

- Create an owner-scoped proposal with a schema version, exact normalized patch, target identities, source revisions, explanation/evidence refs, expiry, and content digest. Proposal creation can persist metadata but cannot change target health records.
- Use the existing authenticated web/app UI, or another explicit trusted owner control, to review and approve. Do not build a full new in-app chat merely for approval.
- Bind approval to the exact proposal digest, owner/scope, base revision, expiry, and one-use identity. The model cannot self-authorize by submitting `confirmed: true`, a copied “yes,” or an approval claim in tool output.
- Keep an unapproved mutation unreachable even through the ordinary API using the assistant credential. Test this boundary independently of the visible tool list.
- Re-read and compare target revisions at execution; reject stale proposals with a fresh diff rather than overwriting concurrent phone/Watch/web edits.
- Apply through existing domain services, with transaction/idempotency support and cache invalidation. Concurrent apply/retry after response loss returns the same result.
- Provide a private receipt: operation ID, changed entities, prior/new revision, and safe undo/compensating path. Undo is itself reviewed and must not destroy later changes.
- Do not mutate a live workout through the generic preset tool. Future active-session commands require the stable operation/identity protocol in the [Watch synchronization plan][watch-plan].

**Deliverables:** Proposal contract, minimal approval UI, one narrowly scoped executor, and replay/conflict/authorization tests.

**Gate:** Unapproved, expired, modified, wrong-owner, and stale proposals fail. A valid approval applies exactly once, while read-only credentials still cannot write. Missing native synchronization support cannot be bypassed with a server-side whole-session replacement.

### Stage 6 — Publish useful findings and integrate only proven workflows

An answer in an external conversation is not automatically an application insight, widget payload, or historical record.

**Work**

- Start with an owner-approved manual publication of a useful review. Add a bounded private finding store through normal application services, not a repository file or a public share link.
- Define a finding contract with ID/version, source evidence IDs and fact references, analysis window, data revision/as-of, model/client metadata where available, limitations, generated/published times, expiry/stale state, and owner-visible approval status.
- Validate all numeric facts against the evidence payload. Label model-written narrative as generated interpretation; syntactic validation cannot prove every semantic assertion.
- Sanitize text/links and prohibit arbitrary HTML, executable actions, secrets, and unsigned links carrying credentials. Use authenticated in-app detail routes.
- Implement dismiss/delete and re-evaluate/stale behavior after evidence corrections or expiry. Do not keep outdated recommendations presented as current facts.
- Add at most one useful dashboard surface initially: a brief weekly progress card with “Why this?” evidence detail. A lock-screen widget should not expose personal findings by default.
- Keep manual external reviews fully useful even when nothing is published. Do not make publication mandatory.
- For capture, improve the existing completion screen; for training, consider a contextual explanation/proposal button. Do not build another general chatbot.
- Voice or natural-language set editing is a separate later slice: resolve the current stable session/set, create the same reviewed/durable operation as native controls, and retain a no-AI manual path. Crown/tap controls remain primary until physical-device reliability is proven.

**Deliverables:** Publication/read contracts, one minimal private card, revocation/staleness tests, and a measured keep/remove decision.

**Gate:** An explicitly published finding appears only for its owner, each numeric claim opens its evidence, stale/revoked data is handled, and deleting it does not delete the underlying health records.

### Stage 7 — Optional automation and focused personal insights

Only start a job when the owner explicitly enables its timing, data scope, model/provider, destination, and budget. This roadmap does not schedule anything.

**Work**

- A recurring review needs an actual runner on existing authorized infrastructure or a verified client scheduling capability. An external chat session by itself is not a scheduler. Reuse existing jobs infrastructure; do not introduce a new service by default.
- Distinguish an external assistant run from a separate server-side inference call. A server job may need its own API/model credentials and costs; a chat subscription does not establish those capabilities.
- Run with read-only data access and, only if authorized, restricted publication rights. Do not grant domain-mutation permission merely to save a summary.
- Deduplicate jobs by owner, period, and input revision; implement timeout, bounded retries/cost, private result delivery, failure state, and an immediate off switch.
- Notify only under the established health-engagement policy. AI may propose a discretionary timing change, but does not control medication/supplement scheduling, quiet hours, or notification caps.
- Add a few cross-domain analyses with explicit temporal alignment, sufficient comparable observations, missingness controls, source/device-change checks, and sensitivity analysis. Avoid large uncorrected searches for any attractive correlation.
- Report descriptive association, not causation. Predefine any experiment before collecting its evaluation data. Defer health-plan interventions and dose changes.
- Use existing baselines and simple models before complex personal models. Lack of usable data is a reason to abstain from a particular claim, not to invent precision.

**Deliverables:** Optional bounded runner configuration, first scheduled review or narrowly defined insight, monitoring/disable runbook, and data-quality report.

**Gate:** Repeated runs do not duplicate findings or incur unbounded work; disabling stops future runs; unavailable data produces no invented insight; no automatic health-plan mutations occur.

## 6. Reusable external-assistant playbooks

These are initial workflows for Stage 3. They are instructions for interpretation, not a substitute for server permissions. Tool names must be mapped to the verified restricted surface.

### A. Comparable strength review

> Review the last four weeks of recorded strength training. Retrieve coverage first. Compare the same exercise variants and equipment, exclude planned or uncompleted sets, preserve units, and distinguish different repetition ranges. Use calculated facts from tools. Give up to three findings with evidence references, explain missing or incomparable records, and propose at most one next action. Do not change any routine or active session.

### B. Nutrition logging review

> Review the last seven calendar days in my configured timezone. Separate captured, partially completed, and reviewed entries. State the denominator for any average and whether unsynchronized device records may be missing. Do not treat absent logs as zero intake or infer that I skipped a meal. Identify one saved-food, portion, or meal-template shortcut that could reduce logging effort. Do not modify calorie targets or create food records.

### C. Routine review

> Compare configured supplement occurrences with taken, skipped, and unresolved reports, without treating unresolved as proof of nonadherence. Summarize hydration logs and self-reported movement separately from device observations. Distinguish unknown coverage and delayed sync. Suggest at most one convenience change to discretionary reminders, never a dose, treatment, or fluid recommendation. Make no changes.

### D. Shorter workout proposal

> Inspect this saved workout and the relevant exercise/equipment library. Propose a version for the time budget I specify, with explicit assumptions about rest and duration. Show the exact exercise/set changes and keep it a draft or copied preset; do not overwrite the existing preset or active session. Reference the source version and explain trade-offs. Wait for trusted approval before applying any supported change.

### E. Focused personal question

> For the specific relationship I ask about, first check whether the required timestamps, record completeness, and comparable observations exist. State the analysis window and method. Do not scan many unrelated comparisons and present the most attractive one. Distinguish exploratory association from causation and abstain when the available evidence cannot support a useful answer.

## 7. Verification, source changes, and release discipline

### Evaluation and acceptance matrix

| Risk | Required test |
| --- | --- |
| Read-only bypass | Invoke every prohibited action directly, including hidden tools, multiplexed mutations, REST routes, normalized/null arguments, and admin/meta escalation. |
| Token/owner confusion | Wrong/revoked credential, second synthetic owner, switched profile, cached policy, and guessed record IDs. |
| Untrusted retrieved content | Malicious instructions inside food names, notes, exercise text, and returned links cannot grant permissions or cause extra disclosure. |
| False nutrition certainty | Partial days, unknown micronutrients, unlogged days, AI estimates, and supplement totals do not become measured complete intake. |
| Misleading workout trend | Mixed machines, duplicate imports, kg/lb, planned versus actual sets, and changed set identities remain distinguishable. |
| Stale or missing device state | Delayed phone/Watch synchronization is disclosed; older evidence cannot overwrite a newer user edit. |
| Approval forgery | Model-supplied confirmation, modified patch, expired approval, replay, and stale source version all fail safely. |
| Duplicate execution | Concurrent apply and response-loss retry produce one logical change/receipt. |
| Finding publication | Owner isolation, sanitized content, numeric traceability, revocation, expiry, and no changes to source health data. |
| Model/client change | Re-run golden tasks; compare factual/task success and costs, not exact prose. |
| Automation | Disabled job, duplicate trigger, exhausted budget, provider outage, and partially complete input fail without new health records. |

Keep fixture data and test results synthetic in Git. Real reviews, memory, proposals, findings, logs containing records, and provider responses belong in private owner-scoped storage with existing backup/deletion policies. Revoking a connector prevents future access; it does not retroactively delete data already sent to an external provider. Document that boundary before real-data use.

For implementation, follow [root instructions][guide-root], [server guidance][guide-server], [shared guidance][guide-shared], and the [plan-review checklist][guide-plan]. Read the mobile/frontend package guides before touching their code. Follow the migration checklist for new proposal/finding/preference tables, including grants/RLS, shared schemas, relevant consumer updates, and documentation. The repository's schema backup is CI-maintained; do not regenerate it manually.

Run the actual current package commands after changes. At the inspected baseline, server validation includes `pnpm run validate` and `pnpm test`; shared changes require consumer validation. Native integrations also require the appropriate generated-project/native build and physical-device gates. This document does not claim those tests have run.

Keep rollout separately switchable: restricted MCP, evidence tools, context memory, proposal creation, apply, publication, and optional jobs. A failed later stage must not disable ordinary tracking or the working read-only pilot. Disable writes before rollback; preserve pending proposals/receipts and do not roll schema changes back destructively.

Check upstream changes before each implementation stage and before rebasing. Reuse new upstream features only after verifying their semantics and permissions; deny newly added tools in the restricted profile by default. Avoid holding the project on an old baseline merely to avoid re-auditing a small adapter.

### First implementation task

Implement Stages 0–1 and a minimum Stage 2 strength-history or nutrition-coverage read. Prove one synthetic end-to-end external-client review with mutation-denial tests. Do not start an in-app chat rewrite, live workout mutation, scheduled review, or real-data export in that first task.

### Completion report for each stage

Record changed packages/paths, exact version, implemented contracts, tests actually run, synthetic acceptance evidence, unresolved deployment/client/device checks, security scope, rollback/disable path, and the next bounded task. Use `passed`, `failed`, `not run`, or `blocked`; do not convert a mocked test or generated configuration into a deployed success.

## 8. Implementation tracking and activation decisions

| Stage | Implementation status at plan creation | Evidence required to close |
| --- | --- | --- |
| 0 | Not started | Version/client inventory and synthetic connection evidence. |
| 1 | Not started | Restricted-key policy and direct-bypass negative tests. |
| 2 | Not started | Typed evidence and deterministic fixture reconciliation. |
| 3 | Not started | Repeated useful manual workflows with factual traceability. |
| 4 | Not started | Inspectable approved context and measured capture improvement. |
| 5 | Not started | Trusted approval, revision conflicts, and exactly-once application behavior under retry. |
| 6 | Not started | One private evidence-linked app surface with stale/delete handling. |
| 7 | Deferred/opt-in | Explicit schedule/provider/budget approval and runner failure tests. |

Resolve these only when their stage needs them; the plan is not blocked by answering them now:

- Which existing external client and model will be used for the first pilot, and what authenticated transport does it support?
- Which data domains, raw detail, retention, and external-provider processing does the owner explicitly authorize?
- What deployed version and access controls are actually present?
- Which single low-risk mutation is worth enabling after read-only use proves useful?
- Which workflow deserves native publication, and does the owner want manual or later scheduled generation?

No deployment, credential creation, provider connection, real-health-data processing, scheduled task, application-code change, or automatic merge is authorized merely by committing this roadmap. Personal/non-commercial scope remains subject to the repository's existing license; preserve notices and reassess licensing before any future commercial use.

## 9. Definition of success

The owner can continue fast native/offline tracking, use an external assistant for useful evidence-backed thinking, inspect the personal context behind suggestions, approve a small concrete change when desired, and bring only valuable results back into the app. Useful read-only reviews alone are a valid outcome; autonomy and native AI surfaces are not compulsory milestones.

## References

Source links below are pinned to the inspected fork revision. External specifications are reference baselines, not a promise about the newest protocol/client version; verify actual compatibility during implementation.

[src-mcp-route]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessServer/routes/mcpRoutes.ts
[src-mcp-adapter]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessServer/ai/mcp/mcpAdapter.ts
[src-mcp-doc]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/docs/src/features/mcp-server.md
[src-tool-registry]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessServer/ai/tools/index.ts
[src-exercise-tools]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessServer/ai/tools/exerciseTools.ts
[src-workout-plans]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessServer/ai/tools/workoutPlanTools.ts
[src-exercise-stats]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessServer/ai/tools/exerciseStatsTools.ts
[src-coach]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessServer/ai/tools/coachTools.ts
[src-photo-match]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessServer/services/foodPhotoMatchService.ts
[src-medication]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessServer/ai/tools/medicationTools.ts
[src-provider]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessServer/ai/providerDispatch.ts
[src-progression]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/shared/src/utils/progressionEngine.ts
[watch-plan]: https://github.com/carhartt21/SparkyFitness/blob/7352a9d5145cd2effe2c6d062008db5c5dd24ebb/docs/plans/live-strength-workout-watch-sync.md
[watch-pr]: https://github.com/carhartt21/SparkyFitness/pull/1
[guide-root]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/AGENTS.md
[guide-server]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/SparkyFitnessServer/AGENTS.md
[guide-shared]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/shared/AGENTS.md
[guide-plan]: https://github.com/carhartt21/SparkyFitness/blob/3c84e8007fb4f2541c58238ec71a2dcbb7d458a4/agent-docs/plan-review-checklist.md
[mcp-tools]: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
[mcp-auth]: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
[mcp-security]: https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices
