import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveServerConfigId } from '../../src/services/storage';
import {
  forgetActiveNutritionIdentity,
  getActiveNutritionIdentity,
  rememberActiveNutritionUser,
  subscribeNutritionIdentity,
} from '../../src/services/nutritionIdentity';

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfigId: jest.fn(),
}));

describe('nutrition identity partition', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.mocked(getActiveServerConfigId).mockReset();
    jest.mocked(getActiveServerConfigId).mockResolvedValue('server-1');
  });

  it('remembers the authenticated profile for offline use', async () => {
    await rememberActiveNutritionUser('user-1');
    expect(await getActiveNutritionIdentity()).toEqual({
      serverConfigId: 'server-1',
      userId: 'user-1',
    });
  });

  it('does not reuse an old account after identity change', async () => {
    await rememberActiveNutritionUser('user-1');
    await forgetActiveNutritionIdentity();
    expect(await getActiveNutritionIdentity()).toBeNull();
    await rememberActiveNutritionUser('user-2');
    expect((await getActiveNutritionIdentity())?.userId).toBe('user-2');
  });

  it('separates saved identities by server config', async () => {
    await rememberActiveNutritionUser('user-1');
    jest.mocked(getActiveServerConfigId).mockResolvedValue('server-2');
    expect(await getActiveNutritionIdentity()).toBeNull();
    await rememberActiveNutritionUser('user-2');
    expect((await getActiveNutritionIdentity())?.userId).toBe('user-2');
  });

  it('preserves unreadable state and refuses to infer an owner', async () => {
    const key = '@SparkyFitness/nutrition-identity/v1/server-1';
    await AsyncStorage.setItem(key, '{');
    await expect(getActiveNutritionIdentity()).rejects.toThrow('unreadable');
    expect(await AsyncStorage.getItem(key)).toBe('{');
  });

  it('notifies subscribers after identity changes', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeNutritionIdentity(listener);
    await rememberActiveNutritionUser('user-1');
    await forgetActiveNutritionIdentity();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
