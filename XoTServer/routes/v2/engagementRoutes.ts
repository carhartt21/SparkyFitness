import express from 'express';
import { z } from 'zod';
import {
  engagementActionSchema,
  engagementDeviceSchema,
  engagementSettingsPatchSchema,
} from '@workspace/shared';
import { requireSelfActor } from '../../middleware/requireSelfMiddleware.js';
import {
  applyEngagementAction,
  disableEngagementDevice,
  EngagementConflictError,
  EngagementNotFoundError,
  getEngagementChanges,
  getEngagementSettings,
  patchEngagementSettings,
  upsertEngagementDevice,
} from '../../services/engagementService.js';

const router = express.Router();
router.use(requireSelfActor);

router.get('/settings', async (req, res, next) => {
  try {
    res.json(await getEngagementSettings(req.authenticatedUserId));
  } catch (error) {
    next(error);
  }
});

router.patch('/settings', async (req, res, next) => {
  const parsed = engagementSettingsPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid notification settings.' });
    return;
  }
  try {
    res.json(
      await patchEngagementSettings(req.authenticatedUserId, parsed.data)
    );
  } catch (error) {
    if (error instanceof EngagementConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.put('/devices', async (req, res, next) => {
  const parsed = engagementDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid notification device.' });
    return;
  }
  try {
    await upsertEngagementDevice(req.authenticatedUserId, parsed.data);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.delete('/devices/:installationId', async (req, res, next) => {
  const id = z.uuid().safeParse(req.params.installationId);
  if (!id.success) {
    res.status(400).json({ error: 'Invalid installation ID.' });
    return;
  }
  try {
    await disableEngagementDevice(req.authenticatedUserId, id.data);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/changes', async (req, res, next) => {
  const after = z.coerce
    .number()
    .int()
    .nonnegative()
    .safeParse(req.query.after ?? 0);
  if (!after.success) {
    res.status(400).json({ error: 'Invalid cursor.' });
    return;
  }
  try {
    res.json({
      events: await getEngagementChanges(req.authenticatedUserId, after.data),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/actions', async (req, res, next) => {
  const parsed = engagementActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid notification action.' });
    return;
  }
  try {
    res.json(await applyEngagementAction(req.authenticatedUserId, parsed.data));
  } catch (error) {
    if (error instanceof EngagementConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    if (error instanceof EngagementNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
