import { apiCall } from '@/api/api';

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

export interface HevyCsvImportResult {
  submitted: number;
  imported: number;
  skipped: number;
  failed: Array<{ id: string; message: string }>;
  savedRoutinesIncluded: false;
}

export function previewHevyCsv(csv: string, timezone: string) {
  return apiCall<HevyCsvPreview>('/integrations/hevy/csv/preview', {
    method: 'POST',
    body: { csv, timezone },
    omitRequestBodyFromLogs: true,
  });
}

export function importHevyCsv(csv: string, timezone: string) {
  return apiCall<HevyCsvImportResult>('/integrations/hevy/csv/import', {
    method: 'POST',
    body: { csv, timezone },
    omitRequestBodyFromLogs: true,
  });
}
