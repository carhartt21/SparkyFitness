import { beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'supertest'
import request from 'supertest';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';

const permissionCalls: string[] = [];

vi.mock('../middleware/checkPermissionMiddleware.js', () => ({
  default:
    (permission: string) =>
    (_req: Request, _res: Response, next: NextFunction) => {
      permissionCalls.push(permission);
      next();
    },
}));

vi.mock('../models/dailyTrackingRepository.js', () => {
  class DailyTrackingError extends Error {
    constructor(
      readonly statusCode: number,
      message: string
    ) {
      super(message);
    }
  }
  return {
    DailyTrackingError,
    createHabit: vi.fn(),
    createHealthContextPeriod: vi.fn(),
    deleteDailyCheckin: vi.fn(),
    deleteHabit: vi.fn(),
    deleteHealthContextPeriod: vi.fn(),
    deleteMeasurementReminder: vi.fn(),
    getDailyCheckin: vi.fn(),
    getDailyTrackingPreferences: vi.fn(),
    listDailyCheckins: vi.fn(),
    listHabitLogs: vi.fn(),
    listHabits: vi.fn(),
    listHealthContextPeriods: vi.fn(),
    listMeasurementReminders: vi.fn(),
    logHabit: vi.fn(),
    saveDailyCheckin: vi.fn(),
    setMealStatus: vi.fn(),
    skipDailyCheckin: vi.fn(),
    updateDailyTrackingPreferences: vi.fn(),
    updateHabit: vi.fn(),
    updateHealthContextPeriod: vi.fn(),
    upsertMeasurementReminder: vi.fn(),
  };
});

vi.mock('../services/dailyProgressService.js', () => ({
  getDailyProgress: vi.fn(),
  getMealTrackingStatus: vi.fn(),
  getSupplementDoses: vi.fn(),
}));

vi.mock('../config/logging.js', () => ({ log: vi.fn() }));

import * as repo from '../models/dailyTrackingRepository.js';
import * as service from '../services/dailyProgressService.js';
import routes from '../routes/v2/dailyTrackingRoutes.js';

function appFor(actor: { userId: string; authenticatedUserId: string }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = actor.userId;
    req.authenticatedUserId = actor.authenticatedUserId;
    next();
  });
  app.use('/api/v2/tracking', routes);
  return app;
}

const self = appFor({ userId: 'owner', authenticatedUserId: 'owner' });
const delegate = appFor({ userId: 'owner', authenticatedUserId: 'family' });

describe('daily tracking routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionCalls.length = 0;
  });

  it('guards check-in routes with the check-in permission only', async () => {
    vi.mocked(repo.getDailyCheckin).mockResolvedValue(null);
    const res = await request(self).get('/api/v2/tracking/checkins/2026-09-28');
    expect(res.status).toBe(200);
    expect(permissionCalls).toEqual(['checkin']);
  });

  it('guards meal status with the diary permission, not check-in', async () => {
    vi.mocked(service.getMealTrackingStatus).mockResolvedValue({
      entry_date: '2026-09-28',
      meals: [],
      coverage: {
        total: 0,
        resolved: 0,
        complete: 0,
        skipped: 0,
        incomplete: 0,
        pending: 0,
      },
    });
    const res = await request(self).get(
      '/api/v2/tracking/meal-status/2026-09-28'
    );
    expect(res.status).toBe(200);
    expect(permissionCalls).toEqual(['diary']);
  });

  it('rejects invalid dates and oversized ranges', async () => {
    expect(
      (await request(self).get('/api/v2/tracking/checkins/2026-02-30')).status
    ).toBe(400);
    const res = await request(self).get(
      '/api/v2/tracking/habit-logs?start_date=2024-01-01&end_date=2026-01-01'
    );
    expect(res.status).toBe(400);
    expect(repo.listHabitLogs).not.toHaveBeenCalled();
  });

  it('does not accept responses on the skip endpoint body', async () => {
    vi.mocked(repo.skipDailyCheckin).mockResolvedValue({
      id: 'c',
      entry_date: '2026-09-28',
      state: 'skipped',
      question_version: 1,
      overall_day: null,
      energy: null,
      stress: null,
      sleep_quality: null,
      nutrition_on_track: null,
      activity: null,
      note: null,
      tags: [],
      completed_at: null,
      skipped_at: 't',
      updated_at: 't',
    });
    const res = await request(self)
      .post('/api/v2/tracking/checkins/2026-09-28/skip')
      .send({ energy: 5 });
    expect(res.status).toBe(200);
    expect(repo.skipDailyCheckin).toHaveBeenCalledWith(
      'owner',
      'owner',
      '2026-09-28'
    );
  });

  it('refuses a "skipped" state on the save endpoint', async () => {
    const res = await request(self)
      .put('/api/v2/tracking/checkins/2026-09-28')
      .send({ state: 'skipped' });
    expect(res.status).toBe(400);
    expect(repo.saveDailyCheckin).not.toHaveBeenCalled();
  });

  it('maps repository errors to their status', async () => {
    vi.mocked(repo.saveDailyCheckin).mockRejectedValue(
      new repo.DailyTrackingError(400, 'Add at least one answer.')
    );
    const res = await request(self)
      .put('/api/v2/tracking/checkins/2026-09-28')
      .send({ state: 'completed' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Add at least one answer.');
  });

  it('rejects a target on completion habits', async () => {
    const res = await request(self)
      .post('/api/v2/tracking/habits')
      .send({ name: 'Stretch', habit_type: 'completion', target: 3 });
    expect(res.status).toBe(400);
    expect(repo.createHabit).not.toHaveBeenCalled();
  });

  it('keeps an explicit 0 habit value', async () => {
    vi.mocked(repo.logHabit).mockResolvedValue({
      habit_id: '00000000-0000-4000-8000-000000000001',
      entry_date: '2026-09-28',
      value: 0,
      recorded_at: 't',
    });
    const res = await request(self)
      .put('/api/v2/tracking/habits/00000000-0000-4000-8000-000000000001/logs')
      .send({ entry_date: '2026-09-28', value: 0 });
    expect(res.status).toBe(200);
    expect(repo.logHabit).toHaveBeenCalledWith(
      'owner',
      'owner',
      '00000000-0000-4000-8000-000000000001',
      '2026-09-28',
      0
    );
  });

  it('rejects an end date before the start date for context periods', async () => {
    const res = await request(self)
      .post('/api/v2/tracking/context-periods')
      .send({
        kind: 'illness',
        start_date: '2026-09-20',
        end_date: '2026-09-10',
      });
    expect(res.status).toBe(400);
  });

  it('rejects injury-only fields on other context kinds', async () => {
    const res = await request(self)
      .post('/api/v2/tracking/context-periods')
      .send({ kind: 'vacation', start_date: '2026-09-20', body_area: 'Knee' });
    expect(res.status).toBe(400);
  });

  it.each([
    '/api/v2/tracking/context-periods',
    '/api/v2/tracking/measurement-reminders',
    '/api/v2/tracking/preferences',
    '/api/v2/tracking/daily-progress/2026-09-28',
  ])('keeps %s owner-only in a delegated context', async (path) => {
    const res = await request(delegate).get(path);
    expect(res.status).toBe(403);
  });

  it('lets a delegate with check-in access read check-ins', async () => {
    vi.mocked(repo.getDailyCheckin).mockResolvedValue(null);
    const res = await request(delegate).get(
      '/api/v2/tracking/checkins/2026-09-28'
    );
    expect(res.status).toBe(200);
  });
});
