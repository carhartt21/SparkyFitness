# Consolidated supplement reminders — 2026-10-04

Branch: `feat/supplement-reminder-groups-20261004`, based on `e7acfbbae`.
This record covers implementation and local validation, not a published build.

## Behavior

The local intake scheduler previously submitted one native alert per supplement
occurrence, even when several schedules had the same time. It now builds the
existing seven-day base/today-only follow-up plans, then consolidates unresolved
supplements for the same account, server, intake day and exact firing instant.
There is no rounding window. Medication alerts stay individual.

Example: Electrolytes and Vitamin D scheduled for 09:00 produce one alert listing
both items. With optional intake follow-ups enabled, they also produce one alert
at each of 09:10, 09:20 and 09:30. Recording Electrolytes leaves only Vitamin D
in future alerts; resolving both cancels them. An initial occurrence and another
occurrence's follow-up can share a firing instant. Intake days remain distinct,
including repeats crossing midnight.

The group offers **Open supplements / Supplemente öffnen**, and a body tap opens
the same dated list. Each intake is recorded individually through the existing
flow; opening a notification never records intake. Once only one item remains,
its existing Taken/Skip actions return. Hide names displays a count instead of
names/doses. German copy uses the approved informal voice and restrained 🌿.

## Implementation boundaries

- `supplementReminderGroups.ts` transforms the existing plans, sorts membership
  deterministically and removes single-item action targets from group payloads.
  Payloads carry occurrence IDs, account scope and firing time, not item names/doses.
- `medicationReminderService.ts` retains the current permission/toggle, schedule,
  outbox and repeat policies. A serialized queue replaces the old concurrent-call
  no-op so a new offline intake decision is not discarded during a native pass.
- Native identifiers remain stable and scoped. Old individual alerts are cancelled
  before groups are scheduled. Failed cancellation blocks an overlapping replacement;
  it does not knowingly submit both representations. Unchanged groups are retained.
- `MedicationReminderReconciler` listens to existing nutrition outbox and identity
  events. This adds no persistence stack or intake-writing path.
- `medicationReminderReservations.ts` validates grouped membership/firing times and
  includes groups in optional-reminder collision reservations, including midnight.
- The existing notification handler validates group data and active identity,
  deduplicates concurrent taps and defers cold-start links until the navigation tree
  is ready. Failed navigation leaves the response available for retry.
- Localized category registration uses a foreground review action. The foreground
  notification handler also presents the group category.

Scheduled intake alerts remain local in both local and remote optional-reminder
modes. No server schema, migration, native entitlement, repeat preference or API
contract changed. Opening the updated app reconciles old pending requests. Already
presented notifications retain their original content. OS notification limits,
Focus and delivery behavior still apply.

## Validation

- Focused scheduler/action/reservation/presentation/component suite: 161 tests passed.
- Follow-up grouping and navigation/startup/header checks: 103 tests passed.
- Final full mobile suite: 550 suites and 7,773 tests passed.
- Mobile `pnpm run validate`: passed, including typecheck, lint, German overlay/copy,
  i18n audit, Knip, native resources, Watch geometry, widget assets and formatting.
- Docs `pnpm run build`: passed (existing chunk-size warning).

Regression cases cover exact-time and adjacent-time schedules, medication/account/day
separation, duplicate representations versus distinct schedules, deterministic IDs,
initial/follow-up collisions, partial/all taken or skipped, queued offline intake,
privacy/language changes, account changes, disabled reminders, cancellation failures,
stale native snapshots, late reconciliation, queue recovery, malformed payloads,
midnight reservations, warm/cold taps, readiness gating and retry after navigation failure.

No physical-device notification delivery, cold-start tap or Android action rendering
was performed. No production deployment, merge or TestFlight publication was performed.
Before release, verify on an installed phone: two supplements at the same future time
produce one alert; both body tap and review action open the dated list from a terminated
app; one offline intake shrinks remaining follow-ups; Hide names conceals names/doses;
medications keep individual actions. Confirm mirrored Watch notifications on a paired
phone/Watch separately; no Watch scheduler changed.
