import { fireEvent, render, waitFor } from '@testing-library/react-native';
import NutritionPhotoEntries from '../../src/components/NutritionPhotoEntries';
import type { PendingPhotoAction } from '../../src/services/nutritionActionOutbox';
import type { NutritionCapture } from '../../src/services/api/nutritionCaptureApi';
import { completeMealPhotoLocally } from '../../src/services/nutritionPhotoCompletion';

jest.mock('../../src/services/nutritionPhotoCompletion', () => ({
  completeMealPhotoLocally: jest
    .fn()
    .mockResolvedValue({ clientOperationId: 'operation-1' }),
}));
jest.mock('../../src/services/nutritionActionSync', () => ({
  reconcileNutritionActions: jest
    .fn()
    .mockResolvedValue({ processed: 0, nextDelayMs: null }),
}));

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn().mockResolvedValue(null),
  proxyHeadersToRecord: jest.fn(() => ({})),
}));

const id = '3116b172-7248-4c9e-aa4a-000000000001';
const photo: PendingPhotoAction = {
  version: 1,
  type: 'createPhotoEntry',
  clientOperationId: id,
  serverConfigId: 'server-a',
  userId: 'user-a',
  occurredAt: '2026-09-23T12:00:00.000Z',
  createdAt: '2026-09-23T12:00:00.000Z',
  payload: {
    id,
    capturedAt: '2026-09-23T12:00:00.000Z',
    consumedAt: '2026-09-23T12:00:00.000Z',
    entryDate: '2026-09-23',
    images: [{ id: 'image-1', uri: 'file:///documents/meal.jpg' }],
  },
  syncState: 'pending',
  retryCount: 0,
  lastAttemptAt: null,
  lastError: null,
  serverIdentity: null,
};

describe('NutritionPhotoEntries', () => {
  test('offline photo is one incomplete entry with unknown nutrition', () => {
    const screen = render(
      <NutritionPhotoEntries
        local={[photo]}
        remote={[]}
        completions={[]}
        completedFoodEntries={[]}
      />
    );
    expect(screen.getAllByText('Incomplete meal')).toHaveLength(1);
    expect(screen.getByText('1 incomplete')).toBeTruthy();
  });

  test('server reconciliation retains one logical photo row', () => {
    const remote: NutritionCapture = {
      id,
      user_id: 'user-a',
      captured_at: photo.payload.capturedAt,
      consumed_at: photo.payload.consumedAt,
      entry_date: photo.payload.entryDate,
      meal_type_id: null,
      notes: null,
      completion_state: 'incomplete',
      images: [
        {
          id: 'image-1',
          url: `/api/nutrition-captures/${id}/images/image-1/file`,
        },
      ],
    };
    const screen = render(
      <NutritionPhotoEntries
        local={[photo]}
        remote={[remote]}
        completions={[]}
        completedFoodEntries={[]}
      />
    );
    expect(screen.getAllByText('Incomplete meal')).toHaveLength(1);
  });

  test('manual completion saves a snapshot against the original offline capture', async () => {
    const screen = render(
      <NutritionPhotoEntries
        local={[photo]}
        remote={[]}
        completions={[]}
        completedFoodEntries={[]}
      />
    );
    fireEvent.press(screen.getByLabelText('Complete meal'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Food name'),
      'Synthetic sandwich'
    );
    fireEvent.changeText(screen.getByPlaceholderText('Calories'), '250');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() =>
      expect(completeMealPhotoLocally).toHaveBeenCalledWith(
        expect.objectContaining({
          captureId: id,
          consumedAt: photo.payload.consumedAt,
          entryDate: photo.payload.entryDate,
          name: 'Synthetic sandwich',
          calories: 250,
        })
      )
    );
  });
});
