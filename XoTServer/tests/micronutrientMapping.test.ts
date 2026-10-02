import { describe, expect, it } from 'vitest';
import {
  BLS_COMPONENT_MANIFEST,
  HEALTH_MICRONUTRIENT_IDS,
  NATIVE_MICRONUTRIENT_MAPPINGS,
  convertCatalogNutrientAmount,
  averageRecordedNutrient,
} from '@workspace/shared';
import { mapBlsFood } from '../integrations/bls/blsFoodService.js';

describe('micronutrient source mapping', () => {
  it('classifies all 138 pinned BLS headers and all 27 native categories exactly once', () => {
    expect(BLS_COMPONENT_MANIFEST).toHaveLength(138);
    expect(
      BLS_COMPONENT_MANIFEST.filter(
        (component) => component.status === 'supported'
      )
    ).toHaveLength(23);
    expect(
      BLS_COMPONENT_MANIFEST.filter(
        (component) => component.status === 'blocked'
      )
    ).toHaveLength(11);
    expect(
      new Set(BLS_COMPONENT_MANIFEST.map((component) => component.code)).size
    ).toBe(138);
    expect(
      new Set(NATIVE_MICRONUTRIENT_MAPPINGS.map((mapping) => mapping.catalogId))
    ).toEqual(new Set(HEALTH_MICRONUTRIENT_IDS));
  });
  it('maps mineral units without guessing qualifiers or combining incompatible forms', () => {
    const food = mapBlsFood({
      code: 'synthetic',
      name_de: 'Synthetic',
      name_en: 'Synthetic',
      nutrients: {
        ENERCC: 10,
        PROT625: 1,
        CHO: 1,
        FAT: 1,
        MG: 45,
        CU: 450,
        VITB6: 150,
        ZN: 0,
        VITA: 600,
        VITAA: 550,
        FOL: 100,
        FOLFD: 90,
        ID: 20,
        VITD: 5,
      },
      qualifiers: { VITD: '<LOQ' },
    })!;
    expect(food.default_variant.nutrient_quantities).toEqual(
      expect.arrayContaining([
        { catalogId: 'magnesium', amount: 45, unit: 'mg' },
        { catalogId: 'copper', amount: 450, unit: 'µg' },
        { catalogId: 'vitamin_b6', amount: 150, unit: 'µg' },
        { catalogId: 'zinc', amount: 0, unit: 'mg' },
      ])
    );
    expect(
      food.default_variant.nutrient_quantities?.some((quantity) =>
        ['vitamin_a', 'folate', 'iodine', 'vitamin_d'].includes(
          quantity.catalogId
        )
      )
    ).toBe(false);
  });
  it('restricts substance-specific IU conversion to vitamin D', () => {
    expect(convertCatalogNutrientAmount('vitamin_d', 400, 'IU', 'µg')).toBe(10);
    expect(convertCatalogNutrientAmount('vitamin_d', 10, 'µg', 'IU')).toBe(400);
    expect(
      convertCatalogNutrientAmount('vitamin_a', 400, 'IU', 'µg')
    ).toBeNull();
    expect(
      convertCatalogNutrientAmount('vitamin_d', Infinity, 'IU', 'µg')
    ).toBeNull();
  });
  it('includes measured zero and excludes entirely unknown days from averages', () => {
    expect(
      averageRecordedNutrient(
        {
          '2026-10-01': {
            magnesium: {
              knownEntryCount: 1,
              eligibleEntryCount: 2,
              recordedTotal: 0,
              unit: 'mg',
            },
          },
          '2026-10-02': {
            magnesium: {
              knownEntryCount: 0,
              eligibleEntryCount: 1,
              recordedTotal: null,
              unit: 'mg',
            },
          },
        },
        'magnesium'
      )
    ).toBe(0);
    expect(averageRecordedNutrient({}, 'magnesium')).toBeNull();
  });
});
