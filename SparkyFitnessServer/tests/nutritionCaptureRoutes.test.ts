import express from 'express';
import { readFileSync } from 'node:fs';
// @ts-expect-error TS(7016): supertest has no declaration in this workspace.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import nutritionCaptureRoutes from '../routes/nutritionCaptureRoutes.js';
import * as repository from '../models/nutritionCaptureRepository.js';

vi.mock('../middleware/authMiddleware.js', () => ({
  authenticate: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    req.userId = String(req.headers['x-test-user'] || 'user-a');
    req.authenticatedUserId = req.userId;
    next();
  },
}));
vi.mock('../middleware/imageUpload.js', () => ({
  uploadSingleImage: (_req: unknown, _res: unknown, next: () => void) => next(),
  stagedFilesFrom: () => [],
  finalizeUploadedImages: vi.fn(),
  cleanupStagedImages: vi.fn(),
  removeOrphanedImages: vi.fn(),
  removeEntityImageDir: vi.fn(),
  MAX_IMAGE_COUNT: 10,
}));
vi.mock('../models/nutritionCaptureRepository.js', () => ({
  createNutritionCapture: vi.fn(),
  listNutritionCaptures: vi.fn(),
  getNutritionCapture: vi.fn(),
  getNutritionCaptureImage: vi.fn(),
  addNutritionCaptureImage: vi.fn(),
  deleteNutritionCaptureImage: vi.fn(),
  deleteNutritionCapture: vi.fn(),
}));

const captureId = 'd2e53cfe-9317-4a1b-acfa-571ccdd14835';
const imageId = '29321f6b-74b1-4ee0-91cc-7d3c86acfa22';
const payload = {
  id: captureId,
  capturedAt: '2026-09-23T12:00:00.000Z',
  consumedAt: '2026-09-23T12:00:00.000Z',
  entryDate: '2026-09-23',
};
const saved = {
  ...payload,
  user_id: 'user-a',
  completion_state: 'incomplete',
  images: [],
};
const app = express();
app.use('/api/nutrition-captures', nutritionCaptureRoutes);

describe('nutrition captures', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts a photo-only event without calories, AI, or food selection', async () => {
    vi.mocked(repository.createNutritionCapture).mockResolvedValue(saved);
    const response = await request(app)
      .post('/api/nutrition-captures')
      .send(payload);
    expect(response.status).toBe(200);
    expect(response.body.completion_state).toBe('incomplete');
    expect(response.body.calories).toBeUndefined();
    expect(repository.createNutritionCapture).toHaveBeenCalledWith(
      'user-a',
      payload
    );
  });

  it('returns the same logical ID on a repeated request', async () => {
    vi.mocked(repository.createNutritionCapture).mockResolvedValue(saved);
    const first = await request(app)
      .post('/api/nutrition-captures')
      .send(payload);
    const retry = await request(app)
      .post('/api/nutrition-captures')
      .send(payload);
    expect(first.body.id).toBe(captureId);
    expect(retry.body.id).toBe(captureId);
  });

  it('does not expose another owner’s capture or image', async () => {
    vi.mocked(repository.getNutritionCapture).mockResolvedValue(null);
    vi.mocked(repository.getNutritionCaptureImage).mockResolvedValue(null);
    const capture = await request(app)
      .get(`/api/nutrition-captures/${captureId}`)
      .set('x-test-user', 'user-b');
    const image = await request(app)
      .get(`/api/nutrition-captures/${captureId}/images/${imageId}/file`)
      .set('x-test-user', 'user-b');
    expect(capture.status).toBe(404);
    expect(image.status).toBe(404);
    expect(repository.getNutritionCaptureImage).toHaveBeenCalledWith(
      'user-b',
      captureId,
      imageId
    );
  });

  it('migrates to nullable nutrition with owner-scoped image policies', () => {
    const sql = readFileSync(
      new URL(
        '../db/migrations/20260923020000_add_nutrition_captures.sql',
        import.meta.url
      ),
      'utf8'
    );
    expect(sql).toContain('completion_state');
    expect(sql).not.toMatch(/calories\s+numeric/i);
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('public.authenticated_user_id()');
    expect(sql).toContain('nutrition_capture_images_owner');
  });
});
