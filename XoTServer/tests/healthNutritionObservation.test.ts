import { describe, expect, it } from 'vitest';
import {
  HEALTH_MICRONUTRIENT_IDS,
  healthNutritionObservationSchema,
  reconcileHealthNutritionObservation,
  convertNutrientAmount,
  normalizeNutrientUnit,
  type HealthNutrientSnapshot,
} from '@workspace/shared';

describe('strict nutrient conversion', () => {
  it.each(['µg', 'μg', 'ug', 'mcg', ' UG '])(
    'normalizes and converts micrograms reported as %s',
    (unit) => {
      expect(normalizeNutrientUnit(unit)).toBe('µg');
      expect(convertNutrientAmount(40, unit, 'mg')).toBe(0.04);
    }
  );

  it('converts consumed magnesium and preserves explicit zero', () => {
    expect(convertNutrientAmount(0.04, 'g', 'mg')).toBe(40);
    expect(convertNutrientAmount(0, 'mg', 'g')).toBe(0);
    expect(convertNutrientAmount(4.184, 'kJ', 'kcal')).toBe(1);
  });

  it.each<[number, string | undefined, string | undefined]>([
    [10, 'IU', 'mg'],
    [10, 'IU', 'IU'],
    [10, 'unknown', 'unknown'],
    [10, 'kcal', 'mg'],
    [10, undefined, 'mg'],
    [10, 'mg', undefined],
    [-1, 'mg', 'g'],
    [Number.NaN, 'mg', 'g'],
    [Number.POSITIVE_INFINITY, 'mg', 'g'],
    [Number.MAX_VALUE, 'kg', 'ng'],
    [Number.MIN_VALUE, 'ng', 'kg'],
  ])('rejects unsafe conversion of %s %s to %s', (amount, from, to) => {
    expect(convertNutrientAmount(amount, from, to)).toBeNull();
  });
});

describe('health nutrition observation contract', () => {
  it('has a bounded unique scope of 27 micronutrients', () => {
    expect(HEALTH_MICRONUTRIENT_IDS).toHaveLength(27);
    expect(new Set(HEALTH_MICRONUTRIENT_IDS).size).toBe(27);
  });

  it('accepts explicit zero and normalizes microgram symbols', () => {
    const result = healthNutritionObservationSchema.parse({
      mode: 'partial',
      quantities: [{ catalogId: 'iodine', amount: 0, unit: 'μg' }],
    });
    expect(result.quantities[0]).toEqual({
      catalogId: 'iodine',
      amount: 0,
      unit: 'µg',
    });
  });

  it.each([
    {
      mode: 'partial',
      quantities: [{ catalogId: 'magnesium', amount: -1, unit: 'mg' }],
    },
    {
      mode: 'partial',
      quantities: [{ catalogId: 'magnesium', amount: Infinity, unit: 'mg' }],
    },
    {
      mode: 'partial',
      quantities: [{ catalogId: 'unknown', amount: 1, unit: 'mg' }],
    },
    {
      mode: 'partial',
      quantities: [{ catalogId: 'vitamin_d', amount: 1, unit: 'IU' }],
    },
    { mode: 'partial', quantities: [], coveredCatalogIds: ['magnesium'] },
    { mode: 'authoritative', quantities: [] },
    {
      mode: 'authoritative',
      coveredCatalogIds: ['magnesium'],
      quantities: [{ catalogId: 'iodine', amount: 1, unit: 'µg' }],
    },
    {
      mode: 'authoritative',
      coveredCatalogIds: ['magnesium', 'magnesium'],
      quantities: [],
    },
    {
      mode: 'partial',
      quantities: [
        { catalogId: 'magnesium', amount: 1, unit: 'mg' },
        { catalogId: 'magnesium', amount: 2, unit: 'g' },
      ],
    },
    {
      mode: 'partial',
      quantities: Array.from({ length: 28 }, () => ({
        catalogId: 'magnesium',
        amount: 1,
        unit: 'mg',
      })),
    },
  ])('rejects ambiguous or invalid observations %#', (observation) => {
    expect(
      healthNutritionObservationSchema.safeParse(observation).success
    ).toBe(false);
  });
});

describe('source record reconciliation', () => {
  const previous: HealthNutrientSnapshot = {
    magnesium: { catalogId: 'magnesium', amount: 40, unit: 'mg' },
    iodine: { catalogId: 'iodine', amount: 10, unit: 'µg' },
  };

  it('preserves history for legacy clients and empty partial reads', () => {
    expect(reconcileHealthNutritionObservation(previous, undefined)).toEqual(
      previous
    );
    expect(
      reconcileHealthNutritionObservation(previous, {
        mode: 'partial',
        quantities: [],
      })
    ).toEqual(previous);
  });

  it('updates observed nutrients without clearing unobserved ones', () => {
    const observation = healthNutritionObservationSchema.parse({
      mode: 'partial',
      quantities: [{ catalogId: 'magnesium', amount: 0, unit: 'mg' }],
    });
    const next = reconcileHealthNutritionObservation(previous, observation);
    expect(next.magnesium?.amount).toBe(0);
    expect(next.iodine).toEqual(previous.iodine);
    expect(previous.magnesium?.amount).toBe(40);
    expect(reconcileHealthNutritionObservation(next, observation)).toEqual(
      next
    );
  });

  it('removes only explicitly covered nutrients in an authoritative record', () => {
    const next = reconcileHealthNutritionObservation(previous, {
      mode: 'authoritative',
      coveredCatalogIds: ['magnesium'],
      quantities: [],
    });
    expect(next).toEqual({ iodine: previous.iodine });
    expect(previous.magnesium?.amount).toBe(40);
  });

  it('does not borrow nutrients from another same-name record', () => {
    expect(
      reconcileHealthNutritionObservation(
        {},
        {
          mode: 'partial',
          quantities: [],
        }
      )
    ).toEqual({});
    expect(previous.magnesium?.amount).toBe(40);
  });
});
