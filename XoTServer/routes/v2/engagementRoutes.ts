import express from 'express';
import { z } from 'zod';
import {
  engagementSettingsPatchV2Schema,
  engagementDeviceV2Schema,
  engagementActionSchema,
  engagementDeviceSchema,
  engagementSettingsPatchSchema,
  engagementDeviceV3Schema,
  engagementSettingsV3Schema,
  engagementStatusSchema,
  engagementStatusV3Schema,
  engagementReminderKindV2Schema,
} from '@workspace/shared';
import { requireSelfActor } from '../../middleware/requireSelfMiddleware.js';
import {
  applyEngagementAction,
  disableEngagementDevice,
  EngagementConflictError,
  EngagementNotFoundError,
  getEngagementChanges,
  getEngagementSettings,
  getEngagementSettingsV2,
  getEngagementStatus,
  patchEngagementSettings,
  upsertEngagementDevice,
  recordMovementTimerStart,
} from '../../services/engagementService.js';

const router = express.Router();
router.use(requireSelfActor);

router.get('/settings', async (req, res, next) => {
  try {
    const result = await (
      req.query.version === '2' || req.query.version === '3'
        ? getEngagementSettingsV2
        : getEngagementSettings
    )(req.authenticatedUserId);
    res.json(
      req.query.version === '3'
        ? engagementSettingsV3Schema.parse({ ...result, schema_version: 3 })
        : result
    );
  } catch (error) {
    next(error);
  }
});

router.patch('/settings', async (req, res, next) => {
  const parsed = (
    req.query.version === '2' || req.query.version === '3'
      ? engagementSettingsPatchV2Schema
      : engagementSettingsPatchSchema
  ).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid notification settings.' });
    return;
  }
  try {
    const legacy = await patchEngagementSettings(
      req.authenticatedUserId,
      parsed.data
    );
    res.json(
      req.query.version === '3'
        ? engagementSettingsV3Schema.parse({
            ...(await getEngagementSettingsV2(req.authenticatedUserId)),
            schema_version: 3,
          })
        : req.query.version === '2'
          ? await getEngagementSettingsV2(req.authenticatedUserId)
          : legacy
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
  const parsed = (
    req.body?.protocol_version === 3
      ? engagementDeviceV3Schema
      : req.body?.protocol_version === 2
        ? engagementDeviceV2Schema
        : engagementDeviceSchema
  ).safeParse(req.body);
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

router.put('/movement-starts/:id', async (req, res, next) => {
  const parsed = z
    .strictObject({ id: z.uuid(), startedAt: z.iso.datetime({ offset: true }) })
    .safeParse({ id: req.params.id, startedAt: req.body?.startedAt });
  if (
    !parsed.success ||
    Date.parse(parsed.data.startedAt) > Date.now() + 300_000
  ) {
    res.status(400).json({ error: 'Invalid timer start.' });
    return;
  }
  try {
    await recordMovementTimerStart(
      req.authenticatedUserId,
      parsed.data.id,
      parsed.data.startedAt
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/status', async (req, res, next) => {
  try {
    const status = await getEngagementStatus(req.authenticatedUserId);
    res.json(
      req.query.version === '3'
        ? engagementStatusV3Schema.parse(status)
        : engagementStatusSchema.parse({
            ...status,
            occurrences: status.occurrences.filter(
              (row) =>
                engagementReminderKindV2Schema.safeParse(row.kind).success
            ),
            diagnostics: status.diagnostics.filter(
              (row) =>
                engagementReminderKindV2Schema.safeParse(row.kind).success
            ),
          })
    );
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
