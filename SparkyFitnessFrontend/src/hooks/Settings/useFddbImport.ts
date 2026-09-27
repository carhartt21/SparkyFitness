import { useCallback } from 'react';
import type { FddbDiaryRow, FddbExtras } from '@workspace/shared';
import {
  importFddbDiaryBatch,
  importFddbExtras,
  type FddbExtraResults,
} from '@/api/Settings/fddbImportService';
import { useDiaryInvalidation } from '@/hooks/useInvalidateKeys';

export type { FddbExtraResults };

export const useFddbImport = () => {
  const invalidate = useDiaryInvalidation();
  return {
    importDiaryBatch: useCallback(
      (rows: FddbDiaryRow[]) => importFddbDiaryBatch(rows),
      []
    ),
    importExtras: useCallback(
      (extras: FddbExtras) => importFddbExtras(extras),
      []
    ),
    invalidate,
  };
};
