import express from 'express';
// @ts-expect-error TS(7016): supertest has no declaration in this workspace.
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';
import router from '../routes/v2/offlineMealRoutes.js';
import { createOfflineMealAction } from '../services/offlineMealActionService.js';
vi.mock('../middleware/checkPermissionMiddleware.js', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../services/offlineMealActionService.js', () => ({
  createOfflineMealAction: vi.fn(),
  OfflineMealActionError: class extends Error {},
}));
vi.mock('../services/AdaptiveTdeeService.js', () => ({
  clearUserTdeeCache: vi.fn(),
}));
const app = express();
app.use(express.json(), (req, _res, next) => {
  req.userId = 'owner';
  req.authenticatedUserId = req.headers['x-delegate'] ? 'delegate' : 'owner';
  next();
});
app.use('/api/v2/offline-meals', router);
beforeEach(() => vi.clearAllMocks());
it('rejects delegated writes before parsing or calling the service', async () => {
  expect(
    (
      await request(app)
        .post('/api/v2/offline-meals/actions')
        .set('x-delegate', 'yes')
        .send({})
    ).status
  ).toBe(403);
  expect(createOfflineMealAction).not.toHaveBeenCalled();
});
it('rejects incomplete snapshots instead of creating an aggregate food', async () => {
  expect(
    (
      await request(app)
        .post('/api/v2/offline-meals/actions')
        .send({ quantity: 2, meal: { name: 'Incomplete' } })
    ).status
  ).toBe(400);
  expect(createOfflineMealAction).not.toHaveBeenCalled();
});
