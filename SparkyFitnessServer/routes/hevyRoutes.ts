import { resolveMockDataOptions } from '../utils/mockDataOptions.js';
import express from 'express';
import { z } from 'zod';
import { isDayString } from '@workspace/shared';
import hevyService from '../integrations/hevy/hevyService.js';
import {
  hevyCsvWorkoutsForImport,
  previewHevyWorkoutCsv,
} from '../integrations/hevy/hevyCsvPreview.js';
import { getHevyCsvReview } from '../integrations/hevy/hevyCsvReview.js';
import { processHevyWorkouts } from '../integrations/hevy/hevyDataProcessor.js';
import exerciseEntryRepository from '../models/exerciseEntry.js';
import { log } from '../config/logging.js';
import authMiddleware from '../middleware/authMiddleware.js';
import checkPermissionMiddleware from '../middleware/checkPermissionMiddleware.js';
const router = express.Router();
const csvPreviewBodySchema = z.object({
  csv: z.string().min(1).max(20_000_000),
  timezone: z.string().min(1).max(100).optional(),
});
const csvImportBodySchema = csvPreviewBodySchema.extend({
  timezone: z.string().min(1).max(100),
});

/**
 * @swagger
 * /integrations/hevy/csv/preview:
 *   post:
 *     summary: Preview a Hevy completed-workout CSV without importing it
 *     description: Saved routines are not present in Hevy workout-history CSV exports. Supply an IANA timezone to validate local workout timestamps before import.
 *     tags: [External Integrations]
 *     security:
 *       - cookieAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [csv]
 *             properties:
 *               csv:
 *                 type: string
 *               timezone:
 *                 type: string
 *                 example: Europe/Berlin
 *     responses:
 *       200:
 *         description: Parsed workout preview; no diary data is written.
 *       400:
 *         description: Invalid CSV, timezone, or local timestamp.
 */
router.post('/csv/preview', authMiddleware.authenticate, async (req, res) => {
  const body = csvPreviewBodySchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ message: 'Invalid request body' });
  }
  let preview;
  let workouts;
  try {
    preview = previewHevyWorkoutCsv(body.data.csv);
    workouts = body.data.timezone
      ? hevyCsvWorkoutsForImport(preview, body.data.timezone)
      : [];
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Invalid Hevy CSV',
    });
  }
  try {
    const sourceIds = workouts.flatMap((workout) =>
      (workout.exercises ?? []).map(
        (exercise) => `${workout.id}_${exercise.index}`
      )
    );
    const existingSourceIds = new Set(
      sourceIds.length > 0
        ? await exerciseEntryRepository.getExistingExerciseSourceIds(
            req.userId,
            'Hevy',
            sourceIds
          )
        : []
    );
    const review = body.data.timezone
      ? await getHevyCsvReview(req.userId, workouts, body.data.timezone)
      : { exerciseMappings: [], potentialDuplicateSessions: [] };
    return res.status(200).json({
      ...preview,
      timezoneValidated: Boolean(body.data.timezone),
      reviewAvailable: Boolean(body.data.timezone),
      ...review,
      alreadyImportedWorkoutIndices: workouts.flatMap((workout, index) =>
        (workout.exercises ?? []).some((exercise) =>
          existingSourceIds.has(`${workout.id}_${exercise.index}`)
        )
          ? [index]
          : []
      ),
    });
  } catch (error) {
    log('error', 'Hevy CSV preview could not check existing workouts', error);
    return res.status(500).json({ message: 'Hevy CSV preview failed' });
  }
});

/**
 * @swagger
 * /integrations/hevy/csv/import:
 *   post:
 *     summary: Import completed workouts from a Hevy history CSV
 *     description: Requires an IANA timezone. Re-imports skip existing source IDs and preserve local edits. Saved routines are not contained in the CSV.
 *     tags: [External Integrations]
 *     security:
 *       - cookieAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [csv, timezone]
 *             properties:
 *               csv:
 *                 type: string
 *               timezone:
 *                 type: string
 *                 example: Europe/Berlin
 *     responses:
 *       200:
 *         description: Per-workout import counts; no saved routines are imported.
 *       207:
 *         description: Some workouts failed; inspect the failed array.
 *       400:
 *         description: Invalid request, CSV, timezone, or local timestamp.
 */
router.post(
  '/csv/import',
  authMiddleware.authenticate,
  checkPermissionMiddleware('diary'),
  async (req, res) => {
    const body = csvImportBodySchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ message: 'Invalid request body' });
    }
    let workouts;
    try {
      const preview = previewHevyWorkoutCsv(body.data.csv);
      workouts = hevyCsvWorkoutsForImport(preview, body.data.timezone);
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : 'Invalid Hevy CSV',
      });
    }
    try {
      const result = await processHevyWorkouts(
        req.userId,
        req.authenticatedUserId || req.userId,
        workouts,
        body.data.timezone
      );
      return res.status(result.failed.length > 0 ? 207 : 200).json({
        ...result,
        submitted: workouts.length,
        savedRoutinesIncluded: false,
      });
    } catch (error) {
      log(
        'error',
        `Hevy CSV import failed for user ${req.userId}: ${error instanceof Error ? error.message : String(error)}`
      );
      return res.status(500).json({ message: 'Hevy CSV import failed' });
    }
  }
);
/**
 * @swagger
 * /integrations/hevy/sync:
 *   post:
 *     summary: Manually trigger a Hevy data sync
 *     description: An optional startDate/endDate pair limits completed workouts to inclusive calendar days in the user's timezone. Saved routines are synced separately regardless of the workout range. Partial imports or fetch failures return 207 and leave last_sync_at unchanged for retry.
 *     tags: [External Integrations]
 *     responses:
 *       200:
 *         description: Workouts and saved routines synced without errors.
 *       207:
 *         description: Partial sync; inspect workouts.failed, routines.failed, and fetchWarnings.
 */
router.post('/sync', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.userId;

    const createdByUserId = req.userId;
    const { providerId, startDate, endDate } = req.body;
    const hasDateRange = startDate !== undefined || endDate !== undefined;
    if (
      hasDateRange &&
      (typeof startDate !== 'string' ||
        typeof endDate !== 'string' ||
        !isDayString(startDate) ||
        !isDayString(endDate) ||
        startDate > endDate)
    ) {
      return res.status(400).json({
        message: 'Provide a valid Hevy sync date range (YYYY-MM-DD)',
      });
    }
    const { dataSource, saveMockData } = await resolveMockDataOptions(
      req.body,
      req.authenticatedUserId
    );
    const fullSync =
      req.query.fullSync === 'true' || req.body.fullSync === true;
    log(
      'info',
      `[hevyRoutes] Manual sync triggered for user ${userId}${startDate ? ` from ${startDate}` : ''}${endDate ? ` to ${endDate}` : ''}`
    );
    const result = await hevyService.syncHevyData(
      userId,
      createdByUserId,
      fullSync,
      providerId,
      startDate,
      endDate,
      dataSource,
      saveMockData
    );
    res.status(result.partial ? 207 : 200).json(result);
  } catch (error) {
    // @ts-expect-error TS(2571): Object is of type 'unknown'.
    log('error', `Error initiating manual Hevy sync: ${error.message}`);
    // Check for 401 Unauthorized from Hevy API
    // @ts-expect-error TS(2571): Object is of type 'unknown'.
    if (error.message.includes('401')) {
      return res.status(401).json({
        message: 'Invalid Hevy API Key. Please check your key and try again.',
        // @ts-expect-error TS(2571): Object is of type 'unknown'.
        error: error.message,
      });
    }
    res.status(500).json({
      message: 'Error initiating manual Hevy sync',
      // @ts-expect-error TS(2571): Object is of type 'unknown'.
      error: error.message,
    });
  }
});
/**
 * @swagger
 * /integrations/hevy/status:
 *   get:
 *     summary: Get Hevy connection status
 *     tags: [External Integrations]
 */
router.get('/status', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.userId;
    const status = await hevyService.getStatus(userId);
    res.status(200).json(status);
  } catch (error) {
    // @ts-expect-error TS(2571): Object is of type 'unknown'.
    log('error', `Error getting Hevy status: ${error.message}`);
    res
      .status(500)
      // @ts-expect-error TS(2571): Object is of type 'unknown'.
      .json({ message: 'Error getting Hevy status', error: error.message });
  }
});
export default router;
