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
      'hafer:*',
      'hafer:*',
      'hafer',
      1,
      'ENERCC',
      'PROT625',
      'CHO',
      'FAT',
      0,
      'hafer',
    ]);
    expect(query.mock.calls[0][0]).toContain("to_tsvector('german'");
    expect(query.mock.calls[0][0]).toContain('LIMIT $4 OFFSET $9');
    expect(query.mock.calls[0][0]).toContain("= $10 || ' roh'");
    expect(release).toHaveBeenCalledOnce();
  });

  it('uses identity and preparation tokens independently of word order or punctuation', async () => {
    query.mockResolvedValue({ rows: [{ ...oats, total_count: 1 }] });
    await searchBlsFoods('user-1', 'gekochter Reis', 1, 20, 'de');
    expect(query.mock.calls[0][1]).toEqual([
      'reis:*',
      'gekocht:* & reis:*',
      'gekocht reis',
      20,
      'ENERCC',
      'PROT625',
      'CHO',
      'FAT',
      0,
      'reis',
    ]);
  });

  it('distinguishes an uninitialized catalogue from an empty match', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ catalogue_count: 0, matching_count: 0, eligible_count: 0 }],
    });
    await expect(searchBlsFoods('user-1', 'tomat')).rejects.toMatchObject({
      status: 503,
      message: 'BLS catalogue not initialized',
    });
    expect(release).toHaveBeenCalledOnce();
    query.mockReset();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ catalogue_count: 7140, matching_count: 0, eligible_count: 0 }],
    });
    const result = await searchBlsFoods('user-1', 'not-a-food');
    expect(result.foods).toEqual([]);
    expect(result.pagination.totalCount).toBe(0);
  });

  it('does not call missing core nutrients a valid empty catalogue match', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ catalogue_count: 7140, matching_count: 2, eligible_count: 0 }],
    });
    await expect(searchBlsFoods('user-1', 'tomate')).rejects.toMatchObject({
      status: 422,
    });
  });

  it('keeps the correct total for an empty page after the last match', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ catalogue_count: 7140, matching_count: 2, eligible_count: 2 }],
    });
    const result = await searchBlsFoods('user-1', 'apfel', 3, 1, 'de');
    expect(result.pagination).toEqual({
      page: 3,
      pageSize: 1,
      totalCount: 2,
      hasMore: false,
    });
  });

  it('looks up a stable BLS code for the detail/import flow', async () => {
    query.mockResolvedValue({ rows: [oats] });
    const result = await getBlsFoodDetails('user-1', 'C131000');
    expect(result?.provider_external_id).toBe('C131000');
    expect(result?.name).toBe(oats.name_en);
    expect(release).toHaveBeenCalledOnce();
  });
});
