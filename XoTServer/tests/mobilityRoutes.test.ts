import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
// @ts-expect-error Supertest has no local declaration package.
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import router from '../routes/v2/mobilityRoutes.js';
import {
  applyMobilityOperation,
  getMobilitySnapshot,
} from '../services/mobilityService.js';
vi.mock('../services/mobilityService.js', () => ({
  applyMobilityOperation: vi.fn(),
  getMobilitySnapshot: vi.fn(),
  MobilityConflictError: class extends Error {},
  MobilityNotFoundError: class extends Error {},
  MobilityValidationError: class extends Error {},
}));
vi.mock('../middleware/requireSelfMiddleware.js', () => ({
  requireSelfActor: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => next(),
}));
const userId = randomUUID();
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.authenticatedUserId = userId;
  next();
});
app.use('/mobility', router);
const operation = {
  operationId: randomUUID(),
  expectedRevision: 0,
  mutation: {
    kind: 'routine',
    deleted: false,
    data: {
      id: randomUUID(),
      name: 'Synthetic mobility',
      cue: 'off',
      reminderTime: null,
      createdAt: '2026-09-30T10:00:00Z',
      updatedAt: '2026-09-30T10:00:00Z',
      steps: [
        {
          id: randomUUID(),
          name: 'Reach',
          instructions: '',
          side: 'both',
          kind: 'timed',
          durationSeconds: 30,
          transitionSeconds: 0,
        },
      ],
    },
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(applyMobilityOperation).mockResolvedValue({ revision: 1 });
});
describe('mobility authenticated API ingress', () => {
  it.each(['phone', 'web', 'mcp'])(
    'ignores a client-asserted %s source',
    async (claimed) => {
      const response = await request(app)
        .post('/mobility')
        .set('X-XoT-Client', claimed)
        .send(operation);
      expect(response.status).toBe(200);
      expect(applyMobilityOperation).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ operationId: operation.operationId }),
        'api'
      );
    }
  );
  it('GET only invokes the read-only snapshot projection', async () => {
    vi.mocked(getMobilitySnapshot).mockResolvedValue({
      timezone: 'Europe/Berlin',
      routines: [],
      schedules: [],
      plans: [],
      sessions: [],
    });
    expect(
      (await request(app).get('/mobility?from=2026-09-01&to=2026-09-30')).status
    ).toBe(200);
    expect(getMobilitySnapshot).toHaveBeenCalledWith(
      userId,
      '2026-09-01',
      '2026-09-30'
    );
    expect(applyMobilityOperation).not.toHaveBeenCalled();
  });
});
