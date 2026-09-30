import { projectPhotoCompletions } from '../../src/utils/projectPhotoCompletions';
import type { PendingPhotoCompletionAction } from '../../src/services/nutritionActionOutbox';
import type { FoodEntry } from '../../src/types/foodEntries';

const captureId = '3116b172-7248-4c9e-aa4a-000000000001';
const completion = {
  clientOperationId: '59a3efbe-49cd-4c32-940a-000000000001',
  payload: {
    captureId,
    entryDate: '2026-09-23',
    food: {
      meal_type_id: 'lunch-id',
      quantity: 42,
      unit: 'g',
      food_name: 'Test bread',
      serving_size: 100,
      serving_unit: 'g',
      calories: 250,
      protein: 12,
    },
  },
} as PendingPhotoCompletionAction;

describe('photo completion diary projection', () => {
  it('shows a local food row with the reviewed portion and original capture ID', () => {
    const rows = projectPhotoCompletions(
      [completion],
      [],
      [{ id: 'lunch-id', name: 'Lunch' } as never]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: `local-photo:${captureId}`,
      nutrition_capture_id: captureId,
      meal_type: 'Lunch',
      quantity: 42,
      serving_size: 100,
      calories: 250,
      protein: 12,
      isPendingNutrition: true,
    });
  });

  it('hands the row to the server diary without duplication after reconciliation', () => {
    const server = {
      id: 'server-entry',
      nutrition_capture_id: captureId,
    } as FoodEntry;
    expect(projectPhotoCompletions([completion], [server], [])).toEqual([]);
  });
});
