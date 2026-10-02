import { tool } from 'ai';
import { z } from 'zod';
import { todayInZone } from '@workspace/shared';
import { getActivityPlanning } from '../../services/activityPlanningService.js';
const rangeInput = z
  .object({
    start_date: z.iso.date(),
    end_date: z.iso.date(),
    limit: z.number().int().min(1).max(50).default(50),
    offset: z.number().int().min(0).max(1000).default(0),
  })
  .strict()
  .refine(
    (args) =>
      args.start_date <= args.end_date &&
      (Date.parse(args.end_date) - Date.parse(args.start_date)) / 86400000 < 31,
    'Choose at most 31 calendar days.'
  );
export function buildActivityPlanningTools(userId: string, timezone: string) {
  return {
    xot_get_activity_planning: tool({
      description:
        'Read scheduled workout and mobility activities, confirmed diary evidence and completion counts. Account-local dates, maximum 31 days. No writes or automatic matching. Each array is paged with the same limit/offset; totals describe the complete range. Repeat with a larger offset while any array has more records. Old prescriptions may be unknown; unsynced phone/Watch workouts are absent.',
      inputSchema: rangeInput,
      execute: async (raw) => {
        const args = rangeInput.parse(raw);
        const result = await getActivityPlanning(
          userId,
          args.start_date,
          args.end_date
        );
        const page = <T>(rows: T[]) =>
          rows.slice(args.offset, args.offset + args.limit);
        return JSON.stringify({
          ...result,
          occurrences: page(result.occurrences),
          records: page(result.records),
          workout_plans: page(result.workout_plans),
          page: {
            offset: args.offset,
            limit: args.limit,
            occurrence_count: result.occurrences.length,
            record_count: result.records.length,
            plan_count: result.workout_plans.length,
          },
        });
      },
    }),
    xot_get_workout_plans: tool({
      description:
        'Read immutable workout plan prescriptions effective on an account-local date. Includes saved exercises and set targets (duration seconds, distance km, weight kg). Does not activate plans or create diary entries. Older snapshots may lack prescription detail. Sequential plans have no fixed weekday. At most 50 plans per page.',
      inputSchema: z
        .object({
          date: z.iso.date().optional(),
          limit: z.number().int().min(1).max(50).default(50),
          offset: z.number().int().min(0).max(1000).default(0),
        })
        .strict(),
      execute: async ({ date, limit, offset }) => {
        const day = date ?? todayInZone(timezone);
        const result = await getActivityPlanning(userId, day, day);
        return JSON.stringify({
          date: day,
          timezone,
          workout_plans: result.workout_plans.slice(offset, offset + limit),
          total: result.workout_plans.length,
          offset,
          limit,
          note: result.note,
        });
      },
    }),
  };
}
