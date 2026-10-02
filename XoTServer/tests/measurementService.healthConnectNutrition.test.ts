import { describe, it, expect, vi, beforeEach } from 'vitest';
import foodRepository from '../models/foodRepository.js';
import measurementService from '../services/measurementService.js';

// Mirror the mock set used by measurementService.healthDataUnits.test.ts (the
// proven harness for processHealthData) and add foodRepository, which the new
// Nutrition ingestion path depends on.
vi.mock('../models/measurementRepository');
vi.mock('../models/userRepository');
vi.mock('../models/exerciseRepository');
vi.mock('../models/exerciseEntry');
vi.mock('../models/sleepRepository');
vi.mock('../models/waterContainerRepository');
vi.mock('../models/activityDetailsRepository');
// Avoid a real DB lookup for the user's timezone (keeps processHealthData
// deterministic and prevents a leaked DB-pool rejection after the test ends).
vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: vi.fn().mockResolvedValue('UTC'),
}));
// foodRepository's default export is assembled via runtime spreads, so
// auto-mock can't introspect it — provide an explicit factory mirroring the
// helpers the Health Connect nutrition path uses (the same ones the Garmin
// nutrition sync relies on).
vi.mock('../models/foodRepository', () => ({
  default: {
    findFoodByProviderExternalId: vi.fn(),
    updateFoodVariantNutrition: vi.fn(),
    createFoodWithClient: vi.fn(),
    createFoodEntry: vi.fn(),
  },
}));

const { nutritionQuery, nutritionRelease } = vi.hoisted(() => ({
  nutritionQuery: vi.fn(),
  nutritionRelease: vi.fn(),
}));
vi.mock('../db/poolManager.js', () => ({
  getClient: vi.fn(async () => ({
    query: nutritionQuery,
    release: nutritionRelease,
  })),
  getSystemClient: vi.fn(),
}));

describe('processHealthData Nutrition ingestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nutritionQuery.mockResolvedValue({ rows: [] });
    // Sensible defaults so no awaited mock resolves to undefined; individual
    // tests override as needed. Default: no existing food (create path).
    vi.mocked(foodRepository.findFoodByProviderExternalId).mockResolvedValue(
      null
    );
    vi.mocked(foodRepository.updateFoodVariantNutrition).mockResolvedValue(
      undefined
    );
    vi.mocked(foodRepository.createFoodWithClient).mockResolvedValue({
      id: 'food-default',
      default_variant_id: 'variant-default',
    });
    vi.mocked(foodRepository.createFoodEntry).mockResolvedValue({
      id: 'entry-default',
    });
  });

  const baseRecord = {
    type: 'Nutrition',
    source: 'health_connect',
    source_id: 'hc-1',
    timestamp: '2024-01-15T12:30:00.000Z',
    food_name: 'Protein Strawberry pack',
    meal_type: 'lunch',
    // Server stores values as received; the mobile transformer already converted
    // them to Sparky's per-column units (g for macros, mg/mcg for micros).
    calories: 142,
    protein: 20,
    carbs: 11.2,
    fat: 1.2,
    saturated_fat: 0.8,
    sodium: 220,
    sugars: 10.6,
  };

  it('creates a provider food + entry when no food matches by external id', async () => {
    vi.mocked(foodRepository.findFoodByProviderExternalId).mockResolvedValue(
      null
    );
    vi.mocked(foodRepository.createFoodWithClient).mockResolvedValue({
      id: 'food-1',
      default_variant_id: 'variant-1',
    });
    vi.mocked(foodRepository.createFoodEntry).mockResolvedValue({
      id: 'entry-1',
    });

    const result = await measurementService.processHealthData(
      [baseRecord],
      'user-1',
      'user-1'
    );

    expect(result).toBeDefined();
    // The food is tagged with the Health Connect provider so it is reused by
    // external id next time (and never matches a user-authored library food).
    expect(foodRepository.createFoodWithClient).toHaveBeenCalledTimes(1);
    expect(foodRepository.updateFoodVariantNutrition).not.toHaveBeenCalled();
    const createFoodArg = vi.mocked(foodRepository.createFoodWithClient).mock
      .calls[0]![1];
    expect(createFoodArg).toMatchObject({
      name: 'Protein Strawberry pack',
      user_id: 'user-1',
      provider_type: 'health_connect',
      // Named record → reused by name.
      provider_external_id: 'Protein Strawberry pack',
      // Hidden from food search.
      is_quick_food: true,
      // food_variants.source is constrained to manual|ai_estimate|imported.
      source: 'imported',
      serving_size: 1,
    });

    // The entry references the new food/variant, carries the source key for
    // idempotent upsert, and snapshots the consumed nutrients directly.
    expect(foodRepository.createFoodEntry).toHaveBeenCalledTimes(1);
    const [entryData, actingUserId] = vi.mocked(foodRepository.createFoodEntry)
      .mock.calls[0];
    expect(entryData).toMatchObject({
      user_id: 'user-1',
      food_id: 'food-1',
      variant_id: 'variant-1',
      meal_type: 'lunch',
      entry_date: '2024-01-15',
      source: 'health_connect',
      source_id: 'hc-1',
      calories: 142,
      protein: 20,
      sodium: 220,
    });
    expect(actingUserId).toBe('user-1');
  });

  it('reuses an existing provider food and refreshes its variant nutrition', async () => {
    vi.mocked(foodRepository.findFoodByProviderExternalId).mockResolvedValue({
      id: 'food-existing',
      default_variant_id: 'variant-existing',
    });
    vi.mocked(foodRepository.createFoodEntry).mockResolvedValue({
      id: 'entry-2',
    });

    await measurementService.processHealthData(
      [baseRecord],
      'user-1',
      'user-1'
    );

    // No new food; the existing variant is refreshed to the latest values.
    expect(foodRepository.createFoodWithClient).not.toHaveBeenCalled();
    expect(foodRepository.updateFoodVariantNutrition).toHaveBeenCalledTimes(1);
    const [variantId, , nutrition] = vi.mocked(
      foodRepository.updateFoodVariantNutrition
    ).mock.calls[0];
    expect(variantId).toBe('variant-existing');
    expect(nutrition).toMatchObject({
      calories: 142,
      protein: 20,
      sodium: 220,
    });

    const entryData = vi.mocked(foodRepository.createFoodEntry).mock
      .calls[0][0];
    expect(entryData).toMatchObject({
      food_id: 'food-existing',
      variant_id: 'variant-existing',
      source_id: 'hc-1',
    });
  });

  it('snapshots consumed nutrients onto the entry so equal-named records do not collapse', async () => {
    vi.mocked(foodRepository.findFoodByProviderExternalId).mockResolvedValue({
      id: 'food-banana',
      default_variant_id: 'variant-banana',
    });

    // Two "Banana" records with different consumed amounts in one batch.
    await measurementService.processHealthData(
      [
        {
          ...baseRecord,
          food_name: 'Banana',
          source_id: 'hc-a',
          calories: 105,
        },
        { ...baseRecord, food_name: 'Banana', source_id: 'hc-b', calories: 60 },
      ],
      'user-1',
      'user-1'
    );

    // Each entry carries its own calories — they are not flattened to one value.
    const calls = vi.mocked(foodRepository.createFoodEntry).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toMatchObject({ source_id: 'hc-a', calories: 105 });
    expect(calls[1][0]).toMatchObject({ source_id: 'hc-b', calories: 60 });
  });

  it('gives each nameless record its own food keyed by source_id (no collapse)', async () => {
    vi.mocked(foodRepository.findFoodByProviderExternalId).mockResolvedValue(
      null
    );

    // Two records with no name but distinct ids.
    await measurementService.processHealthData(
      [
        { ...baseRecord, food_name: '   ', source_id: 'hc-x', calories: 105 },
        {
          ...baseRecord,
          food_name: undefined,
          source_id: 'hc-y',
          calories: 60,
        },
      ],
      'user-1',
      'user-1'
    );

    // Each is looked up + created under its own source_id, not a shared
    // 'Health Connect food' row, and both are hidden quick foods.
    const createCalls = vi.mocked(foodRepository.createFoodWithClient).mock
      .calls;
    expect(createCalls).toHaveLength(2);
    expect(createCalls[0]![1]).toMatchObject({
      name: 'Health Connect food',
      provider_external_id: 'hc-x',
      is_quick_food: true,
    });
    expect(createCalls[1]![1]).toMatchObject({
      name: 'Health Connect food',
      provider_external_id: 'hc-y',
      is_quick_food: true,
    });
    const lookups = vi.mocked(foodRepository.findFoodByProviderExternalId).mock
      .calls;
    expect(lookups[0][1]).toBe('hc-x');
    expect(lookups[1][1]).toBe('hc-y');
  });

  it('skips a Nutrition record with no source_id (cannot dedupe → would duplicate)', async () => {
    const result = await measurementService.processHealthData(
      [{ ...baseRecord, source_id: undefined }],
      'user-1',
      'user-1'
    );

    expect(foodRepository.findFoodByProviderExternalId).not.toHaveBeenCalled();
    expect(foodRepository.createFoodWithClient).not.toHaveBeenCalled();
    expect(foodRepository.createFoodEntry).not.toHaveBeenCalled();
    // The skip is surfaced to callers instead of vanishing from the response.
    expect(result.processed).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain('source_id');
  });

  it('does not touch foods when there are no nutrition records', async () => {
    await measurementService.processHealthData(
      [{ type: 'weight', value: 70, date: '2024-01-15' }],
      'user-1',
      'user-1'
    );

    expect(foodRepository.findFoodByProviderExternalId).not.toHaveBeenCalled();
    expect(foodRepository.createFoodWithClient).not.toHaveBeenCalled();
    expect(foodRepository.createFoodEntry).not.toHaveBeenCalled();
  });

  it('tags HealthKit entries with healthkit provider and uses Apple Health food as fallback name', async () => {
    const hkRecord = {
      type: 'Nutrition',
      source: 'HealthKit',
      source_id: 'hk-corr-uuid-1',
      timestamp: '2024-01-15T08:00:00.000Z',
      food_name: '',
      meal_type: 'breakfast',
      calories: 300,
      protein: 25,
    };

    vi.mocked(foodRepository.findFoodByProviderExternalId).mockResolvedValue(
      null
    );
    vi.mocked(foodRepository.createFoodWithClient).mockResolvedValue({
      id: 'food-hk-1',
      default_variant_id: 'variant-hk-1',
    });
    vi.mocked(foodRepository.createFoodEntry).mockResolvedValue({
      id: 'entry-hk-1',
    });

    await measurementService.processHealthData([hkRecord], 'user-1', 'user-1');

    // Lookup uses the healthkit provider tag, not health_connect.
    const [, , lookupProviderType] = vi.mocked(
      foodRepository.findFoodByProviderExternalId
    ).mock.calls[0];
    expect(lookupProviderType).toBe('healthkit');

    // Created food is tagged healthkit; nameless record uses 'Apple Health food'.
    const createFoodArg = vi.mocked(foodRepository.createFoodWithClient).mock
      .calls[0]![1];
    expect(createFoodArg).toMatchObject({
      name: 'Apple Health food',
      provider_type: 'healthkit',
      is_quick_food: true,
      source: 'imported',
    });

    // Diary entry source is the healthkit provider tag.
    const entryArg = vi.mocked(foodRepository.createFoodEntry).mock.calls[0][0];
    expect(entryArg).toMatchObject({
      source: 'healthkit',
      source_id: 'hk-corr-uuid-1',
      food_id: 'food-hk-1',
      variant_id: 'variant-hk-1',
      calories: 300,
    });
  });

  it('Health Connect source is unchanged — still tags health_connect for all three uses', async () => {
    const hcRecord = {
      ...baseRecord,
      source: 'Health Connect',
      source_id: 'hc-regression-1',
      food_name: 'Oats',
    };

    vi.mocked(foodRepository.findFoodByProviderExternalId).mockResolvedValue(
      null
    );
    vi.mocked(foodRepository.createFoodWithClient).mockResolvedValue({
      id: 'food-hc-r',
      default_variant_id: 'variant-hc-r',
    });
    vi.mocked(foodRepository.createFoodEntry).mockResolvedValue({
      id: 'entry-hc-r',
    });

    await measurementService.processHealthData([hcRecord], 'user-1', 'user-1');

    const [, , lookupProviderType] = vi.mocked(
      foodRepository.findFoodByProviderExternalId
    ).mock.calls[0];
    expect(lookupProviderType).toBe('health_connect');

    const createFoodArg = vi.mocked(foodRepository.createFoodWithClient).mock
      .calls[0]![1];
    expect(createFoodArg).toMatchObject({
      name: 'Oats',
      provider_type: 'health_connect',
    });

    const entryArg = vi.mocked(foodRepository.createFoodEntry).mock.calls[0][0];
    expect(entryArg).toMatchObject({
      source: 'health_connect',
      source_id: 'hc-regression-1',
    });
  });

  it('unknown or missing source falls back to health_connect and Health Connect food', async () => {
    const unknownSourceRecord = {
      type: 'Nutrition',
      source: undefined,
      source_id: 'unknown-src-1',
      timestamp: '2024-01-15T09:00:00.000Z',
      food_name: '',
      calories: 50,
    };

    vi.mocked(foodRepository.findFoodByProviderExternalId).mockResolvedValue(
      null
    );
    vi.mocked(foodRepository.createFoodWithClient).mockResolvedValue({
      id: 'food-unk',
      default_variant_id: 'variant-unk',
    });
    vi.mocked(foodRepository.createFoodEntry).mockResolvedValue({
      id: 'entry-unk',
    });

    await measurementService.processHealthData(
      [unknownSourceRecord],
      'user-1',
      'user-1'
    );

    const [, , lookupProviderType] = vi.mocked(
      foodRepository.findFoodByProviderExternalId
    ).mock.calls[0];
    expect(lookupProviderType).toBe('health_connect');

    const createFoodArg = vi.mocked(foodRepository.createFoodWithClient).mock
      .calls[0]![1];
    expect(createFoodArg).toMatchObject({
      name: 'Health Connect food',
      provider_type: 'health_connect',
    });

    const entryArg = vi.mocked(foodRepository.createFoodEntry).mock.calls[0][0];
    expect(entryArg).toMatchObject({
      source: 'health_connect',
    });
  });
});
