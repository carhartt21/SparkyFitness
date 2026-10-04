import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';
import { useMotionPreferences } from '../../src/hooks/useMotionPreferences';

describe('native motion preferences', () => {
  const originalAppState = AppState.currentState;
  let reduceChanged: (value: boolean) => void;
  let appChanged: (value: AppStateStatus) => void;
  const remove = jest.fn();
  beforeEach(() => {
    AppState.currentState = 'active';
    jest.mocked(useReducedMotion).mockReturnValue(false);
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockImplementation((_event, listener) => {
        reduceChanged = listener;
        return { remove };
      });
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        appChanged = listener;
        return { remove };
      });
    remove.mockClear();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    AppState.currentState = originalAppState;
  });

  it('reacts to native accessibility and foreground changes, then unsubscribes', async () => {
    const { result, unmount } = renderHook(useMotionPreferences);
    await act(async () => undefined);
    expect(result.current).toEqual({ active: true, reducedMotion: false });
    act(() => reduceChanged(true));
    expect(result.current.reducedMotion).toBe(true);
    act(() => {
      AppState.currentState = 'background';
      appChanged('background');
    });
    expect(result.current.active).toBe(false);
    act(() => {
      AppState.currentState = 'active';
      appChanged('active');
    });
    expect(result.current.active).toBe(true);
    unmount();
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('uses the synchronous launch preference and rechecks on a later mount', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(true);
    const { result } = renderHook(useMotionPreferences);
    expect(result.current.reducedMotion).toBe(true);
    await act(async () => undefined);
    expect(result.current.reducedMotion).toBe(true);
  });

  it('tracks screen focus without requiring a navigator for previews', async () => {
    let focused = true;
    const listeners = new Map<string, () => void>();
    const navigation = {
      isFocused: () => focused,
      addListener: (event: string, listener: () => void) => {
        listeners.set(event, listener);
        return () => listeners.delete(event);
      },
    } as NonNullable<React.ContextType<typeof NavigationContext>>;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NavigationContext.Provider value={navigation}>
        {children}
      </NavigationContext.Provider>
    );
    const { result, unmount } = renderHook(useMotionPreferences, { wrapper });
    await act(async () => undefined);
    act(() => {
      focused = false;
      listeners.get('blur')?.();
    });
    expect(result.current.active).toBe(false);
    act(() => {
      focused = true;
      listeners.get('focus')?.();
    });
    expect(result.current.active).toBe(true);
    unmount();
    expect(listeners.size).toBe(0);
  });

  it('does not let a slow startup query overwrite a newer native preference event', async () => {
    let resolveQuery: (value: boolean) => void = () => undefined;
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveQuery = resolve;
      })
    );
    const { result } = renderHook(useMotionPreferences);
    act(() => reduceChanged(true));
    await act(async () => resolveQuery(false));
    expect(result.current.reducedMotion).toBe(true);
  });
});
