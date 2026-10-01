# Medication and supplement distinction — 2026-10-01

Implemented on `fix/medication-supplement-distinction-20261001`, based on the food UI/localization batch (`2dfab7b21`). The main checkout's uncommitted Watch workout-energy work is separate and was not edited. This batch has not been merged, published or deployed.

## Classification authority

`medications.is_supplement` remains the explicit saved category. A missing flag in a legacy cached definition follows the existing medication default. Names, prescription status, nutrient values and dose forms do not determine the category. Non-prescription medicines are still medications. No records, doses, schedules, persisted identifiers, permissions or historical nutrition snapshots were migrated.

A retained, non-null `nutrients_snapshot` identifies historical supplement intake, including an empty object. This follows the server's existing snapshot and authorization contract. Deleted definitions without snapshot evidence remain accessible in the mixed history view with “Category unavailable”; they are not guessed into a category. History without a snapshot uses the current definition where available, because the existing contract does not retain a separate historical category flag.

## Audit and corrections

| Priority | Observed issue                                                                                                                                             | Correction                                                                                                                                 | Verification                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| High     | Mobile sent `nutrients: null` for ordinary medications, but the request schema accepts an optional object rather than null.                                | Send an object; preserve existing nutrition metadata when changing category.                                                               | Form save regression tests and server schema tests.                         |
| High     | Definition/category and schedule edits did not refresh all dependent supplement progress summaries.                                                        | Reuse existing invalidation helpers in mobile and web.                                                                                     | Cache tests check medication, daily progress, nutrition trends and reports. |
| Medium   | Mobile supplement forms, shared navigation, reminders and web mutation feedback called supplements medications.                                            | Category-specific forms/reminder titles, explicit category picker/filter, visible kind labels and neutral mixed-operation feedback.        | EN/DE classification, form, reminder and hook tests.                        |
| Medium   | Web category filters hid supplement history after its definition was deleted or reclassified, despite a retained nutrient snapshot.                        | Use snapshot evidence in history and calendar filtering.                                                                                   | Deleted/reclassified supplement regression fixtures.                        |
| Medium   | Shared reports, permission descriptions and pregnancy intake headings described only one category.                                                         | Name both kinds when the view or permission actually covers both; explain the additional diary permission for supplement intake/nutrition. | Relevant component tests and web build.                                     |
| Medium   | German dose/schedule copy contained English fragments and misleading translations, including “Tabellet” and a dose override described as an exceeded dose. | Reviewed German overlays correct affected forms, schedules, reminders, states and explanations.                                            | Overlay, copy audit and mobile i18n checks.                                 |

## Changed surfaces and behavior

- **Mobile:** Library/routes, medication/supplement list and filter, definition form, detail page, Dashboard intake card/settings, supplement-only empty state, notification settings/channel and scheduled local reminders. Supplement forms include tablet, capsule, softgel, gummy, powder and liquid; legacy/custom saved forms remain selectable. Prescriber/pharmacy fields are hidden for supplements while saved values remain intact.
- **Web:** navigation, cabinet/detail badges, intake history/calendar, symptom linking, reports/print copy, pregnancy linked-intake heading, family access descriptions and shared-item mutation feedback.
- **Assistant tools:** descriptions distinguish explicit supplement classification from prescription status; list/detail/create/update results identify the saved kind. Technical tool names and API contracts stay compatible.
- **Shared:** canonical supplement dose-form choices replace the duplicated web constant. Existing logging, serving interpretation, nutrition calculations and outboxes remain in place.

Local medication and supplement reminders still use the existing shared notification channel/category, privacy settings, schedule IDs and action routing. Reminder copy now follows the category and schedule dose override. The copy revision refreshes pending older requests on reconciliation; already delivered notifications are not rewritten. Medication/supplement schedules remain separate from the server's optional meal, water and movement reminder budget.

Watch/widget routine feeds already consume the explicitly classified supplement progress domain. No native target changes were needed for this distinction; physical display and notification receipt were not verified in this batch.

## Validation

Machine-readable evidence: [validation.json](evidence/medication-supplement-20261001/validation.json).

- Full mobile Jest suite: **519 suites, 7,477 tests passed**.
- Full web Jest suite: **165 suites, 1,442 tests passed**. The final hook-test initialization/type correction was then rechecked separately: **4 tests passed**.
- Targeted server medication tool, schema, route and repository suites: **7 suites, 53 tests passed**.
- Web `pnpm run build`: passed, including its validate wrapper (typecheck, lint, formatting, Knip and localization checks) and Vite/PWA build.
- Server `pnpm run validate`: passed.
- Mobile validate: locale generation, reviewed German overlay/copy checks, typecheck, lint, i18n audit, Knip and native locale checks passed. Its `tsx` Watch-geometry step was blocked by sandbox IPC `listen EPERM`; the same script passed with `node --import tsx scripts/generate-watch-progress-x.mjs --check`. `pnpm run format:check` passed separately. The unmodified wrapper is therefore recorded as blocked, not passed.
- `git diff --check`: passed.

## Remaining verification

No authenticated before/after screenshots, enlarged-text native rendering, physical iPhone/Watch checks, signed native build, live server smoke test or delivered notification receipt was performed. Prior simulator access in this workflow was rejected by automatic approval review: “Computer Use was not approved to use Simulator.”

On the next available device build, verify a medication and a supplement side by side in German, edit/save both, check the explicit category filter and retained intake history, and schedule one reminder of each kind with names shown and hidden. Check the longer combined headings at normal and enlarged text sizes. This is device verification of the implemented batch, not a request to change live health data.
