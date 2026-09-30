import type { FddbDiaryRow, FddbImportResult } from '@workspace/shared';

/** The last acknowledged row is the safe resume point; source IDs handle uncertain retries. */
export async function importFddbDiaryBatches(
  rows: FddbDiaryRow[],
  startAt: number,
  send: (batch: FddbDiaryRow[]) => Promise<FddbImportResult>,
  onBatch: (processed: number, result: FddbImportResult) => void,
  shouldContinue: () => boolean = () => true
): Promise<void> {
  for (let start = startAt; start < rows.length; start += 100) {
    if (!shouldContinue()) return;
    const batch = rows.slice(start, start + 100);
    const result = await send(batch);
    if (!shouldContinue()) return;
    onBatch(start + batch.length, result);
  }
}
