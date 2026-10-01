---
title: Coaching and Trends Tools
description: Implemented legacy summary tools and their evidence limits.
---

# Coaching and trends tools

These functions summarize saved records in the full API-key registry and the in-app coaching category. They are not in the reviewed read-only/OAuth MCP allowlist. Their `sparky_` names are compatibility identifiers. For a reviewed training workflow use [MCP-based training](/features/exercises/mcp-training).

| Tool                            | Input                                                                                   | Current behavior                                                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sparky_get_health_summary`     | Optional `start_date`, `end_date`                                                       | Aggregates nutrition, exercise, biometrics, hydration, mood and sleep. Start defaults to today in the account timezone; omitted end uses the start day.                                           |
| `sparky_analyze_trends`         | `days`: 1–90, default 7                                                                 | Compares recorded weight and calorie history. Implemented, not a future Phase 3 placeholder.                                                                                                      |
| `sparky_get_30_day_trends`      | Optional `end_date`                                                                     | Aggregated 30-day records, ending today by default.                                                                                                                                               |
| `sparky_detect_patterns`        | `days`: 1–90, default 30                                                                | Applies fixed rules to recorded nutrition/sleep/mood rows. Its labels do not establish causation or data completeness.                                                                            |
| `sparky_generate_coaching_plan` | `goal`: `weight_loss`, `muscle_gain`, `maintenance` (default); optional `target_weight` | Returns suggested calorie/macro targets and frequent-food suggestions. It does not create a persisted training plan or change configured goals. `target_weight` is accepted but currently unused. |

Dates accept the tool's day keywords or explicit calendar days; prefer explicit dates for a repeatable review. The contracts are `XoTServer/ai/tools/schemas/coach.ts`, with behavior in `coachTools.ts`.

The legacy coaching-plan calculation uses a short weight/intake window and falls back to **2,200 kcal** when it lacks the required records. That fallback is not the user's measured expenditure. Trend/pattern summaries can omit or aggregate incomplete logging; inspect underlying records and coverage before acting on their suggestions. Do not present generated targets as established personal requirements, confirmed deficits or automatic goal updates.
