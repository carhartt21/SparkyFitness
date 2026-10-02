import {
  createHabitRequestSchema,
  logHabitRequestSchema,
  localDateToDay,
  type Habit,
  type HabitLog,
} from '@workspace/shared';
import { trackingReviewResponse } from './trackingFixture';

/** Only synthetic wellness writes are accepted; all other traffic stays gated. */
export function createWellnessReviewFixture(scenario: string) {
  const activities: Habit[] = [];
  let logs: HabitLog[] = [];
  return {
    snapshot: () => ({ activities: [...activities], logs: [...logs] }),
    respond(url: URL, method: string, body?: string): unknown {
      const path = url.pathname;
      if (method === 'GET' && path === '/api/v2/tracking/habits') {
        const base = trackingReviewResponse(path, scenario, '') as Habit[];
        return [...base, ...activities];
      }
      if (method === 'GET' && path === '/api/v2/tracking/habit-logs') {
        // Routine logs remain the responsibility of the normal fixture.
        const day = localDateToDay(new Date());
        const base = trackingReviewResponse(path, scenario, day) as HabitLog[];
        return [...base, ...logs].filter(
          (log) =>
            log.entry_date >= (url.searchParams.get('start_date') ?? '') &&
            log.entry_date <= (url.searchParams.get('end_date') ?? '9999-12-31')
        );
      }
      if (method === 'POST' && path === '/api/v2/tracking/habits') {
        const input = createHabitRequestSchema.parse(JSON.parse(body ?? '{}'));
        if (input.category !== 'wellness')
          throw new Error('Review only accepts wellness activity creation');
        const existing = activities.find((item) => item.name === input.name);
        if (existing) return existing;
        const activity: Habit = {
          id: `review-created-wellness-${activities.length + 1}`,
          name: input.name,
          category: 'wellness',
          habit_type: 'completion',
          days: [],
          reminder_time: null,
          description: null,
          unit: null,
          target: null,
          step: null,
          active: true,
          sort_order: 0,
          icon: null,
        };
        activities.push(activity);
        return activity;
      }
      const match = path.match(
        /^\/api\/v2\/tracking\/habits\/(review-created-wellness-\d+)\/logs$/
      );
      if (method === 'PUT' && match) {
        const id = match[1];
        if (!activities.some((activity) => activity.id === id))
          throw new Error('Unknown review activity');
        const input = logHabitRequestSchema.parse(JSON.parse(body ?? '{}'));
        if (input.value !== true && input.value !== null)
          throw new Error('Review wellness accepts completion or undo');
        logs = logs.filter(
          (log) => log.habit_id !== id || log.entry_date !== input.entry_date
        );
        if (input.value === null) return null;
        const log: HabitLog = {
          habit_id: id,
          entry_date: input.entry_date,
          value: 1,
          recorded_at: new Date().toISOString(),
        };
        logs.push(log);
        return log;
      }
      return undefined;
    },
  };
}
