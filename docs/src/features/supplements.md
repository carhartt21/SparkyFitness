---
title: Medications and supplements
description: Explicit classification, confirmed intake and owner-reviewed assistant timing suggestions.
---

# Medications and supplements

Open **More → Supplements** for the supplement routine, or the medication
library for saved medicines and supplements. When creating or editing an item,
choose its category explicitly. A non-prescription medicine is still a medicine;
X on Track does not classify an item from its name.

A saved item describes the product. A schedule describes intended intake.
**Log** confirms actual intake; **Skip** records that you skipped that occurrence.
An upcoming schedule or reminder does not count as consumed. Supplement nutrient
snapshots remain with recorded intake even when the item is later edited,
reclassified or removed. Liquid supplement intake also contributes to hydration
when its recorded nutrition contains a known water amount.

## Ask the assistant to review timing

The in-app assistant can read recorded nutrition, supplement definitions,
schedules and confirmed intake, then suggest timing for you to review. Enable
the food, medication and relevant daily-tracking tool categories if they are
disabled in your AI service settings. For external clients, the full API-key
MCP surface exposes medication/supplement management; the proposal-only coaching
connection does not authorize these schedule or dose changes.

Start with an explicit range and a read-only request:

> Lies meine protokollierte Ernährung vom 1. bis 7. Oktober und meine gespeicherten
> Supplemente, Einnahmepläne und bestätigten Einnahmen. Nenne fehlende Daten.
> Schlage bei Bedarf eine Uhrzeit oder einen Bezug zu einer Mahlzeit für meine
> bereits vorgesehenen Supplemente vor. Leite aus unvollständigen Protokollen
> keinen Nährstoffmangel ab. Ändere weder Produkt, Dosis noch Zeitplan.

Review the proposed time, weekdays and meal relationship. When you want to save
it, approve the exact schedule change, then ask for a fresh read. Do not describe
a planned intake as taken. Timing suggestions based on logging are not a
diagnosis of deficiency or an assessment of medication interactions.

The existing `sparky_manage_medications` tool can list items and schedules,
create/delete a schedule, and log actual intake. `add_schedule` supports
`time_of_day` in 24-hour format, weekdays, a start date and `with_meal`
(`before`, `with`, `after`). There is no schedule-update action: a replacement
requires an explicit review of the old and new schedule, including removal of
the superseded one, to avoid duplicate reminders. These writes take effect
directly; they do not enter the coaching proposal inbox. A timed-out write must
be checked by reading schedules before any retry.

The assistant does not automatically prescribe a supplement, increase a dose,
or adjust timing in the background. For recurring evidence reviews, use
[Recommendations](/features/agent-recommendations); supplement adherence can
inform a recap without changing the intake plan.

## Reminders

Use [Notification settings](/features/settings/notifications) to control repeat
intake reminders. A repeat can produce another reminder for the same unresolved
occurrence. Supplement reminders at the same exact time are grouped; completing or skipping
an occurrence resolves its existing action rather than creating another intake.
