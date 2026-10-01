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
        req.query.include_activity === 'true'
      )
    );
  })
);

ownerRouter.get(
  '/daily-progress/:date',
  handle(async (req, res) => {
    const date = daySchema.parse(req.params.date);
    res.json(
      await getDailyProgress(
        req.userId,
        date,
        req.query.include_activity === 'true'
      )
    );
  })
);

const router = express.Router();
router.use(checkinRouter);
router.use(mealRouter);
router.use(supplementRouter);
router.use(ownerRouter);

export default router;
