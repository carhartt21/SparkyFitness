import type { MedicationEntry } from '@workspace/shared';
import { supplementWritebackEntries } from '../../src/services/shared/supplementWriteback';
import { foodEntryToNutrientSamples } from '../../src/services/healthkit/writebackMappers';
import { foodEntryToNutritionRecord } from '../../src/services/healthconnect/writebackMappers';
jest.mock('react-native-health-connect', () => ({
  RecordingMethod: { RECORDING_METHOD_MANUAL_ENTRY: 3 },
}));
const day = '2026-10-01';
const intake = (change: Partial<MedicationEntry> = {}): MedicationEntry => ({
  id: 'dose-1',
  user_id: 'owner',
  medication_id: 'supplement',
  schedule_id: null,
  entry_date: day,
  taken_at: '2026-10-01T11:05:06Z',
  scheduled_for: null,
  status: 'taken',
  source: 'manual',
  med_name_snapshot: 'Electrolytes',
  dose_amount_snapshot: 2,
  dose_unit_snapshot: 'serving',
  notes: null,
  custom_fields: {},
  created_at: '2026-10-01T11:05:06Z',
  updated_at: '2026-10-01T11:05:06Z',
  nutrients_snapshot: { dietary_fiber: 3, custom_nutrients: { Magnesium: 40 } },
  ...change,
});
const definitions = [
  { id: 'mg', name: 'Magnesium', unit: 'mg', catalog_id: 'magnesium' },
];
const now = new Date('2026-10-02T12:00:00Z');
describe('supplement native nutrition projection', () => {
  it('exports one immutable consumed dose, with its actual timestamp and no invented calories', () => {
    const [entry] = supplementWritebackEntries([intake()], day);
    expect(entry.id).toBe('supplement:dose-1');
    expect(entry.calories).toBeUndefined();
    const descriptor = foodEntryToNutrientSamples(entry, now, definitions)!;
    expect(descriptor.start.toISOString()).toBe('2026-10-01T11:05:06.000Z');
    expect(descriptor.samples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          quantityType: 'HKQuantityTypeIdentifierDietaryFiber',
          quantity: 6,
          unit: 'g',
        }),
        expect.objectContaining({
          quantityType: 'HKQuantityTypeIdentifierDietaryMagnesium',
          quantity: 0.08,
          unit: 'g',
        }),
      ])
    );
    expect(
      descriptor.samples.some(
        (sample) =>
          sample.quantityType ===
          'HKQuantityTypeIdentifierDietaryEnergyConsumed'
      )
    ).toBe(false);
    const record = foodEntryToNutritionRecord(entry, 123, now, definitions)!;
    expect(record).toMatchObject({
      dietaryFiber: { value: 6, unit: 'grams' },
      magnesium: { value: 0.08, unit: 'grams' },
    });
  });
  it.each([
    { status: 'skipped' as const },
    { status: 'snoozed' as const },
    { nutrients_snapshot: null },
    { entry_date: '2026-09-30' },
    { dose_amount_snapshot: 0 },
    { dose_amount_snapshot: -2 },
    { taken_at: 'invalid' },
    { source: 'Apple Health' },
  ])('excludes unconfirmed, invalid or imported intake: %j', (change) => {
    expect(supplementWritebackEntries([intake(change)], day)).toEqual([]);
  });
  it('keeps medication-only records out and defers a future intake', () => {
    expect(
      supplementWritebackEntries([intake({ nutrients_snapshot: null })], day)
    ).toEqual([]);
    const [entry] = supplementWritebackEntries([intake()], day);
    expect(
      foodEntryToNutrientSamples(
        entry,
        new Date('2026-10-01T10:00:00Z'),
        definitions
      )
    ).toBeNull();
  });
});
