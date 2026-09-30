import express from 'express';
import { fddbDiaryBatchSchema, fddbExtrasSchema } from '@workspace/shared';
import { authenticate } from '../middleware/authMiddleware.js';
import { clearUserTdeeCache } from '../services/AdaptiveTdeeService.js';
import {
  importFddbDiary,
  importFddbExtras,
} from '../services/fddbImportService.js';

const router = express.Router();
router.use(express.json());
router.use(authenticate);

// This is an account-export restore, not a delegated family diary action.
router.use((req, res, next) => {
  const actorId = req.authenticatedUserId ?? req.originalUserId ?? req.userId;
  if (!req.userId || actorId !== req.userId) {
    return res
      .status(403)
      .json({ error: 'Import into your own account only.' });
  }
  next();
});

router.post('/diary', async (req, res, next) => {
  const parsed = fddbDiaryBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message });
  }
  try {
    const result = await importFddbDiary(
      req.userId,
      req.userId,
      parsed.data.rows
    );
    clearUserTdeeCache(req.userId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post('/extras', async (req, res, next) => {
  const parsed = fddbExtrasSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message });
  }
  try {
    const result = await importFddbExtras(req.userId, req.userId, parsed.data);
    clearUserTdeeCache(req.userId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

export default router;
