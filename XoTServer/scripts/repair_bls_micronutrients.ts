/** Run with the server's normal DB environment; default is a rolled-back dry run. */
import { z } from 'zod';
import { endPool } from '../db/poolManager.js';
import { repairBlsMicronutrients } from '../services/blsMicronutrientRepairService.js';

const args = process.argv.slice(2);
const value = (flag: string) =>
  args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
try {
  const userId = z.uuid().parse(value('--user-id'));
  const after = z.uuid().optional().parse(value('--after'));
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(500)
    .parse(value('--limit') ?? 100);
  console.log(
    JSON.stringify(
      await repairBlsMicronutrients(userId, {
        apply: args.includes('--apply'),
        includeUnversioned: args.includes('--include-unversioned'),
        after,
        limit,
      })
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Repair failed');
  process.exitCode = 1;
} finally {
  await endPool();
}
