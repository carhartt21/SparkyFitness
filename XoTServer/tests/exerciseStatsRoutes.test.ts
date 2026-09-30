import { vi, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
// @ts-expect-error TS(7016): no type declarations shipped for supertest
import request from 'supertest';
import exerciseStatsService from '../services/exerciseStatsService.js';
import { getExerciseReview } from '../services/exerciseReviewService.js';
import exerciseStatsRoutes from '../routes/exerciseStatsRoutes.js';

vi.mock('../services/exerciseStatsService.js', () => ({
  default: {
    getPersonalRecordMatrix: vi.fn(),
    getMatchedCourses: vi.fn(),
  },
}));
vi.mock('../services/exerciseReviewService.js', () => ({
  getExerciseReview: vi.fn(),
}));
vi.mock('../utils/permissionUtils.js', () => ({
  canAccessUserData: vi.fn().mockResolvedValue(true),
}));
vi.mock('../middleware/authMiddleware.js', () => ({
  // types/express.d.ts augments Request with userId/authenticatedUserId, so
  // this mock needs no `any` casts to stand in for the real middleware.
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.userId = 'user-123';
    req.authenticatedUserId = 'user-123';
    next();
  },
}));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));

const app = express();
app.use(express.json());
app.use('/exercise-stats', exerciseStatsRoutes);

const prMatrix = { cardioPRs: [], strength1RMs: [] };
const courses = { courses: [] };

beforeEach(() => {
  vi.clearAllMocks();
  (
    exerciseStatsService.getPersonalRecordMatrix as ReturnType<typeof vi.fn>
  ).mockResolvedValue(prMatrix);
  (
    exerciseStatsService.getMatchedCourses as ReturnType<typeof vi.fn>
  ).mockResolvedValue(courses);
  vi.mocked(getExerciseReview).mockResolvedValue({
    current: { startDate: '2026-09-21', endDate: '2026-09-25' },
    previous: { startDate: '2026-09-16', endDate: '2026-09-20' },
  } as Awaited<ReturnType<typeof getExerciseReview>>);
});

describe('GET /exercise-stats/review', () => {
  it('returns an explicit date window through the read-only service', async () => {
    const response = await request(app).get(
      '/exercise-stats/review?startDate=2026-09-21&endDate=2026-09-25'
    );
    expect(response.status).toBe(200);
    expect(getExerciseReview).toHaveBeenCalledWith(
      'user-123',
      '2026-09-21',
      '2026-09-25',
      undefined
    );
  });

  it('accepts explicit preceding dates for partial calendar periods', async () => {
    const response = await request(app).get(
      '/exercise-stats/review?startDate=2026-09-21&endDate=2026-09-25&previousStartDate=2026-09-14&previousEndDate=2026-09-18'
    );
    expect(response.status).toBe(200);
    expect(getExerciseReview).toHaveBeenCalledWith(
      'user-123',
      '2026-09-21',
      '2026-09-25',
      { startDate: '2026-09-14', endDate: '2026-09-18' }
    );
  });

  it.each([
    'startDate=2026-09-21',
    'startDate=2026-02-30&endDate=2026-03-01',
    'startDate=2026-09-25&endDate=2026-09-21',
    'startDate=2025-01-01&endDate=2026-09-25',
    'startDate=2026-09-21&endDate=2026-09-25&previousStartDate=2026-09-14',
    'startDate=2026-09-21&endDate=2026-09-25&previousStartDate=2026-09-26&previousEndDate=2026-09-30',
    'startDate=2026-09-21&endDate=2026-09-25&previousStartDate=2026-02-30&previousEndDate=2026-09-20',
    'startDate=2026-09-21&endDate=2026-09-25&previousStartDate=2020-01-01&previousEndDate=2020-01-05',
  ])('rejects an invalid review range: %s', async (query) => {
    const response = await request(app).get(`/exercise-stats/review?${query}`);
    expect(response.status).toBe(400);
    expect(getExerciseReview).not.toHaveBeenCalled();
  });
});

// The routes advertise unitSystem as an enum. Casting the raw query string
// instead of validating it made `unitSystem=invalid` silently fall through to
// metric, so a caller who misspelled "imperial" got the wrong units back with
// a 200 and no indication anything was wrong.
describe.each([
  ['/exercise-stats/prs', 'getPersonalRecordMatrix'] as const,
  ['/exercise-stats/matched-courses', 'getMatchedCourses'] as const,
])('GET %s unitSystem validation', (path, serviceMethod) => {
  it('defaults to metric when unitSystem is omitted', async () => {
    const res = await request(app).get(path);
    expect(res.status).toBe(200);
    expect(exerciseStatsService[serviceMethod]).toHaveBeenCalledWith(
      'user-123',
      'metric'
    );
  });

  it.each(['metric', 'imperial'])('accepts %s', async (unitSystem) => {
    const res = await request(app).get(`${path}?unitSystem=${unitSystem}`);
    expect(res.status).toBe(200);
    expect(exerciseStatsService[serviceMethod]).toHaveBeenCalledWith(
      'user-123',
      unitSystem
    );
  });

  it('rejects an unsupported unitSystem with 400', async () => {
    const res = await request(app).get(`${path}?unitSystem=invalid`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unitSystem/i);
    expect(exerciseStatsService[serviceMethod]).not.toHaveBeenCalled();
  });

  it('rejects a repeated unitSystem parameter with 400', async () => {
    // Express parses ?a=1&a=2 into an array, which is not the documented enum.
    const res = await request(app).get(
      `${path}?unitSystem=metric&unitSystem=imperial`
    );
    expect(res.status).toBe(400);
    expect(exerciseStatsService[serviceMethod]).not.toHaveBeenCalled();
  });

  it('rejects a casing variant with 400', async () => {
    const res = await request(app).get(`${path}?unitSystem=Imperial`);
    expect(res.status).toBe(400);
    expect(exerciseStatsService[serviceMethod]).not.toHaveBeenCalled();
  });
});
