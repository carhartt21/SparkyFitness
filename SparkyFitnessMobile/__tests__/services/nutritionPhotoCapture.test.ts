import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isMealPhotoAvailable,
  saveMealPhotoLocally,
} from '../../src/services/nutritionPhotoCapture';
import { listNutritionActions } from '../../src/services/nutritionActionOutbox';
import { rememberActiveNutritionUser } from '../../src/services/nutritionIdentity';

const mockFileSizes = new Map<string, number>();
const mockDirectories = new Set<string>();

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfigId: jest.fn().mockResolvedValue('server-a'),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));
jest.mock('expo-file-system', () => {
  class MockDirectory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts
        .map((part) => (typeof part === 'string' ? part : part.uri))
        .join('/');
    }
    create() {
      mockDirectories.add(this.uri);
    }
    get exists() {
      return mockDirectories.has(this.uri);
    }
    delete() {
      mockDirectories.delete(this.uri);
      for (const key of mockFileSizes.keys())
        if (key.startsWith(this.uri)) mockFileSizes.delete(key);
    }
  }
  class MockFile {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts
        .map((part) => (typeof part === 'string' ? part : part.uri))
        .join('/');
    }
    get exists() {
      return mockFileSizes.has(this.uri);
    }
    get size() {
      return mockFileSizes.get(this.uri) ?? 0;
    }
    async copy(destination: MockFile) {
      const size = mockFileSizes.get(this.uri);
      if (!size) throw new Error('Missing source image');
      mockFileSizes.set(destination.uri, size);
    }
  }
  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: { document: { uri: 'file:///documents' } },
  };
});

const owner = { serverConfigId: 'server-a', userId: 'user-a' };

describe('durable photo-first nutrition capture', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockFileSizes.clear();
    mockDirectories.clear();
    let sequence = 0;
    (
      jest.requireMock('expo-crypto') as { randomUUID: jest.Mock }
    ).randomUUID.mockImplementation(
      () => `3116b172-7248-4c9e-aa4a-${String(++sequence).padStart(12, '0')}`
    );
    await rememberActiveNutritionUser('user-a');
    mockFileSizes.set('file:///picker/meal.jpg', 1234);
  });

  test('copies a photo to documents and persists an incomplete action with original time', async () => {
    const capturedAt = '2026-09-23T12:34:56.000Z';
    const action = await saveMealPhotoLocally({
      sourceUri: 'file:///picker/meal.jpg',
      capturedAt,
    });
    expect(action.payload.capturedAt).toBe(capturedAt);
    expect(action.payload.consumedAt).toBe(capturedAt);
    expect(action.payload).not.toHaveProperty('calories');
    expect(action.payload.images).toHaveLength(1);
    expect(action.payload.images[0].uri).toContain('nutrition-captures');
    expect(isMealPhotoAvailable(action.payload.images[0].uri)).toBe(true);
    expect((await listNutritionActions(owner))[0]).toEqual(action);
  });

  test('a failed outbox write removes the copied photo and reports failure', async () => {
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(
      saveMealPhotoLocally({ sourceUri: 'file:///picker/meal.jpg' })
    ).rejects.toThrow('disk full');
    expect(await listNutritionActions(owner)).toEqual([]);
    expect([...mockFileSizes.keys()]).toEqual(['file:///picker/meal.jpg']);
    setItem.mockRestore();
  });
});
