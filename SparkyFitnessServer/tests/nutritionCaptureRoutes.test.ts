import express from 'express';
import { readFileSync } from 'node:fs';
// @ts-expect-error TS(7016): supertest has no declaration in this workspace.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import nutritionCaptureRoutes from '../routes/nutritionCaptureRoutes.js';
import * as repository from '../models/nutritionCaptureRepository.js';
import foodEntryService from '../services/foodEntryService.js';

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
  getNutritionCaptureFoodEntry: vi.fn(),
  markNutritionCaptureComplete: vi.fn(),
}));
vi.mock('../services/foodEntryService.js', () => ({
  default: { createFoodEntry: vi.fn() },
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
  consumed_at: payload.consumedAt,
  entry_date: payload.entryDate,
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
    const startupPolicies = readFileSync(
      new URL('../db/rls_policies.sql', import.meta.url),
      'utf8'
    );
    expect(startupPolicies).toContain('CREATE POLICY nutrition_captures_owner');
    expect(startupPolicies).toContain(
      'CREATE POLICY nutrition_capture_images_owner'
    );
    expect(startupPolicies).toContain(
      'CREATE POLICY food_entries_offline_snapshot_insert_policy'
    );
  });

  it('links one food snapshot to the same owner and capture', () => {
    const sql = readFileSync(
      new URL(
        '../db/migrations/20260923030000_link_food_entries_to_nutrition_captures.sql',
        import.meta.url
      ),
      'utf8'
    );
    expect(sql).toContain('nutrition_capture_id uuid NULL');
    expect(sql).toContain('ON DELETE CASCADE');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_food_entries_one_per_nutrition_capture'
    );
    expect(sql).toContain('c.user_id = NEW.user_id');
    expect(sql).toContain('public.authenticated_user_id()');
  });

  it('completes the same capture once and returns its original lineage on retry', async () => {
    const operationId = '4576bce5-dbd8-4eba-a702-f503d93ba4ae';
    const entry = {
      id: 'entry-1',
      nutrition_capture_id: captureId,
      client_operation_id: operationId,
    };
    vi.mocked(repository.getNutritionCapture).mockResolvedValue(saved);
    vi.mocked(repository.getNutritionCaptureFoodEntry)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(entry);
    vi.mocked(foodEntryService.createFoodEntry).mockResolvedValue(
      entry as never
    );
    const body = {
      clientOperationId: operationId,
      food: {
        meal_type_id: 'Lunch',
        quantity: 1,
        unit: 'serving',
        food_name: 'Synthetic lunch',
        serving_size: 1,
        serving_unit: 'serving',
        calories: 300,
      },
    };
    const first = await request(app)
      .post(`/api/nutrition-captures/${captureId}/complete`)
      .send(body);
    const retry = await request(app)
      .post(`/api/nutrition-captures/${captureId}/complete`)
      .send(body);
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(first.body.entry.id).toBe(retry.body.entry.id);
    expect(foodEntryService.createFoodEntry).toHaveBeenCalledTimes(1);
    expect(foodEntryService.createFoodEntry).toHaveBeenCalledWith(
      'user-a',
      'user-a',
      expect.objectContaining({
        nutrition_capture_id: captureId,
        entry_date: payload.entryDate,
        client_operation_id: operationId,
      })
    );
    expect(repository.markNutritionCaptureComplete).toHaveBeenCalledTimes(2);
  });

  it('rejects a second completion with another operation ID', async () => {
    vi.mocked(repository.getNutritionCapture).mockResolvedValue(saved);
    vi.mocked(repository.getNutritionCaptureFoodEntry).mockResolvedValue({
      client_operation_id: '4576bce5-dbd8-4eba-a702-f503d93ba4ae',
    });
    const response = await request(app)
      .post(`/api/nutrition-captures/${captureId}/complete`)
      .send({
        clientOperationId: '011789c2-6192-4edf-ad71-a3372da22d28',
        food: {
          meal_type_id: 'Lunch',
          quantity: 1,
          unit: 'serving',
          food_name: 'Another meal',
          serving_size: 1,
          serving_unit: 'serving',
          calories: 400,
        },
      });
    expect(response.status).toBe(409);
    expect(foodEntryService.createFoodEntry).not.toHaveBeenCalled();
  });

  it('treats a concurrent unique-index race with the same operation ID as a retry', async () => {
    const operationId = '4576bce5-dbd8-4eba-a702-f503d93ba4ae';
    vi.mocked(repository.getNutritionCapture).mockResolvedValue(saved);
    vi.mocked(repository.getNutritionCaptureFoodEntry)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'entry-1',
        client_operation_id: operationId,
      });
    vi.mocked(foodEntryService.createFoodEntry).mockRejectedValue({
      code: '23505',
    });
    const response = await request(app)
      .post(`/api/nutrition-captures/${captureId}/complete`)
      .send({
        clientOperationId: operationId,
        food: {
          meal_type_id: 'Lunch',
          quantity: 1,
          unit: 'serving',
          food_name: 'Synthetic lunch',
          serving_size: 1,
          serving_unit: 'serving',
          calories: 300,
        },
      });
    expect(response.status).toBe(200);
    expect(response.body.entry.id).toBe('entry-1');
  });
});
