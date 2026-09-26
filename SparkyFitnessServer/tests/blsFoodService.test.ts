import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, release } = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
}));
vi.mock('../db/poolManager.js', () => ({
  getClient: vi.fn(async () => ({ query, release })),
}));

import {
  getBlsFoodDetails,
  mapBlsFood,
  searchBlsFoods,
  type BlsFood,
} from '../integrations/bls/blsFoodService.js';

const oats: BlsFood = {
  code: 'C131000',
  name_de: 'Hafer ganzes Korn, roh',
  name_en: 'Oat whole grain, raw',
  nutrients: {
    ENERCC: 343,
    PROT625: 11.375,
    CHO: 53.7,
    FAT: 7.09,
    FIBT: 9.3,
    NA: 4,
  },
};

beforeEach(() => {
  query.mockReset();
  release.mockReset();
});

describe('BLS 4.0 normalization', () => {
  it('keeps the official per-100g mass basis and exact numeric values', () => {
    const mapped = mapBlsFood(oats, 'de');
    expect(mapped).toMatchObject({
      name: oats.name_de,
      brand: null,
      provider_type: 'bls4',
      provider_external_id: oats.code,
      default_variant: {
        serving_size: 100,
        serving_unit: 'g',
        calories: 343,
        protein: 11.375,
        carbs: 53.7,
        fat: 7.09,
        dietary_fiber: 9.3,
      },
    });
    expect(mapped?.default_variant).not.toHaveProperty('vitamin_a');
  });

  it('uses grams even for a beverage code; no unsupported ml conversion', () => {
    const mapped = mapBlsFood({ ...oats, code: 'N110000' });
    expect(mapped?.default_variant.serving_unit).toBe('g');
  });

  it('distinguishes a recorded zero from an absent or qualified nutrient', () => {
    const zero = mapBlsFood({
      ...oats,
      nutrients: { ...oats.nutrients, FAT: 0, FIBT: 0 },
    });
    expect(zero?.default_variant.fat).toBe(0);
    expect(zero?.default_variant.dietary_fiber).toBe(0);
    const missing = mapBlsFood({
      ...oats,
      nutrients: { ENERCC: 343, PROT625: 11.375, CHO: 53.7 },
    });
    expect(missing).toBeNull();
  });
});

describe('BLS 4.0 catalogue lookup', () => {
  it('returns paginated authenticated search results and releases the client', async () => {
    query.mockResolvedValue({ rows: [{ ...oats, total_count: 2 }] });
    const result = await searchBlsFoods('user-1', 'Hafer', 1, 1, 'de');
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 1,
      totalCount: 2,
      hasMore: true,
    });
    expect(result.foods[0]?.name).toBe(oats.name_de);
    expect(query.mock.calls[0][1]).toEqual([
      '%Hafer%',
      'Hafer%',
      1,
      'ENERCC',
      'PROT625',
      'CHO',
      'FAT',
      0,
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it('looks up a stable BLS code for the detail/import flow', async () => {
    query.mockResolvedValue({ rows: [oats] });
    const result = await getBlsFoodDetails('user-1', 'C131000');
    expect(result?.provider_external_id).toBe('C131000');
    expect(result?.name).toBe(oats.name_en);
    expect(release).toHaveBeenCalledOnce();
  });
});
