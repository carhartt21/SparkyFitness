import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadDraft,
  saveDraft,
  clearDraft,
} from '../../src/services/workoutDraftService';
import type { WorkoutDraft } from '../../src/hooks/useWorkoutForm';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';

jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));

const activeIdentity = getActiveNutritionIdentity as jest.Mock;
const firstAccount = { serverConfigId: 'server-1', userId: 'user-1' };

describe('workoutDraftService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    activeIdentity.mockResolvedValue(firstAccount);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const testDraft: WorkoutDraft = {
    type: 'workout',
    name: 'Push Day',
    entryDate: '2026-03-12',
    exercises: [
      {
        clientId: 'ex-1',
        exerciseId: 'uuid-bench',
        exerciseName: 'Bench Press',
        exerciseCategory: 'Strength',
        sets: [
          { clientId: 'set-1', weight: '135', reps: '10' },
          { clientId: 'set-2', weight: '155', reps: '8' },
        ],
      },
    ],
  };

  describe('save and load round-trip', () => {
    it('saves and loads a draft correctly', async () => {
      await saveDraft(testDraft);
      const loaded = await loadDraft();
      expect(loaded).toEqual(testDraft);
    });
  });

  describe('loadDraft', () => {
    it('returns null when no draft exists', async () => {
      const result = await loadDraft();
      expect(result).toBeNull();
    });

    it('returns null for malformed JSON', async () => {
      await AsyncStorage.setItem(
        '@SparkyFitness/session-draft/v2/server-1/user-1',
        'not valid json{{{'
      );
      const result = await loadDraft();
      expect(result).toBeNull();
    });

    it('does not expose or overwrite another account or server draft', async () => {
      await saveDraft(testDraft);
      activeIdentity.mockResolvedValue({
        serverConfigId: 'server-1',
        userId: 'user-2',
      });
      expect(await loadDraft()).toBeNull();
      await clearDraft();
      activeIdentity.mockResolvedValue({
        serverConfigId: 'server-2',
        userId: 'user-1',
      });
      expect(await loadDraft()).toBeNull();
      activeIdentity.mockResolvedValue(firstAccount);
      expect(await loadDraft()).toEqual(testDraft);
    });

    it('rejects a delayed write tied to an account that is no longer active', async () => {
      activeIdentity.mockResolvedValue({
        serverConfigId: 'server-1',
        userId: 'user-2',
      });
      await saveDraft(testDraft, firstAccount);
      expect(await loadDraft()).toBeNull();
      activeIdentity.mockResolvedValue(firstAccount);
      expect(await loadDraft()).toBeNull();
    });

    it('does not restore an unowned legacy draft', async () => {
      await AsyncStorage.setItem('@SessionDraft', JSON.stringify(testDraft));
      expect(await loadDraft()).toBeNull();
    });

    it('does not persist a draft without a verified identity', async () => {
      activeIdentity.mockResolvedValue(null);
      await saveDraft(testDraft);
      expect(await loadDraft()).toBeNull();
      activeIdentity.mockResolvedValue(firstAccount);
      expect(await loadDraft()).toBeNull();
    });
  });

  describe('clearDraft', () => {
    it('removes the draft from storage', async () => {
      await saveDraft(testDraft);
      await clearDraft();
      const result = await loadDraft();
      expect(result).toBeNull();
    });

    it('does not throw when clearing with no draft', async () => {
      await expect(clearDraft()).resolves.not.toThrow();
    });

    it('stays cleared when an earlier autosave is still in flight', async () => {
      const setItem = jest.mocked(AsyncStorage.setItem);
      const originalSetItem = setItem.getMockImplementation();
      if (!originalSetItem) throw new Error('AsyncStorage mock is unavailable');
      let releaseWrite: () => void = () => undefined;
      let reportWriteStarted: () => void = () => undefined;
      const writeStarted = new Promise<void>((resolve) => {
        reportWriteStarted = resolve;
      });
      const writeGate = new Promise<void>((resolve) => {
        releaseWrite = resolve;
      });
      setItem.mockImplementation(async (key, value) => {
        if (key.startsWith('@SparkyFitness/session-draft/v2/')) {
          reportWriteStarted();
          await writeGate;
        }
        return originalSetItem(key, value);
      });
      try {
        const saving = saveDraft(testDraft, firstAccount);
        await writeStarted;
        const clearing = clearDraft(firstAccount);
        releaseWrite();
        await Promise.all([saving, clearing]);

        expect(await loadDraft(firstAccount)).toBeNull();
      } finally {
        releaseWrite();
        setItem.mockImplementation(originalSetItem);
      }
    });
  });
});
