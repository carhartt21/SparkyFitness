import { vi, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error supertest has no declaration in this package
import request from 'supertest';
import express from 'express';
import type { RequestHandler } from 'express';
import reportRoutes from '../routes/reportRoutes.js';
import { canAccessUserData } from '../utils/permissionUtils.js';
import { getNutrientCoverage } from '../models/nutrientCoverageRepository.js';

vi.mock('../middleware/authMiddleware.js', () => ({
  authenticate: ((req, _res, next) => {
    req.userId = '10000000-0000-4000-8000-000000000001';
    req.authenticatedUserId = '10000000-0000-4000-8000-000000000002';
    next();
  }) satisfies RequestHandler,
}));
vi.mock('../utils/permissionUtils.js', () => ({ canAccessUserData: vi.fn() }));
vi.mock('../models/nutrientCoverageRepository.js', () => ({
  getNutrientCoverage: vi.fn(),
}));
vi.mock('../services/reportService.js', () => ({ default: {} }));
const app = express();
app.use('/api/reports', reportRoutes);
const path = '/api/reports/nutrient-coverage';
const dates = '?startDate=2026-10-01&endDate=2026-10-02';
describe('nutrient coverage route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canAccessUserData).mockResolvedValue(true);
    vi.mocked(getNutrientCoverage).mockResolvedValue({});
  });
  it('preserves the authenticated actor when reading a delegated profile', async () => {
    expect((await request(app).get(path + dates)).status).toBe(200);
    expect(getNutrientCoverage).toHaveBeenCalledWith(
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '2026-10-01',
      '2026-10-02'
    );
  });
  it.each([
    '?startDate=no&endDate=2026-10-02',
    '?startDate=2026-10-03&endDate=2026-10-02',
    dates + '&userId=invalid',
  ])('rejects malformed range or identity: %s', async (query) => {
    expect((await request(app).get(path + query)).status).toBe(400);
    expect(getNutrientCoverage).not.toHaveBeenCalled();
  });
  it('denies access before querying records', async () => {
    vi.mocked(canAccessUserData).mockResolvedValue(false);
    expect((await request(app).get(path + dates)).status).toBe(403);
    expect(getNutrientCoverage).not.toHaveBeenCalled();
  });
});
