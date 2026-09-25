import { beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error supertest has no bundled declarations in this workspace
import request from 'supertest';
import express from 'express';
import hevyRoutes from '../routes/hevyRoutes.js';
import { processHevyWorkouts } from '../integrations/hevy/hevyDataProcessor.js';
import hevyService from '../integrations/hevy/hevyService.js';
import exerciseEntryRepository from '../models/exerciseEntry.js';
import { getHevyCsvReview } from '../integrations/hevy/hevyCsvReview.js';

vi.mock('../middleware/authMiddleware.js', () => ({
  default: {
    authenticate: vi.fn((req, _res, next) => {
      req.userId = 'user-1';
      req.authenticatedUserId = 'user-1';
      next();
    }),
  },
}));
vi.mock('../middleware/checkPermissionMiddleware.js', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../integrations/hevy/hevyDataProcessor.js', () => ({
  processHevyWorkouts: vi.fn(),
  default: { processHevyWorkouts: vi.fn() },
}));
vi.mock('../integrations/hevy/hevyService.js', () => ({
  default: { syncHevyData: vi.fn() },
}));
vi.mock('../models/exerciseEntry.js', () => ({
  default: { getExistingExerciseSourceIds: vi.fn() },
}));
vi.mock('../integrations/hevy/hevyCsvReview.js', () => ({
  getHevyCsvReview: vi.fn(),
}));

const csv = [
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
  'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Bench Press,1,,0,warmup,40,10,,0,',
  'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Bench Press,1,,1,dropset,30,12,,0,',
].join('\n');

describe('POST /integrations/hevy/csv/preview', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(
      exerciseEntryRepository.getExistingExerciseSourceIds
    ).mockResolvedValue([]);
    vi.mocked(getHevyCsvReview).mockResolvedValue({
      exerciseMappings: [{ title: 'Bench Press', status: 'existing-name' }],
      potentialDuplicateSessions: [],
    });
    app = express();
    app.use(express.json());
    app.use('/integrations/hevy', hevyRoutes);
  });

  it('previews completed workouts and validates their local times without writing', async () => {
    const response = await request(app)
      .post('/integrations/hevy/csv/preview')
      .send({ csv, timezone: 'Europe/Berlin' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      rowCount: 2,
      savedRoutinesIncluded: false,
      timezoneRequired: true,
      timezoneValidated: true,
      reviewAvailable: true,
      exerciseMappings: [{ title: 'Bench Press', status: 'existing-name' }],
      potentialDuplicateSessions: [],
      alreadyImportedWorkoutIndices: [],
      workouts: [
        {
          title: 'Sample A',
          exercises: [
            {
              supersetId: '1',
              sets: [{ type: 'warmup' }, { type: 'dropset' }],
            },
          ],
        },
      ],
    });
  });

  it('identifies previously imported source IDs before any write', async () => {
    vi.mocked(
      exerciseEntryRepository.getExistingExerciseSourceIds
    ).mockImplementationOnce(async (_userId, _source, sourceIds) => [
      sourceIds[0]!,
    ]);

    const response = await request(app)
      .post('/integrations/hevy/csv/preview')
      .send({ csv, timezone: 'Europe/Berlin' });

    expect(response.status).toBe(200);
    expect(response.body.alreadyImportedWorkoutIndices).toEqual([0]);
    expect(
      exerciseEntryRepository.getExistingExerciseSourceIds
    ).toHaveBeenCalledWith(
      'user-1',
      'Hevy',
      expect.arrayContaining([expect.stringMatching(/^csv_[a-f0-9]{64}_0$/)])
    );
    expect(processHevyWorkouts).not.toHaveBeenCalled();
    expect(getHevyCsvReview).toHaveBeenCalledWith(
      'user-1',
      expect.arrayContaining([expect.objectContaining({ title: 'Sample A' })]),
      'Europe/Berlin'
    );
  });

  it('allows a raw preview without claiming the timezone was checked', async () => {
    const response = await request(app)
      .post('/integrations/hevy/csv/preview')
      .send({ csv });

    expect(response.status).toBe(200);
    expect(response.body.timezoneValidated).toBe(false);
    expect(response.body.reviewAvailable).toBe(false);
    expect(response.body.alreadyImportedWorkoutIndices).toEqual([]);
    expect(
      exerciseEntryRepository.getExistingExerciseSourceIds
    ).not.toHaveBeenCalled();
    expect(getHevyCsvReview).not.toHaveBeenCalled();
  });

  it('rejects invalid request bodies and invalid timestamps', async () => {
    const invalidBody = await request(app)
      .post('/integrations/hevy/csv/preview')
      .send({ csv: '' });
    expect(invalidBody.status).toBe(400);

    const invalidTime = await request(app)
      .post('/integrations/hevy/csv/preview')
      .send({
        csv: csv.replace('23 Sep 2026, 21:42', '25 Oct 2026, 02:30'),
        timezone: 'Europe/Berlin',
      });
    expect(invalidTime.status).toBe(400);
    expect(processHevyWorkouts).not.toHaveBeenCalled();
  });

  it('imports converted workouts with an accurate result and no routine claim', async () => {
    vi.mocked(processHevyWorkouts).mockResolvedValueOnce({
      imported: 1,
      skipped: 0,
      failed: [],
    });
    const response = await request(app)
      .post('/integrations/hevy/csv/import')
      .send({ csv, timezone: 'Europe/Berlin' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      submitted: 1,
      imported: 1,
      skipped: 0,
      failed: [],
      savedRoutinesIncluded: false,
    });
    expect(processHevyWorkouts).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      [
        expect.objectContaining({
          start_time: '2026-09-23T19:42:00.000Z',
        }),
      ],
      'Europe/Berlin'
    );
  });

  it('reports partial failures and refuses invalid local times before writing', async () => {
    vi.mocked(processHevyWorkouts).mockResolvedValueOnce({
      imported: 0,
      skipped: 0,
      failed: [{ id: 'csv_example', message: 'set write failed' }],
    });
    const partial = await request(app)
      .post('/integrations/hevy/csv/import')
      .send({ csv, timezone: 'Europe/Berlin' });
    expect(partial.status).toBe(207);
    expect(partial.body.failed).toHaveLength(1);

    vi.clearAllMocks();
    const invalid = await request(app)
      .post('/integrations/hevy/csv/import')
      .send({ csv, timezone: 'not/a-zone' });
    expect(invalid.status).toBe(400);
    expect(processHevyWorkouts).not.toHaveBeenCalled();
  });
});

describe('POST /integrations/hevy/sync', () => {
  it.each([
    { startDate: '2026-09-23' },
    { startDate: '2026-02-30', endDate: '2026-09-23' },
    { startDate: '2026-09-24', endDate: '2026-09-23' },
  ])('rejects an invalid calendar-day range before syncing', async (range) => {
    const app = express();
    app.use(express.json());
    app.use('/integrations/hevy', hevyRoutes);

    const response = await request(app)
      .post('/integrations/hevy/sync')
      .send({ providerId: 'provider-1', ...range });

    expect(response.status).toBe(400);
    expect(hevyService.syncHevyData).not.toHaveBeenCalled();
  });

  it('returns 207 with routine failures so a partial API sync is visible', async () => {
    vi.mocked(hevyService.syncHevyData).mockResolvedValueOnce({
      success: false,
      partial: true,
      processedCount: 0,
      source: 'live_api',
      workouts: { imported: 0, skipped: 0, failed: [] },
      routines: {
        imported: 0,
        skipped: 0,
        failed: [{ id: 'routine-1', message: 'preset write failed' }],
      },
      fetchWarnings: [],
    });
    const app = express();
    app.use(express.json());
    app.use('/integrations/hevy', hevyRoutes);

    const response = await request(app)
      .post('/integrations/hevy/sync')
      .send({ providerId: 'provider-1' });

    expect(response.status).toBe(207);
    expect(response.body.routines.failed).toEqual([
      { id: 'routine-1', message: 'preset write failed' },
    ]);
  });
});
