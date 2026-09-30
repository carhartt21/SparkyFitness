import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClient } from '../db/poolManager.js';
import foodRepository from '../models/foodRepository.js';
import foodServingService, {
  ServingSaveError,
} from '../services/foodServingService.js';
import {
  isDerivedFromBasis,
  metricWeightOf,
  portionFactor,
  saveFoodServingsBodySchema,
  servingWeightOf,
} from '@workspace/shared';
import { createMockDbClient } from './helpers/mockDbClient.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));
vi.mock('../models/foodRepository.js', () => ({
  default: { getFoodOwnerId: vi.fn() },
}));

const FOOD = '00000000-0000-4000-8000-0000000000f0';
const BASIS = '00000000-0000-4000-8000-0000000000b0';
const CUP = '00000000-0000-4000-8000-0000000000c1';
const SLICE = '00000000-0000-4000-8000-0000000000c2';

const basisRow = {
  id: BASIS,
  food_id: FOOD,
  serving_size: '100',
  serving_unit: 'g',
  serving_label: null,
  metric_amount: '100',
  metric_unit: 'g',
  sort_order: 0,
  is_default: true,
  created_at: new Date('2026-01-01'),
  glycemic_index: null,
  abv_percent: null,
  allergens: null,
  traces: null,
  calories: '52',
  protein: '0.3',
  carbs: '14',
  fat: '0.2',
  dietary_fiber: '2.4',
  sugars: null,
  custom_nutrients: { polyphenols: 10 },
};

// An older import: "1 slice" with values of its own, no weight.
const sliceRow = {
  ...basisRow,
  id: SLICE,
  serving_size: '1',
  serving_unit: 'slice',
  metric_amount: null,
  metric_unit: null,
  is_default: false,
  sort_order: 1,
  calories: '20',
  protein: '1',
  carbs: '3',
  fat: '0.5',
  custom_nutrients: {},
};

function scriptClient(rows: unknown[], assignments = 0) {
  const client = createMockDbClient([]);
  client.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FOR UPDATE')) return { rows };
    if (sql.includes('meal_plan_template_assignments')) {
      return { rows: [{ count: String(assignments) }] };
    }
    return { rows: [] };
  });
  vi.mocked(getClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof getClient>>
  );
  return client;
}

function body(input: unknown) {
  return saveFoodServingsBodySchema.parse(input);
}

function callsMatching(
  client: ReturnType<typeof scriptClient>,
  fragment: string
) {
  return client.query.mock.calls.filter(([sql]) =>
    String(sql).includes(fragment)
  );
}

describe('serving portion helpers', () => {
  it('knows exact metric weights and leaves household measures unweighed', () => {
    expect(metricWeightOf(2, 'kg')).toEqual({
      metric_amount: 2000,
      metric_unit: 'g',
    });
    expect(metricWeightOf(250, 'ml')).toEqual({
      metric_amount: 250,
      metric_unit: 'ml',
    });
    expect(metricWeightOf(1, 'cup')).toBeNull();
    expect(
      servingWeightOf({
        serving_size: 1,
        serving_unit: 'bar',
        metric_amount: '45',
        metric_unit: 'g',
      })
    ).toEqual({ metric_amount: 45, metric_unit: 'g' });
  });

  it('relates a portion to the basis by weight or by the same unit', () => {
    expect(
      portionFactor(
        {
          serving_size: 1,
          serving_unit: 'cup',
          metric_amount: 245,
          metric_unit: 'g',
        },
        basisRow
      )
    ).toBeCloseTo(2.45);
    expect(
      portionFactor(
        { serving_size: 0.5, serving_unit: 'serving' },
        { serving_size: 1, serving_unit: 'serving' }
      )
    ).toBe(0.5);
    expect(
      portionFactor({ serving_size: 1, serving_unit: 'slice' }, basisRow)
    ).toBeNull();
  });

  it('recognises derived rows and never treats own nutrition as derived', () => {
    expect(
      isDerivedFromBasis(
        {
          serving_size: 1,
          serving_unit: 'cup',
          metric_amount: 245,
          metric_unit: 'g',
          calories: 127.4,
          protein: 0.735,
          carbs: 34.3,
          fat: 0.49,
        },
        basisRow
      )
    ).toBe(true);
    expect(isDerivedFromBasis(sliceRow, basisRow)).toBe(false);
  });
});

describe('saveFoodServings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(foodRepository.getFoodOwnerId).mockResolvedValue('user-1');
  });

  it('derives a new weighed portion from the basis and keeps the basis marked', async () => {
    const client = scriptClient([basisRow]);
    await foodServingService.saveFoodServings(
      'user-1',
      FOOD,
      body({
        servings: [
          {
            serving_label: 'Medium',
            serving_size: 1,
            serving_unit: 'piece',
            metric_amount: 130,
            sort_order: 1,
          },
        ],
      })
    );
    const [insert] = callsMatching(client, 'INSERT INTO food_variants');
    const [sql, values] = insert as [string, unknown[]];
    const columns = sql
      .slice(sql.indexOf('(') + 1, sql.indexOf(')'))
      .split(',')
      .map((column) => column.trim());
    const valueOf = (column: string) => values[columns.indexOf(column)];
    expect(valueOf('serving_label')).toBe('Medium');
    expect(valueOf('metric_amount')).toBe(130);
    expect(valueOf('metric_unit')).toBe('g');
    expect(valueOf('calories')).toBeCloseTo(67.6);
    expect(valueOf('dietary_fiber')).toBeCloseTo(3.12);
    // A nutrient the basis does not know stays unknown, never zero.
    expect(valueOf('sugars')).toBeNull();
    expect(valueOf('custom_nutrients')).toBe(
      JSON.stringify({ polyphenols: 13 })
    );
    expect(valueOf('is_default')).toBe(false);
    expect(callsMatching(client, 'SET is_default = (id = $2)')).toHaveLength(1);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('keeps own nutrition when a legacy row is only relabelled or reordered', async () => {
    const client = scriptClient([basisRow, sliceRow]);
    await foodServingService.saveFoodServings(
      'user-1',
      FOOD,
      body({
        servings: [
          {
            id: SLICE,
            serving_label: 'Thin slice',
            serving_size: 1,
            serving_unit: 'slice',
            sort_order: 3,
            derive: false,
          },
        ],
      })
    );
    const [update] = callsMatching(client, 'UPDATE food_variants SET');
    expect(update[0]).not.toContain('calories');
    expect(update[1]).toEqual([SLICE, 'Thin slice', 1, 'slice', null, null, 3]);
  });

  it('rescales own nutrition when the amount changes in the same unit', async () => {
    const client = scriptClient([basisRow, sliceRow]);
    await foodServingService.saveFoodServings(
      'user-1',
      FOOD,
      body({
        servings: [
          {
            id: SLICE,
            serving_size: 2,
            serving_unit: 'slice',
            sort_order: 1,
            derive: false,
          },
        ],
      })
    );
    const [update] = callsMatching(client, 'UPDATE food_variants SET');
    expect(update[0]).toContain('calories');
    expect(update[1]).toContain(40);
  });

  it('asks for a weight before recalculating a changed unit or a new unweighed portion', async () => {
    scriptClient([basisRow, sliceRow]);
    await expect(
      foodServingService.saveFoodServings(
        'user-1',
        FOOD,
        body({
          servings: [
            {
              id: SLICE,
              serving_size: 1,
              serving_unit: 'piece',
              sort_order: 1,
              derive: false,
            },
          ],
        })
      )
    ).rejects.toMatchObject({ status: 422 });

    const client = scriptClient([basisRow]);
    await expect(
      foodServingService.saveFoodServings(
        'user-1',
        FOOD,
        body({
          servings: [{ serving_size: 1, serving_unit: 'cup', sort_order: 1 }],
        })
      )
    ).rejects.toBeInstanceOf(ServingSaveError);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('stops before deleting a portion that meal plan templates use', async () => {
    const client = scriptClient([basisRow, sliceRow], 2);
    await expect(
      foodServingService.saveFoodServings(
        'user-1',
        FOOD,
        body({ servings: [], deleted_ids: [SLICE] })
      )
    ).rejects.toMatchObject({
      status: 409,
      details: { code: 'SERVING_IN_USE', template_assignments: 2 },
    });
    expect(callsMatching(client, 'DELETE FROM food_variants')).toHaveLength(0);

    const confirmed = scriptClient([basisRow, sliceRow], 2);
    await foodServingService.saveFoodServings(
      'user-1',
      FOOD,
      body({ servings: [], deleted_ids: [SLICE], confirm_cascade: true })
    );
    expect(callsMatching(confirmed, 'DELETE FROM food_variants')[0][1]).toEqual(
      [FOOD, [SLICE]]
    );
  });

  it('protects the nutrition values and rejects duplicate servings', async () => {
    scriptClient([basisRow, sliceRow]);
    await expect(
      foodServingService.saveFoodServings(
        'user-1',
        FOOD,
        body({ servings: [], deleted_ids: [BASIS] })
      )
    ).rejects.toMatchObject({ status: 400 });

    scriptClient([basisRow]);
    await expect(
      foodServingService.saveFoodServings(
        'user-1',
        FOOD,
        body({
          servings: [{ serving_size: 100, serving_unit: 'g', sort_order: 1 }],
        })
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('sets the weight of a basis measured in its own unit', async () => {
    const barBasis = {
      ...basisRow,
      serving_size: '1',
      serving_unit: 'bar',
      metric_amount: null,
      metric_unit: null,
    };
    const client = scriptClient([barBasis]);
    await foodServingService.saveFoodServings(
      'user-1',
      FOOD,
      body({
        basis_metric_amount: 45,
        servings: [
          {
            serving_label: 'Half',
            serving_size: 22.5,
            serving_unit: 'g',
            sort_order: 1,
          },
        ],
      })
    );
    expect(callsMatching(client, 'SET metric_amount = $2')[0][1]).toEqual([
      BASIS,
      45,
      'g',
    ]);
    const [insert] = callsMatching(client, 'INSERT INTO food_variants');
    expect(insert[1]).toContain(26);
  });

  it('refuses foods the user does not own', async () => {
    vi.mocked(foodRepository.getFoodOwnerId).mockResolvedValue('someone-else');
    await expect(
      foodServingService.saveFoodServings(
        'user-1',
        FOOD,
        body({ servings: [] })
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(getClient).not.toHaveBeenCalled();
  });
});

describe('last-used serving', () => {
  beforeEach(() => vi.clearAllMocks());

  it('remembers a hand-logged food with its variant snapshot, as the diary owner', async () => {
    const client = scriptClient([]);
    await foodServingService.recordLastServing('delegate-1', {
      user_id: 'owner-1',
      food_id: FOOD,
      variant_id: CUP,
      quantity: '2',
      unit: 'cup',
      serving_size: '1',
    });
    expect(getClient).toHaveBeenCalledWith('owner-1', 'delegate-1');
    const [sql, values] = client.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT (user_id, food_id) DO UPDATE');
    expect(sql).toContain('fv.serving_label, fv.metric_amount, fv.metric_unit');
    expect(values).toEqual(['owner-1', FOOD, 2, 'cup', CUP, 1]);
  });

  it('ignores quick entries and never fails logging', async () => {
    await foodServingService.recordLastServing('user-1', {
      user_id: 'user-1',
      food_id: null,
      variant_id: null,
      quantity: 1,
      unit: 'serving',
    });
    expect(getClient).not.toHaveBeenCalled();

    const client = scriptClient([]);
    client.query.mockRejectedValue(new Error('database down'));
    await expect(
      foodServingService.recordLastServing('user-1', {
        user_id: 'user-1',
        food_id: FOOD,
        variant_id: CUP,
        quantity: 1,
        unit: 'cup',
      })
    ).resolves.toBeUndefined();
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('reads the last serving through the diary-scoped client', async () => {
    const client = scriptClient([]);
    client.query.mockResolvedValue({ rows: [] });
    await expect(
      foodServingService.getLastServing('owner-1', 'delegate-1', FOOD)
    ).resolves.toBeNull();
    expect(getClient).toHaveBeenCalledWith('owner-1', 'delegate-1');
    expect(client.query.mock.calls[0][1]).toEqual(['owner-1', FOOD]);
  });
});
