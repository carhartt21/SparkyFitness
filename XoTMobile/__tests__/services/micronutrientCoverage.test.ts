jest.mock('react-native-health-connect', () => ({
  RecordingMethod: { RECORDING_METHOD_MANUAL_ENTRY: 3 },
}));
import { transformHealthRecords as transformHealthKit } from '../../src/services/healthkit/dataTransformation';
import { transformHealthRecords as transformHealthConnect } from '../../src/services/healthconnect/dataTransformation';
import { foodEntryToNutrientSamples } from '../../src/services/healthkit/writebackMappers';
import { foodEntryToNutritionRecord } from '../../src/services/healthconnect/writebackMappers';
import type { FoodEntry } from '../../src/types/foodEntries';
import type { TransformedNutritionEntry } from '../../src/types/healthRecords';

jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));
const config = { recordType: 'Nutrition', unit: 'kcal', type: 'nutrition' };
const now = new Date('2026-10-02T23:00:00');

describe('micronutrient collection and writeback', () => {
  it('retains a micro-only HealthKit correlation and a measured zero', () => {
    const result = transformHealthKit(
      [
        {
          uuid: 'micro-only',
          startDate: '2026-10-01T12:00:00',
          sourceBundleId: 'other',
          objects: [
            {
              quantityType: 'HKQuantityTypeIdentifierDietaryMagnesium',
              quantity: 45,
              unit: 'mg',
            },
            {
              quantityType: 'HKQuantityTypeIdentifierDietaryZinc',
              quantity: 0,
              unit: 'mg',
            },
          ],
        },
      ],
      config
    ) as TransformedNutritionEntry[];
    expect(result).toHaveLength(1);
    expect(result[0].nutrient_observation).toEqual({
      mode: 'partial',
      quantities: [
        { catalogId: 'magnesium', amount: 0.045, unit: 'g' },
        { catalogId: 'zinc', amount: 0, unit: 'g' },
      ],
    });
  });
  it('reads Health Connect micro quantities without treating unset zero as observed', () => {
    const result = transformHealthConnect(
      [
        {
          metadata: { id: 'hc-micro', dataOrigin: 'other' },
          startTime: '2026-10-01T12:00:00Z',
          endTime: '2026-10-01T12:00:01Z',
          magnesium: { inGrams: 0.045 },
          zinc: { inGrams: 0 },
        },
      ],
      config
    ) as TransformedNutritionEntry[];
    expect(result[0].nutrient_observation).toEqual({
      mode: 'partial',
      quantities: [{ catalogId: 'magnesium', amount: 0.045, unit: 'g' }],
    });
  });
  it('writes the consumed amount from the actual bound unit on both platforms', () => {
    const entry: FoodEntry = {
      id: 'synthetic',
      entry_date: '2026-10-01',
      meal_type: 'lunch',
      quantity: 50,
      unit: 'g',
      serving_size: 100,
      custom_nutrients: { 'My magnesium': 100, 'Vitamin D': 400 },
    };
    const definitions = [
      { id: 'mg', name: 'My magnesium', unit: 'mg', catalog_id: 'magnesium' },
      { id: 'd', name: 'Vitamin D', unit: 'IU', catalog_id: 'vitamin_d' },
    ];
    const hk = foodEntryToNutrientSamples(entry, now, definitions);
    expect(
      hk?.samples.find(
        (sample) =>
          sample.quantityType === 'HKQuantityTypeIdentifierDietaryMagnesium'
      )?.quantity
    ).toBe(0.05);
    expect(
      hk?.samples.find(
        (sample) =>
          sample.quantityType === 'HKQuantityTypeIdentifierDietaryVitaminD'
      )?.quantity
    ).toBe(0.000005);
    const hc = foodEntryToNutritionRecord(entry, 1, now, definitions);
    expect(hc).toMatchObject({
      magnesium: { value: 0.05, unit: 'grams' },
      vitaminD: { value: 0.000005, unit: 'grams' },
    });
  });
  it('preserves quantities smaller than one microgram on native writeback', () => {
    const entry: FoodEntry = {
      id: 'tiny',
      entry_date: '2026-10-01',
      meal_type: 'lunch',
      quantity: 1,
      serving_size: 1,
      unit: 'serving',
      custom_nutrients: { Selenium: 0.1 },
    };
    const definitions = [
      { id: 'se', name: 'Selenium', unit: 'µg', catalog_id: 'selenium' },
    ];
    expect(
      foodEntryToNutrientSamples(entry, now, definitions)?.samples[0].quantity
    ).toBeCloseTo(1e-7, 12);
    expect(
      foodEntryToNutritionRecord(entry, 1, now, definitions)
    ).toMatchObject({ selenium: { value: 1e-7, unit: 'grams' } });
  });
  it('does not export an unbound name or guess its unit', () => {
    const entry: FoodEntry = {
      id: 'synthetic',
      entry_date: '2026-10-01',
      meal_type: 'lunch',
      quantity: 1,
      unit: 'serving',
      serving_size: 1,
      custom_nutrients: { Magnesium: 100 },
    };
    expect(
      foodEntryToNutrientSamples(entry, now, [
        { id: 'unbound', name: 'Magnesium', unit: 'mg' },
      ])
    ).toBeNull();
  });
});
