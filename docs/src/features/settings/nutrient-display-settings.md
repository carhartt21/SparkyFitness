# Nutrient Display Settings

Choose the nutrients and views you want in Nutrition Settings. Display choices
and personal targets are separate from recorded intake.

## Imported micronutrients

Compatible BLS and native health imports automatically register supported vitamin/mineral definitions, including magnesium. They do not add daily targets or change saved display choices. Reports and daily nutrition details show recorded values with the number of entries whose nutrient values are known. Unknown values are not zero, and partial coverage is not a complete daily intake assessment.

You can edit a custom nutrient's aliases. Existing names and units stay fixed to protect past snapshots. Deleting a definition while retaining history reserves its identity/unit; a later compatible import may reactivate it without changing hidden views or targets.

## Supplement nutrients on the phone

Open **More → Supplements** and add or edit a supplement. Enter known amounts
**per dose**, including fiber and magnesium. **More nutrients** expands the full
supported native vitamin/mineral set and additional fat fields. Blank amounts
remain unknown; an explicit zero stays zero. German decimal commas are accepted.
Existing custom names, units and unshown snapshot metadata are retained.

Selecting a native nutrient binds its canonical identity using the existing
catalog endpoint. It does not set an intake target, suggest a dose or change
nutrition display preferences. Incompatible units are rejected before the
supplement is saved. The saved definition's actual unit is shown beside its input.

If nutrition writeback is enabled and authorized in Apple Health or Health Connect
settings, confirmed intakes export the immutable per-dose nutrient snapshot scaled
by the recorded dose. Skipped/snoozed intakes, missing nutrition, injections and
native-imported entries are excluded. Only known nutrients with compatible units
are exported; missing energy never becomes a zero-calorie sample. The original
intake timestamp is retained, and the existing writeback journal handles replay,
corrections and deletion within the existing writeback date window. Water continues through the separate hydration export
so it is not credited twice. Native permission and paired-device acceptance need
a device check with matching app/server updates; a simulator cannot establish
that Apple Health received a real sample.
