import type {
  FddbDiaryRow,
  FddbExtras,
  FddbImportResult,
} from '@workspace/shared';
import { apiCall } from '../api';

export type FddbExtraResults = Record<keyof FddbExtras, FddbImportResult>;

export const importFddbDiaryBatch = (rows: FddbDiaryRow[]) =>
  apiCall<FddbImportResult>('/imports/fddb/diary', {
    method: 'POST',
    body: { rows },
  });

export const importFddbExtras = (extras: FddbExtras) =>
  apiCall<FddbExtraResults>('/imports/fddb/extras', {
    method: 'POST',
    body: extras,
  });
