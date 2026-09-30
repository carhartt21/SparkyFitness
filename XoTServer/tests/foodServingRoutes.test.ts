import { beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'supertest'
import request from 'supertest';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';

const { passThrough } = vi.hoisted(() => ({
  passThrough: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../middleware/authMiddleware.js', () => ({
  authenticate: passThrough,
}));
vi.mock('../middleware/checkPermissionMiddleware.js', () => ({
  default: () => passThrough,
}));
vi.mock('../services/foodService.js', () => ({ default: {} }));
vi.mock('../services/labelScanService.js', () => ({ default: {} }));
vi.mock('../services/foodPhotoEstimationService.js', () => ({ default: {} }));
vi.mock('../utils/backfillAllergens.js', () => ({
  backfillOffAllergens: vi.fn(),
}));
vi.mock('../utils/adminCheck.js', () => ({ resolveIsAdmin: vi.fn() }));
vi.mock('../middleware/imageUpload.js', () => ({
  uploadImages: passThrough,
  applyImageOrder: vi.fn(),
  finalizeUploadedImages: vi.fn(),
  cleanupStagedImages: vi.fn(),
  stagedFilesFrom: vi.fn(),
  parseMultipartBody: vi.fn(),
}));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));
vi.mock('../services/foodServingService.js', () => {
  class ServingSaveError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly details: Record<string, unknown> = {}
    ) {
      super(message);
    }
  }
  return {
    ServingSaveError,
    default: { saveFoodServings: vi.fn(), getLastServing: vi.fn() },
  };
});

import foodServingService, {
  ServingSaveError,
} from '../services/foodServingService.js';
import routes from '../routes/foodCrudRoutes.js';

const FOOD = '00000000-0000-4000-8000-0000000000f0';

function appFor(actor: {
  userId: string;
  authenticatedUserId: string;
  originalUserId?: string;
}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = actor.userId;
    req.authenticatedUserId = actor.authenticatedUserId;
    if (actor.originalUserId) req.originalUserId = actor.originalUserId;
    next();
  });
  app.use('/api/foods', routes);
  return app;
}

const owner = appFor({ userId: 'owner', authenticatedUserId: 'owner' });

describe('food serving routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates the body before saving', async () => {
    const res = await request(owner)
      .put(`/api/foods/${FOOD}/servings`)
      .send({ servings: [{ serving_size: -1, serving_unit: 'g' }] });
    expect(res.status).toBe(400);
    expect(foodServingService.saveFoodServings).not.toHaveBeenCalled();
  });

  it('saves as the signed-in owner and returns the servings', async () => {
    vi.mocked(foodServingService.saveFoodServings).mockResolvedValue([]);
    const res = await request(owner)
      .put(`/api/foods/${FOOD}/servings`)
      .send({
        servings: [
          {
            serving_label: '  Medium  ',
            serving_size: 1,
            serving_unit: 'piece',
            metric_amount: 130,
            sort_order: 0,
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(foodServingService.saveFoodServings).toHaveBeenCalledWith(
      'owner',
      FOOD,
      expect.objectContaining({
        deleted_ids: [],
        servings: [
          expect.objectContaining({ serving_label: 'Medium', derive: true }),
        ],
      })
    );
  });

  it('passes conflict details through with the status', async () => {
    vi.mocked(foodServingService.saveFoodServings).mockRejectedValue(
      new ServingSaveError('In use', 409, {
        code: 'SERVING_IN_USE',
        template_assignments: 3,
      })
    );
    const res = await request(owner)
      .put(`/api/foods/${FOOD}/servings`)
      .send({ servings: [] });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'In use',
      code: 'SERVING_IN_USE',
      template_assignments: 3,
    });
  });

  it('reads the diary owner last serving on behalf of a delegate', async () => {
    vi.mocked(foodServingService.getLastServing).mockResolvedValue(null);
    const delegate = appFor({
      userId: 'owner',
      authenticatedUserId: 'family',
      originalUserId: 'family',
    });
    const res = await request(delegate).get(`/api/foods/${FOOD}/last-serving`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
    expect(foodServingService.getLastServing).toHaveBeenCalledWith(
      'owner',
      'family',
      FOOD
    );
  });
});
