import { randomUUID } from 'node:crypto';
import type {
  ActivityPlanningData,
  PlanningEntry,
} from '../../models/activityPlanningRepository.js';
const DAY = '2026-10-01';
const exerciseId = randomUUID();
export const activityData = (): ActivityPlanningData => ({
  versions: [
    {
      id: '1',
      template_id: 1,
      effective_from: DAY,
      captured_at: '2026-10-01T10:00:00Z',
      plan_name: 'Weekly movement',
      start_date: DAY,
      end_date: null,
      is_active: true,
      assignments: [
        {
          id: 1,
          dayOfWeek: 4,
          workoutPresetId: null,
          exerciseId,
          label: 'Running',
          sets: [],
          exercises: [
            { exerciseId, name: 'Running', expectedSets: 2, sets: [] },
          ],
        },
      ],
    },
  ],
  entries: [],
  resolutions: [],
  mobilityPlans: [],
  mobilitySessions: [],
});
export const activityEntry = (
  changes: Partial<PlanningEntry> = {}
): PlanningEntry => ({
  id: randomUUID(),
  record_id: randomUUID(),
  exercise_id: exerciseId,
  entry_date: DAY,
  exercise_name: 'Running',
  session_name: 'Running',
  origin_id: 1,
  set_count: 2,
  completed_count: 0,
  recorded_at: null,
  first_confirmed_at: '2026-10-01T10:30:00Z',
  source: null,
  category: null,
  notes: null,
  provider_name: null,
  detail_data: null,
  ...changes,
});
