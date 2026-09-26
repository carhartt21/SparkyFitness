import { fireEvent, render, waitFor } from '@testing-library/react-native';
import NutritionPhotoEntries from '../../src/components/NutritionPhotoEntries';
import type { PendingPhotoAction } from '../../src/services/nutritionActionOutbox';
import type { NutritionCapture } from '../../src/services/api/nutritionCaptureApi';
import { completeMealPhotoLocally } from '../../src/services/nutritionPhotoCompletion';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

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
  getActiveServerConfig: jest.fn().mockResolvedValue({
    url: 'https://test.invalid',
    authType: 'session',
    sessionToken: 'synthetic',
    proxyHeaders: [],
  }),
  proxyHeadersToRecord: jest.fn(() => ({})),
}));
jest.mock('../../src/components/SafeImage', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ source }: { source: { uri: string } }) => (
      <View testID="capture-photo" source={source} />
    ),
  };
});

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
        isConnected={false}
      />
    );
    expect(screen.getAllByText('Incomplete meal')).toHaveLength(1);
    expect(screen.getByText('1 incomplete')).toBeTruthy();
    expect(screen.getByTestId('capture-photo').props.source.uri).toBe(
      photo.payload.images[0].uri
    );
  });

  test('server reconciliation retains one row and prefers its protected image online', async () => {
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
        isConnected={true}
      />
    );
    expect(screen.getAllByText('Incomplete meal')).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getByTestId('capture-photo').props.source.uri).toBe(
        `https://test.invalid/api/nutrition-captures/${id}/images/image-1/file`
      )
    );
  });

  test('manual completion saves a snapshot against the original offline capture', async () => {
    const screen = render(
      <NutritionPhotoEntries
        local={[photo]}
        remote={[]}
        completions={[]}
        completedFoodEntries={[]}
        isConnected={false}
      />
    );
    fireEvent.press(screen.getByText('Manual'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Food name'),
      'Synthetic sandwich'
    );
    fireEvent.changeText(screen.getByPlaceholderText('Calories'), '250');
    fireEvent.press(screen.getByText('Save manual nutrition'));
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

  test('search preserves the original capture and meal category', () => {
    const withCategory = {
      ...photo,
      payload: {
        ...photo.payload,
        mealTypeId: 'e8cde49b-9083-4132-aa4a-000000000001',
      },
    } as PendingPhotoAction;
    const screen = render(
      <NutritionPhotoEntries
        local={[withCategory]}
        remote={[]}
        completions={[]}
        completedFoodEntries={[]}
        isConnected={false}
      />
    );
    fireEvent.press(screen.getByLabelText('Complete meal'));
    expect(mockNavigate).toHaveBeenCalledWith('FoodSearch', {
      date: photo.payload.entryDate,
      mealTypeId: withCategory.payload.mealTypeId,
      photoCapture: {
        id,
        consumedAt: photo.payload.consumedAt,
        entryDate: photo.payload.entryDate,
        mealTypeId: withCategory.payload.mealTypeId,
      },
    });
  });

  test('completed capture leaves the photo queue once its linked diary row exists', () => {
    const screen = render(
      <NutritionPhotoEntries
        local={[photo]}
        remote={[]}
        completions={[]}
        completedFoodEntries={[
          { id: 'entry-1', nutrition_capture_id: id } as never,
        ]}
        isConnected={true}
      />
    );
    expect(screen.queryByText('Meal photos')).toBeNull();
  });

  test('locally completed capture leaves the photo queue before sync', () => {
    const screen = render(
      <NutritionPhotoEntries
        local={[photo]}
        remote={[]}
        completions={[
          {
            type: 'completePhotoEntry',
            payload: {
              captureId: id,
              food: { food_name: 'Test bread', calories: 200 },
            },
          } as never,
        ]}
        completedFoodEntries={[]}
        isConnected={false}
      />
    );
    expect(screen.queryByText('Meal photos')).toBeNull();
  });
});
