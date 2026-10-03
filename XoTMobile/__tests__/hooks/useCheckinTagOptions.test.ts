import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCheckinTagOptions } from '../../src/hooks/useCheckinTagOptions';
import {
  __resetAppPreferencesStoreForTests,
  useAppPreferencesStore,
} from '../../src/stores/appPreferencesStore';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';

let identityChanged: (() => void) | undefined;
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
  subscribeNutritionIdentity: (listener: () => void) => {
    identityChanged = listener;
    return () => {
      identityChanged = undefined;
    };
  },
}));

describe('saved check-in tag options', () => {
  beforeEach(() => {
    __resetAppPreferencesStoreForTests();
    jest.mocked(getActiveNutritionIdentity).mockReset();
    jest
      .mocked(getActiveNutritionIdentity)
      .mockResolvedValue({ serverConfigId: 'server', userId: 'one' });
  });

  it('recovers historical tags and keeps options when the loaded selection is empty', async () => {
    const { result, rerender } = renderHook(
      ({ tags }) => useCheckinTagOptions(tags),
      { initialProps: { tags: ['Eigener Test', 'busy_day'] } }
    );
    await waitFor(() => expect(result.current.tags).toEqual(['Eigener Test']));
    rerender({ tags: [] });
    expect(result.current.tags).toEqual(['Eigener Test']);
    act(() => result.current.remember('Zweiter Test'));
    expect(result.current.tags).toEqual(['Eigener Test', 'Zweiter Test']);
  });

  it('changes account without moving the old screen’s historical tags into the other account', async () => {
    const { result } = renderHook(() =>
      useCheckinTagOptions(['Privater Test'])
    );
    await waitFor(() => expect(result.current.canRemember).toBe(true));
    jest
      .mocked(getActiveNutritionIdentity)
      .mockResolvedValue({ serverConfigId: 'server', userId: 'two' });
    act(() => identityChanged?.());
    expect(result.current.tags).toEqual([]);
    await waitFor(() => expect(result.current.canRemember).toBe(true));
    expect(result.current.tags).toEqual([]);
    act(() => result.current.remember('Anderer Test'));
    expect(
      useAppPreferencesStore.getState().checkinCustomTagsByAccount
    ).toEqual({
      '["server","one"]': ['Privater Test'],
      '["server","two"]': ['Anderer Test'],
    });
  });

  it('does not save options under an unknown or unreadable identity', async () => {
    jest
      .mocked(getActiveNutritionIdentity)
      .mockRejectedValue(new Error('Unreadable identity'));
    const { result } = renderHook(() => useCheckinTagOptions([]));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.canRemember).toBe(false);
    act(() => result.current.remember('Nicht zuordnen'));
    expect(
      useAppPreferencesStore.getState().checkinCustomTagsByAccount
    ).toEqual({});
  });
});
