import { importFddbDiaryBatches } from '@/utils/fddbImportBatches';
import type { FddbDiaryRow } from '@workspace/shared';

const row = (index: number): FddbDiaryRow => ({
  sourceKey: `source-${index}`,
  date: '2026-09-26',
  time: '08:00',
  foodName: `Food ${index}`,
  quantity: 1,
  unit: 'serving',
  calories: 10,
  protein: 1,
  carbs: 1,
  fat: 1,
});

describe('FDDB diary batching', () => {
  it('sends at most 100 rows, resumes at the last acknowledged boundary, and keeps source IDs', async () => {
    const rows = Array.from({ length: 205 }, (_, index) => row(index));
    const sent: string[][] = [];
    const progress: number[] = [];
    let failOnce = true;
    const send = async (batch: FddbDiaryRow[]) => {
      sent.push(batch.map((item) => item.sourceKey));
      if (batch[0]?.sourceKey === 'source-100' && failOnce) {
        failOnce = false;
        throw new Error('interrupted');
      }
      return { imported: batch.length, alreadyPresent: 0 };
    };
    await expect(
      importFddbDiaryBatches(rows, 0, send, (count) => progress.push(count))
    ).rejects.toThrow('interrupted');
    expect(progress).toEqual([100]);

    await importFddbDiaryBatches(rows, 100, send, (count) =>
      progress.push(count)
    );
    expect(sent.map((batch) => batch.length)).toEqual([100, 100, 100, 5]);
    expect(sent[1]).toEqual(sent[2]);
    expect(progress).toEqual([100, 200, 205]);
  });
});
