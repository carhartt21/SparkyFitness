import { useCallback } from 'react';
import { importHevyCsv, previewHevyCsv } from '@/api/Integrations/hevyCsv';
import { useExerciseInvalidation } from '@/hooks/useInvalidateKeys';

export type {
  HevyCsvImportResult,
  HevyCsvPreview,
} from '@/api/Integrations/hevyCsv';

export function useHevyCsvImport() {
  const invalidateExercises = useExerciseInvalidation();

  const preview = useCallback(
    (csv: string, timezone: string) => previewHevyCsv(csv, timezone),
    []
  );
  const importCsv = useCallback(
    async (csv: string, timezone: string) => {
      const result = await importHevyCsv(csv, timezone);
      invalidateExercises();
      return result;
    },
    [invalidateExercises]
  );

  return { preview, importCsv };
}
