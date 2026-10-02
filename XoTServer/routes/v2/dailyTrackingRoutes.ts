import { summarizeDailyProgressItems } from '@workspace/shared';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { z } from 'zod';
import {
  createHabitRequestSchema,
  createHealthContextPeriodRequestSchema,
  logHabitRequestSchema,
  saveDailyCheckinRequestSchema,
  setMealDayStatusRequestSchema,
  updateDailyTrackingPreferencesRequestSchema,
  updateHabitRequestSchema,
  updateHealthContextPeriodRequestSchema,
  upsertMeasurementReminderRequestSchema,
} from '@workspace/shared';
import checkPermissionMiddleware from '../../middleware/checkPermissionMiddleware.js';
import { requireSelfActor } from '../../middleware/requireSelfMiddleware.js';
import {
  createHabit,
  createHealthContextPeriod,
  DailyTrackingError,
  deleteDailyCheckin,
  deleteHabit,
  deleteHealthContextPeriod,
  deleteMeasurementReminder,
  getDailyCheckin,
  getDailyTrackingPreferences,
  listDailyCheckins,
  listHabitLogs,
  listHabits,
  listHealthContextPeriods,
  listMeasurementReminders,
  logHabit,
  saveDailyCheckin,
  setMealStatus,
  skipDailyCheckin,
  updateDailyTrackingPreferences,
  updateHabit,
  updateHealthContextPeriod,
  upsertMeasurementReminder,
} from '../../models/dailyTrackingRepository.js';
import {
  DAILY_PROGRESS_RANGE_MAX_DAYS,
  getDailyProgress,
  getDailyProgressRange,
  getMealTrackingStatus,
  getSupplementDoses,
} from '../../services/dailyProgressService.js';

/** Longest range a single history request may cover. */
export const MAX_TRACKING_RANGE_DAYS = 366;

const daySchema = z.iso.date();
const idSchema = z.uuid();
const rangeSchema = z
  .object({ start_date: daySchema, end_date: daySchema })
  .refine((range) => range.start_date <= range.end_date, {
    message: 'start_date must not be after end_date',
  })
  .refine(
    (range) =>
      (Date.parse(range.end_date) - Date.parse(range.start_date)) / 86_400_000 <
      MAX_TRACKING_RANGE_DAYS,
    { message: `Ranges cover at most ${MAX_TRACKING_RANGE_DAYS} days` }
  );

function actorOf(req: Request): string {
  return req.originalUserId || req.authenticatedUserId || req.userId;
}

type Handler = (req: Request, res: Response) => Promise<void>;

/** Maps validation and DailyTrackingError to 4xx; everything else to next(). */
function handle(handler: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof DailyTrackingError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request.',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

function sendOrNotFound(res: Response, found: boolean, what: string) {
  if (found) res.status(204).end();
  else res.status(404).json({ error: `${what} not found.` });
}

// --- Check-in and habits: check-in permission ---------------------------------

const checkinRouter = express.Router();
// Scoped by path: a router-level use() would also run for requests that are
// only passing through to the meal and owner routers below.
checkinRouter.use(
  ['/checkins', '/habits', '/habit-logs'],
  checkPermissionMiddleware('checkin')
);

checkinRouter.get(
  '/checkins',
  handle(async (req, res) => {
    const range = rangeSchema.parse(req.query);
    res.json(
      await listDailyCheckins(req.userId, range.start_date, range.end_date)
    );
  })
);

checkinRouter.get(
  '/checkins/:date',
  handle(async (req, res) => {
    const date = daySchema.parse(req.params.date);
    res.json(await getDailyCheckin(req.userId, date));
  })
);

checkinRouter.put(
  '/checkins/:date',
  handle(async (req, res) => {
    const date = daySchema.parse(req.params.date);
    const body = saveDailyCheckinRequestSchema.parse(req.body);
    res.json(await saveDailyCheckin(req.userId, actorOf(req), date, body));
  })
);

checkinRouter.post(
  '/checkins/:date/skip',
  handle(async (req, res) => {
    const date = daySchema.parse(req.params.date);
    res.json(await skipDailyCheckin(req.userId, actorOf(req), date));
  })
);

checkinRouter.delete(
  '/checkins/:date',
  handle(async (req, res) => {
    const date = daySchema.parse(req.params.date);
    sendOrNotFound(
      res,
      await deleteDailyCheckin(req.userId, actorOf(req), date),
      'Check-in'
    );
  })
);

/**
 * @openapi
 * /v2/tracking/habits:
 *   get:
 *     summary: List routine habits and wellness activity definitions
 *     tags: [Tracking]
 *     description: Check-in read permission required. Wellness definitions have category wellness, completion type, an empty days array and no reminder. include_inactive retains archived definitions for history.
 *     parameters:
 *       - in: query
 *         name: include_inactive
 *         schema: { type: boolean, default: false }
 *     responses:
 *       '200': { description: Array of habit definitions including their category }
 *       '403': { description: Check-in read permission required }
 *   post:
 *     summary: Create a routine habit or reusable wellness activity
 *     tags: [Tracking]
 *     description: Check-in write permission required. Wellness names are reused within the account; no activity is logged by creating a definition. Wellness activities cannot have a schedule, reminder, unit, target or step.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, habit_type]
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 50 }
 *               habit_type: { type: string, enum: [completion, count] }
 *               category: { type: string, enum: [habit, wellness], default: habit }
 *               days: { type: array, nullable: true, items: { type: integer, minimum: 0, maximum: 6 } }
 *     responses:
 *       '201': { description: Created or reused habit definition }
 *       '400': { description: Invalid habit or wellness configuration }
 *       '403': { description: Check-in write permission required }
 */
checkinRouter.get(
  '/habits',
  handle(async (req, res) => {
    res.json(
      await listHabits(req.userId, {
        includeInactive: req.query.include_inactive === 'true',
      })
    );
  })
);

checkinRouter.post(
  '/habits',
  handle(async (req, res) => {
    const body = createHabitRequestSchema.parse(req.body);
    res.status(201).json(await createHabit(req.userId, actorOf(req), body));
  })
);

checkinRouter.put(
  '/habits/:id',
  handle(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const body = updateHabitRequestSchema.parse(req.body);
    res.json(await updateHabit(req.userId, actorOf(req), id, body));
  })
);

checkinRouter.delete(
  '/habits/:id',
  handle(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    sendOrNotFound(res, await deleteHabit(req.userId, id), 'Habit');
  })
);

/**
 * @openapi
 * /v2/tracking/habit-logs:
 *   get:
 *     summary: Read dated habit and wellness activity logs
 *     tags: [Tracking]
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: habit_id
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200': { description: Latest explicit value per activity and calendar day; missing days are absent }
 *       '403': { description: Check-in read permission required }
 * /v2/tracking/habits/{id}/logs:
 *   put:
 *     summary: Save or clear one activity's selected calendar day
 *     tags: [Tracking]
 *     description: Wellness uses true to log an activity and null to undo that day. Other history is preserved. These records do not create exercise calories or health-platform workouts.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entry_date, value]
 *             properties:
 *               entry_date: { type: string, format: date }
 *               value: { nullable: true, oneOf: [{ type: boolean }, { type: number, minimum: 0 }] }
 *     responses:
 *       '200': { description: Saved log or null after undo }
 *       '400': { description: Invalid date or value }
 *       '403': { description: Check-in write permission required }
 */
checkinRouter.get(
  '/habit-logs',
  handle(async (req, res) => {
    const range = rangeSchema.parse(req.query);
    const habitId =
      req.query.habit_id === undefined
        ? undefined
        : idSchema.parse(req.query.habit_id);
    res.json(
      await listHabitLogs(req.userId, range.start_date, range.end_date, habitId)
    );
  })
);

checkinRouter.put(
  '/habits/:id/logs',
  handle(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const body = logHabitRequestSchema.parse(req.body);
    res.json(
      await logHabit(req.userId, actorOf(req), id, body.entry_date, body.value)
    );
  })
);

// --- Meal status: diary permission ---------------------------------------------

const mealRouter = express.Router();
mealRouter.use('/meal-status', checkPermissionMiddleware('diary'));

mealRouter.get(
  '/meal-status/:date',
  handle(async (req, res) => {
    const date = daySchema.parse(req.params.date);
    res.json(await getMealTrackingStatus(req.userId, date));
  })
);

mealRouter.put(
  '/meal-status',
  handle(async (req, res) => {
    const body = setMealDayStatusRequestSchema.parse(req.body);
    await setMealStatus(
      req.userId,
      actorOf(req),
      body.entry_date,
      body.meal_type_id,
      body.status
    );
    res.json(await getMealTrackingStatus(req.userId, body.entry_date));
  })
);

// --- Owner-only: context, reminders, preferences, progress ----------------------

const ownerRouter = express.Router();
ownerRouter.use(
  [
    '/context-periods',
    '/measurement-reminders',
    '/preferences',
    '/daily-progress',
  ],
  requireSelfActor
);

ownerRouter.get(
  '/context-periods',
  handle(async (req, res) => {
    const start =
      req.query.start_date === undefined
        ? undefined
        : daySchema.parse(req.query.start_date);
    const end =
      req.query.end_date === undefined
        ? undefined
        : daySchema.parse(req.query.end_date);
    res.json(
      await listHealthContextPeriods(req.userId, {
        startDate: start,
        endDate: end,
      })
    );
  })
);

ownerRouter.post(
  '/context-periods',
  handle(async (req, res) => {
    const body = createHealthContextPeriodRequestSchema.parse(req.body);
    res.status(201).json(await createHealthContextPeriod(req.userId, body));
  })
);

ownerRouter.put(
  '/context-periods/:id',
  handle(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const body = updateHealthContextPeriodRequestSchema.parse(req.body);
    res.json(await updateHealthContextPeriod(req.userId, id, body));
  })
);

ownerRouter.delete(
  '/context-periods/:id',
  handle(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    sendOrNotFound(
      res,
      await deleteHealthContextPeriod(req.userId, id),
      'Context period'
    );
  })
);

ownerRouter.get(
  '/measurement-reminders',
  handle(async (req, res) => {
    res.json(await listMeasurementReminders(req.userId));
  })
);

ownerRouter.put(
  '/measurement-reminders',
  handle(async (req, res) => {
    const body = upsertMeasurementReminderRequestSchema.parse(req.body);
    res.json(await upsertMeasurementReminder(req.userId, body));
  })
);

ownerRouter.delete(
  '/measurement-reminders/:id',
  handle(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    sendOrNotFound(
      res,
      await deleteMeasurementReminder(req.userId, id),
      'Reminder'
    );
  })
);

ownerRouter.get(
  '/preferences',
  handle(async (req, res) => {
    res.json(await getDailyTrackingPreferences(req.userId));
  })
);

ownerRouter.patch(
  '/preferences',
  handle(async (req, res) => {
    const body = updateDailyTrackingPreferencesRequestSchema.parse(req.body);
    res.json(await updateDailyTrackingPreferences(req.userId, body));
  })
);

// Supplement doses are medication data: medication read permission applies.
const supplementRouter = express.Router();
supplementRouter.use('/supplements', checkPermissionMiddleware('medications'));

supplementRouter.get(
  '/supplements/:date',
  handle(async (req, res) => {
    const date = daySchema.parse(req.params.date);
    res.json(await getSupplementDoses(req.userId, date));
  })
);

ownerRouter.get(
  '/daily-progress',
  handle(async (req, res) => {
    const range = rangeSchema.parse(req.query);
    const days =
      (Date.parse(range.end_date) - Date.parse(range.start_date)) / 86_400_000 +
      1;
    if (days > DAILY_PROGRESS_RANGE_MAX_DAYS) {
      res.status(400).json({
        error: `Calendar ranges cover at most ${DAILY_PROGRESS_RANGE_MAX_DAYS} days.`,
      });
      return;
    }
    res.json(
      await getDailyProgressRange(
        req.userId,
        range.start_date,
        range.end_date,
        req.query.version === '2' || req.query.include_activity === 'true'
      )
    );
  })
);

ownerRouter.get(
  '/daily-progress/:date',
  handle(async (req, res) => {
    const date = daySchema.parse(req.params.date);
    const progress = await getDailyProgress(
      req.userId,
      date,
      req.query.version === '2' || req.query.include_activity === 'true'
    );
    res.json(
      req.query.version === '2' || req.query.include_activity === 'true'
        ? progress
        : {
            ...summarizeDailyProgressItems(
              date,
              progress.items.filter(
                (item) =>
                  item.domain !== 'goal' &&
                  item.domain !== 'workout' &&
                  item.domain !== 'activity'
              )
            ),
            version: 1,
          }
    );
  })
);

const router = express.Router();
router.use(checkinRouter);
router.use(mealRouter);
router.use(supplementRouter);
router.use(ownerRouter);

export default router;
