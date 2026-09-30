import express from 'express';
import { z } from 'zod';
import { mobilityOperationSchema } from '@workspace/shared';
import { requireSelfActor } from '../../middleware/requireSelfMiddleware.js';
import {
  applyMobilityOperation,
  getMobilitySnapshot,
  MobilityConflictError,
  MobilityNotFoundError,
  MobilityValidationError,
} from '../../services/mobilityService.js';
const router = express.Router();
router.use(requireSelfActor);
/**
 * @openapi
 * /api/v2/mobility:
 *   get:
 *     summary: Owner-only mobility routines, plans and immutable session snapshots
 *     responses:
 *       '200': { description: Mobility snapshot (maximum 93 calendar days) }
 *   post:
 *     summary: Idempotent, revision-checked mobility mutation
 *     responses:
 *       '200': { description: Applied revision and updated linked plan, when applicable }
 *       '409': { description: Stale revision or active plan conflict }
 */
router.get('/', async (req, res, next) => {
  const dates = z
    .object({ from: z.iso.date().optional(), to: z.iso.date().optional() })
    .safeParse(req.query);
  if (!dates.success) {
    res.status(400).json({ error: 'Invalid date range.' });
    return;
  }
  try {
    res.json(
      await getMobilitySnapshot(
        req.authenticatedUserId,
        dates.data.from,
        dates.data.to
      )
    );
  } catch (error) {
    if (error instanceof MobilityValidationError)
      res.status(400).json({ error: error.message });
    else next(error);
  }
});
router.post('/', async (req, res, next) => {
  const parsed = mobilityOperationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid mobility operation.' });
    return;
  }
  try {
    res.json(
      await applyMobilityOperation(req.authenticatedUserId, parsed.data, 'api')
    );
  } catch (error) {
    if (error instanceof MobilityConflictError)
      res.status(409).json({ error: error.message });
    else if (error instanceof MobilityNotFoundError)
      res.status(404).json({ error: error.message });
    else if (error instanceof MobilityValidationError)
      res.status(400).json({ error: error.message });
    else next(error);
  }
});
export default router;
