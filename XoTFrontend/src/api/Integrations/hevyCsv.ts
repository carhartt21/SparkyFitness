import { apiCall } from '@/api/api';
import { hevyCsvImportResultSchema } from '@workspace/shared';
import type { HevyCsvImportResult } from '@workspace/shared';
export type { HevyCsvImportResult } from '@workspace/shared';

export interface HevyCsvPreview {
  rowCount: number;
  savedRoutinesIncluded: false;
  timezoneRequired: true;
  timezoneValidated: boolean;
  reviewAvailable?: boolean;
  alreadyImportedWorkoutIndices: number[];
  exerciseMappings?: Array<{
    title: string;
    status: 'existing-name' | 'will-create';
  }>;
  potentialDuplicateSessions?: Array<{
    workoutIndex: number;
    existingSessionId: string;
    existingSource: string | null;
    entryDate: string;
  }>;
  warnings: string[];
  workouts: Array<{
    title: string;
    startTimeLocal: string;
    endTimeLocal: string;
    exercises: Array<{
      title: string;
      sets: Array<{ type: string }>;
    }>;
  }>;
}

export function previewHevyCsv(csv: string, timezone: string) {
  return apiCall<HevyCsvPreview>('/integrations/hevy/csv/preview', {
    method: 'POST',
    body: { csv, timezone },
    omitRequestBodyFromLogs: true,
  });
}

export async function importHevyCsv(csv: string, timezone: string) {
  const result = await apiCall<HevyCsvImportResult>(
    '/integrations/hevy/csv/import',
    {
      method: 'POST',
      body: { csv, timezone },
      omitRequestBodyFromLogs: true,
    }
  );
  return hevyCsvImportResultSchema.parse(result);
}
