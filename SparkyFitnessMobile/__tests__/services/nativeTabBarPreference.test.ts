import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook } from '@testing-library/react-native';
import {
  useNativeIOSTabsActive,
  useNativeIOSHeadersActive,
} from '../../src/services/nativeTabBarPreference';
import {
  useAppPreferencesStore,
  __resetAppPreferencesStoreForTests,
} from '../../src/stores/appPreferencesStore';
import { canUseLiquidGlass } from '../../src/utils/liquidGlass';

jest.mock('../../src/utils/liquidGlass', () => ({
  canUseLiquidGlass: jest.fn(),
}));

const mockCanUseLiquidGlass = canUseLiquidGlass as jest.MockedFunction<
  typeof canUseLiquidGlass
>;

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetAppPreferencesStoreForTests();
  mockCanUseLiquidGlass.mockReset();
});

describe('useNativeIOSTabsActive', () => {
  it('always uses the X on Track tab bar', () => {
    for (const available of [false, true]) {
      mockCanUseLiquidGlass.mockReturnValue(available);
      const { result } = renderHook(() => useNativeIOSTabsActive());
      expect(result.current).toBe(false);
    }
  });

  it('ignores a Liquid Glass choice saved by an older build', async () => {
    mockCanUseLiquidGlass.mockReturnValue(true);
    await AsyncStorage.setItem(
      '@HealthConnect:liquidGlassTabBarEnabled',
      'true'
    );
    await useAppPreferencesStore.persist.rehydrate();
    expect(renderHook(() => useNativeIOSTabsActive()).result.current).toBe(
      false
    );
    expect(renderHook(() => useNativeIOSHeadersActive()).result.current).toBe(
      false
    );
  });
});

describe('useNativeIOSHeadersActive', () => {
  it('keeps the classic native header where glass APIs are unavailable', () => {
    mockCanUseLiquidGlass.mockReturnValue(false);
    const { result } = renderHook(() => useNativeIOSHeadersActive());
    expect(result.current).toBe(true);
  });

  it('uses the screen-owned X on Track header on iOS 26+', () => {
    mockCanUseLiquidGlass.mockReturnValue(true);
    const { result } = renderHook(() => useNativeIOSHeadersActive());
    expect(result.current).toBe(false);
  });
});
