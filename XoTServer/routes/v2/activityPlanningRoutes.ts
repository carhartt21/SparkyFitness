import express from 'express';
import {
  activityPlanningRangeSchema,
  activityResolutionRequestSchema,
} from '@workspace/shared';
import { requireSelfActor } from '../../middleware/requireSelfMiddleware.js';
import {
  getActivityPlanning,
  resolveActivityPlanning,
  ActivityPlanningConflictError,
  ActivityPlanningNotFoundError,
  ActivityPlanningValidationError,
} from '../../services/activityPlanningService.js';
const router = express.Router();
router.use(requireSelfActor);
/**
 * @openapi
 * /api/v2/activity-planning:
 *   get:
 *     summary: Owner-only scheduled activities and confirmed diary evidence
 *     responses:
 *       '200': { description: Read-only projection for at most 42 calendar days }
 *   put:
 *     summary: Revision-checked skip, undo or explicit diary link (no diary writes)
 *     responses:
 *       '200': { description: Updated daily projection }
 *       '409': { description: Stale decision or evidence already linked }
 */
router.get('/', async (req, res, next) => {
  const parsed = activityPlanningRangeSchema.safeParse(req.query);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: 'Choose a valid range of at most 42 calendar days.' });
    return;
  }
  try {
    res.json(
      await getActivityPlanning(
        req.authenticatedUserId,
        parsed.data.start_date,
        parsed.data.end_date
      )
    );
  } catch (error) {
    next(error);
  }
});
router.put('/', async (req, res, next) => {
  const parsed = activityResolutionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid activity decision.' });
    return;
  }
  try {
    res.json(
      await resolveActivityPlanning(req.authenticatedUserId, parsed.data)
    );
  } catch (error) {
    if (error instanceof ActivityPlanningConflictError)
      res.status(409).json({ error: error.message });
    else if (error instanceof ActivityPlanningNotFoundError)
      res.status(404).json({ error: error.message });
    else if (error instanceof ActivityPlanningValidationError)
      res.status(400).json({ error: error.message });
    else next(error);
  }
});
export default router;
