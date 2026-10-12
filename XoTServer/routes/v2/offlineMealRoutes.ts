import express from 'express';
import checkPermissionMiddleware from '../../middleware/checkPermissionMiddleware.js';
import { OfflineMealActionBodySchema } from '../../schemas/offlineMealSchemas.js';
import {
  createOfflineMealAction,
  OfflineMealActionError,
} from '../../services/offlineMealActionService.js';
import { clearUserTdeeCache } from '../../services/AdaptiveTdeeService.js';

const router = express.Router();
router.use(checkPermissionMiddleware('diary'));
/**
 * @swagger
 * /v2/offline-meals/actions:
 *   post:
 *     summary: Log an owner-only cached meal snapshot with replay protection
 *     description: Atomically records the grouped meal, ingredient snapshots and retained operation receipt. Retrying a deleted meal never recreates it.
 *     tags: [Nutrition & Meals]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OfflineMealAction'
 *     responses:
 *       200:
 *         description: Applied or replayed identical action; mealEntryId is null after deletion.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OfflineMealActionResponse'
 *       400:
 *         description: Invalid snapshot or meal category.
 *       403:
 *         description: Owner account required.
 *       409:
 *         description: Operation ID reused for different data.
 */
router.post('/actions', async (req, res, next) => {
  try {
    const actor = req.originalUserId || req.authenticatedUserId || req.userId;
    if (actor !== req.userId) {
      res.status(403).json({ error: 'Owner account required.' });
      return;
    }
    const parsed = OfflineMealActionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid meal snapshot.' });
      return;
    }
    const result = await createOfflineMealAction(req.userId, parsed.data);
    clearUserTdeeCache(req.userId);
    res.json(result);
  } catch (error) {
    if (error instanceof OfflineMealActionError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  }
});
export default router;
