# Notification delivery and personal copy — 2026-10-01

Branch: `fix/notification-delivery-copy-20261001`, based on main `ce840f415c0e8e86bc1ca917f87d3aae1aa0c88d`. Scope: intake deduplication, notification-chain cleanup, friendly German/English notification copy, and the repeat-setting explanation. No API/schema migration, identity changes, merge, deployment, or mobile publication.

## Incident evidence and cause

The owner confirmed that the screenshot came from v35 with repeat intake reminders enabled. Release preflight identifies build 1.7.2 (35) with source `cbbd40eb4aa6c53f7195c82919d157b81aec3693`. That source schedules an initial reminder plus three today-only follow-ups at +10, +20 and +30 minutes. All four previously had identical text. iOS's rounded relative age cannot distinguish those offsets in the supplied screenshot.

**Confirmed explanation:** one unresolved scheduled intake can intentionally generate four alerts. **Not established:** the precise reason for every extra alert in the screenshot. Two distinct schedules could produce two chains; accidental scheduling duplication is also possible. The screenshot has no native request identifiers or schedule identities. Fixture reproductions establish code defects, not incident attribution. Intake reminders are local in this implementation; the server engagement-kind contract does not include medication/supplement alerts.

## Prioritized issues and correction

| Priority | Evidence                                                                                                                                                | Correction                                                                                                                                                                      | Verification                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| High     | Duplicate medication/schedule representations schedule a logical occurrence repeatedly in one pass. Regression failed before the fix.                   | Deduplicate by medication, schedule, local date and time. Distinct schedule IDs remain separate.                                                                                | Duplicate-input and distinct-schedule regression tests.                               |
| High     | Multiple existing native requests for one logical key are all retained. Regression failed before the fix.                                               | Retain one current request; cancel surplus requests.                                                                                                                            | Duplicate pending-request regression.                                                 |
| High     | A rejected native cancellation was treated as successful, allowing another request. Regression failed before the fix.                                   | Retain failed cancellations and defer replacement. No fabricated success.                                                                                                       | Rejected cancellation regression.                                                     |
| High     | A stale empty native pending snapshot schedules fresh UUIDs again. Regression failed before the fix.                                                    | Stable native identifiers include server, account and occurrence key.                                                                                                           | Repeated stale-snapshot regression; native receipt still unverified.                  |
| Medium   | A notification action dismissed only the tapped alert; an already-recorded intake did not cancel the chain. Four action tests failed before correction. | After persistence, cancel pending and dismiss presented requests for that occurrence/account/server. Native cleanup failure cannot turn a successful write into a second write. | Taken, skipped, already-recorded, failed cleanup and supplement outbox tests.         |
| Medium   | Original and three follow-ups had the same text; default repeats were on.                                                                               | Number follow-ups 1–3, explicitly explain timing, use opt-in defaults for new preferences. Preserve saved enabled choices.                                                      | Copy, privacy and preference rehydration tests.                                       |
| Medium   | Local/server prompts diverged; German notifications addressed the owner formally.                                                                       | Shared reviewed EN/DE copy, relevant emoji titles and personal **du** throughout the mobile notification flow.                                                                  | Every engagement kind checked for local/server parity, copy lengths and German voice. |

## Design and behavior decisions

- German examples: “💧 Dein Getränk”, “🧘 Deine Mobilitätsroutine”, and “🌿 Supplement · Erinnerung 1”. Bodies use **du**, without guilt, inferred deficits, or advice to take an additional dose.
- Medication and supplement titles remain distinct. Hide-name mode continues to omit both item name and dose. Planned occurrences remain unconfirmed until a user records an action.
- Other application flows retain their existing formal/neutral voice. The German audit allows informal address only in approved mobile notification namespaces and rejects mixed English/formal address there. Package instructions and the translation guide document the exception.
- The shared notification table supplies remote copy. The mobile adapter accepts an explicit translator and uses static translation keys and English fallbacks for the existing i18n audit; a parity test prevents these adapters and the reviewed shared copy drifting apart. Other shipped locales continue using their catalogs.
- Copy revision `20261001b` refreshes pending intake requests once after upgrade. Past occurrences are not recreated. No new outbox, scheduler, preference migration or notification database is introduced.
- Named local habit reminders preserve the actual saved name and add 🌱. Native action identifiers, navigation links, daily optional-reminder limits, collision rules, quiet hours and local/remote ownership remain intact.

## Validation

See [verification.json](evidence/notification-delivery-2026-10-01/verification.json) for final command results, and [copy-preview.json](evidence/notification-delivery-2026-10-01/copy-preview.json) for synthetic EN/DE text samples.

- Full mobile regression run: **522 suites / 7,546 tests passed** with two workers. During earlier runs two obsolete workout-copy expectations were corrected, and one unchanged food-search test timed out once. That test passed on focused rerun and in the final broad run; no search code or search test was changed.
- Final correction added two German repetition-unit tests and aligned notification fallback text. The three affected suites passed again afterward: **81 tests**. The earlier focused batch passed **15 suites / 460 tests**, plus **5 hydration/fasting suites / 47 tests**.
- Server: **4 suites / 35 tests passed**; the server validation wrapper passed. The frontend validation wrapper also passed for the shared export.
- German audit: **5 tests passed**. Mobile typecheck, lint, static i18n audit, Knip, native locale checks, generated-resource checks and formatting pass. The static audit reports zero missing keys, placeholders, fallbacks or dynamic translation keys.
- Four scheduler regressions and four chain-cleanup regressions were demonstrated failing before implementation and passing afterward.

The final review also corrected existing “rep/reps Ziel” fragments in German rest notifications to “Wiederholung/Wiederholungen”, and added a regression guard for that mixed-language phrase.

The mobile `validate` wrapper reaches the Watch geometry CLI, then its `tsx` IPC pipe fails with sandbox `EPERM`. The same geometry check passes with `node --import tsx`; remaining validation constituents are checked separately. This is not a native build or device-delivery check.

## Outstanding checks

- Simulator rendering is **unverified**: CoreSimulator service connection fails in this environment. No screenshot is claimed as a rendered after-state.
- On-device update from v35, stable native-ID replacement, actual notification receipt and German truncation/Dynamic Type are **unverified**. No new binary was published.
- On the next physical check, enable repeats for one synthetic occurrence: expect one original plus numbered 1/2/3 follow-ups; foreground/background reconciliations must not add another chain. Record taken or skipped and verify only that chain disappears. Test hide-name mode and a second distinct schedule independently.
- Exact incident attribution beyond the confirmed repeat behavior requires the affected native request/schedule identities. Normal diagnostics must not collect item names, doses, push tokens or private histories.
- Impeccable reported outdated product context metadata; refreshing PRODUCT.md is separate from this focused correction.
