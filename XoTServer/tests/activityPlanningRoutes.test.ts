import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
// @ts-expect-error Supertest has no local declaration package.
import request from 'supertest';
import router from '../routes/v2/activityPlanningRoutes.js';
import {
  getActivityPlanning,
  resolveActivityPlanning,
  ActivityPlanningConflictError,
} from '../services/activityPlanningService.js';
vi.unmock('../middleware/requireSelfMiddleware.js');
vi.mock('../services/activityPlanningService.js', () => ({
  getActivityPlanning: vi.fn(),
  resolveActivityPlanning: vi.fn(),
  ActivityPlanningConflictError: class extends Error {},
  ActivityPlanningNotFoundError: class extends Error {},
  ActivityPlanningValidationError: class extends Error {},
}));
function app(delegated = false) {
  const result = express();
  result.use(express.json());
  result.use((req, _res, next) => {
    req.authenticatedUserId = 'owner';
    req.originalUserId = 'owner';
    req.userId = delegated ? 'other' : 'owner';
    next();
  });
  result.use('/activity', router);
  return result;
}
beforeEach(() => vi.clearAllMocks());
describe('owner activity API', () => {
  it('rejects delegates for reads and writes', async () => {
    expect(
      (
        await request(app(true)).get(
          '/activity?start_date=2026-10-01&end_date=2026-10-07'
        )
      ).status
    ).toBe(403);
    expect((await request(app(true)).put('/activity').send({})).status).toBe(
      403
    );
    expect(getActivityPlanning).not.toHaveBeenCalled();
    expect(resolveActivityPlanning).not.toHaveBeenCalled();
  });
  it('bounds reads and keeps GET pure', async () => {
    expect(
      (
        await request(app()).get(
          '/activity?start_date=2026-10-01&end_date=2026-11-11'
        )
      ).status
    ).toBe(200);
    expect(getActivityPlanning).toHaveBeenCalledWith(
      'owner',
      '2026-10-01',
      '2026-11-11'
    );
    expect(
      (
        await request(app()).get(
          '/activity?start_date=2026-10-01&end_date=2026-11-12'
        )
      ).status
    ).toBe(400);
    expect(
      (
        await request(app()).get(
          '/activity?start_date=2026-02-30&end_date=2026-03-01'
        )
      ).status
    ).toBe(400);
    expect(resolveActivityPlanning).not.toHaveBeenCalled();
  });
  it('validates payloads and maps stale decisions to 409', async () => {
    const operation = {
      occurrence_id: 'workout:1:2:2026-10-01',
      expected_revision: 0,
      action: 'skip',
    };
    vi.mocked(resolveActivityPlanning).mockRejectedValue(
      new ActivityPlanningConflictError('Refresh.')
    );
    expect((await request(app()).put('/activity').send(operation)).status).toBe(
      409
    );
    expect(
      (
        await request(app())
          .put('/activity')
          .send({ ...operation, user_id: 'another' })
      ).status
    ).toBe(400);
  });
});
