import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type RequestHandler } from 'express';
// @ts-expect-error supertest has no installed declaration package
import request from 'supertest';

const { query, release, getPreferences } = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  getPreferences: vi.fn(),
}));
vi.mock('../db/poolManager.js', () => ({
  getClient: vi.fn(async () => ({ query, release })),
}));
vi.mock('../services/preferenceService.js', () => ({
  default: { getUserPreferences: getPreferences },
}));
vi.mock('../services/customNutrientService.js', () => ({
  default: { getCustomNutrients: vi.fn(async () => []) },
}));
vi.mock('../middleware/checkPermissionMiddleware.js', () => ({
  default: () => ((_req, _res, next) => next()) satisfies RequestHandler,
}));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));

// @ts-expect-error legacy route exports its router through module.exports
import foodRoutes from '../routes/v2/foodRoutes.js';
import { resolveFoodProviderLanguage } from '../services/externalFoodSearchService.js';

// Synthetic bilingual fixture, not a claim about any live catalogue record.
const food = {
  code: 'fixture-oats',
  name_de: 'Hafer ganzes Korn, roh',
  name_en: 'Oat whole grain, raw',
  nutrients: { ENERCC: 343, PROT625: 11.375, CHO: 53.7, FAT: 7.09 },
  total_count: 1,
};
const app = express();
app.use((req, _res, next) => {
  req.userId = 'user-language-test';
  req.authenticatedUserId = 'user-language-test';
  next();
});
app.use('/v2/foods', foodRoutes);

const endpoints = [
  '/v2/foods/search/bls4?query=hafer',
  '/v2/foods/details/bls4/fixture-oats?',
];

beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue({ rows: [food] });
  getPreferences.mockResolvedValue({ language: 'en' });
});

describe('BLS request language through HTTP, service and catalogue mapping', () => {
  it.each(endpoints)(
    'returns German names for %s with a German app locale',
    async (path) => {
      const response = await request(app).get(`${path}&language=de-DE`);
      expect(response.status).toBe(200);
      const result = response.body.foods?.[0] ?? response.body;
      expect(result.name).toBe(food.name_de);
      expect(result.default_variant).toMatchObject({
        serving_size: 100,
        serving_unit: 'g',
        calories: 343,
        protein: 11.375,
        carbs: 53.7,
        fat: 7.09,
      });
      expect(getPreferences).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledOnce();
    }
  );

  it.each(endpoints)(
    'lets an English app locale override the German account for %s',
    async (path) => {
      getPreferences.mockResolvedValue({ language: 'de' });
      const response = await request(app).get(`${path}&language=en-GB`);
      expect(response.status).toBe(200);
      expect((response.body.foods?.[0] ?? response.body).name).toBe(
        food.name_en
      );
    }
  );

  it.each(endpoints)(
    'preserves the account fallback for older clients at %s',
    async (path) => {
      getPreferences.mockResolvedValue({ language: 'de-AT' });
      const response = await request(app).get(path);
      expect(response.status).toBe(200);
      expect((response.body.foods?.[0] ?? response.body).name).toBe(
        food.name_de
      );
      expect(getPreferences).toHaveBeenCalledWith(
        'user-language-test',
        'user-language-test'
      );
    }
  );

  it.each([
    '',
    'de&language=en',
    'de/products',
    'de<script>',
    '123',
    'd'.repeat(65),
  ])(
    'rejects malformed language input %j before querying the catalogue',
    async (language) => {
      for (const path of endpoints) {
        const response = await request(app).get(`${path}&language=${language}`);
        expect(response.status).toBe(400);
      }
      expect(query).not.toHaveBeenCalled();
      expect(getPreferences).not.toHaveBeenCalled();
    }
  );

  it.each([undefined, { language: '' }, { language: 'invalid/path' }])(
    'defaults safely to English with an absent or invalid stored preference',
    async (preferences) => {
      getPreferences.mockResolvedValue(preferences);
      expect(await resolveFoodProviderLanguage('user-language-test')).toBe(
        'en'
      );
    }
  );
});
