import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import FoodPhotoImproveScreen from '../../src/screens/FoodPhotoImproveScreen';
import { useEstimateFoodPhoto } from '../../src/hooks/useEstimateFoodPhoto';
import i18n, { initializeI18n } from '../../src/localization/i18n';

jest.mock('../../src/hooks/useEstimateFoodPhoto', () => ({
  useEstimateFoodPhoto: jest.fn(),
}));

const mockBase64 = jest.fn().mockResolvedValue('AAAA-base64');
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    base64: mockBase64,
  })),
  Paths: { cache: { uri: 'file:///mock/' } },
}));

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

const insets = { top: 0, bottom: 0, left: 0, right: 0 };
const frame = { x: 0, y: 0, width: 390, height: 844 };

describe('FoodPhotoImproveScreen', () => {
  const parentNavigation = {
    replace: jest.fn(),
    popToTop: jest.fn(),
  };
  const navigation = {
    replace: jest.fn(),
    goBack: jest.fn(),
    navigate: jest.fn(),
    popToTop: jest.fn(),
    getParent: jest.fn(() => parentNavigation),
  } as any;
  const baseRoute = {
    key: 'k',
    name: 'Improve' as const,
    params: {
      date: '2026-05-18',
      photo: { uri: 'file:///photo.jpg' },
      mealTypeId: undefined as string | undefined,
    },
  };

  const mockMutate = jest.fn();
  const mockUseEstimate = useEstimateFoodPhoto as jest.MockedFunction<
    typeof useEstimateFoodPhoto
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBase64.mockResolvedValue('AAAA-base64');
    navigation.getParent.mockReturnValue(parentNavigation);
    mockUseEstimate.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
  });

  const renderScreen = (overrides: Partial<typeof baseRoute.params> = {}) =>
    render(
      <SafeAreaProvider initialMetrics={{ insets, frame }}>
        <FoodPhotoImproveScreen
          navigation={navigation}
          route={{
            ...baseRoute,
            params: { ...baseRoute.params, ...overrides },
          }}
        />
      </SafeAreaProvider>
    );

  it('rejects negative weight', async () => {
    const screen = renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('e.g. 350'), '0');
    fireEvent.press(screen.getByText('Generate estimate'));

    await waitFor(() => {
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Invalid weight',
        })
      );
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('Generate with empty fields sends a single-image images[] payload, base64 is read once', async () => {
    const screen = renderScreen();

    fireEvent.press(screen.getByText('Generate estimate'));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });
    expect(mockBase64).toHaveBeenCalledTimes(1);
    const [input] = mockMutate.mock.calls[0];
    expect(input).toEqual(
      expect.objectContaining({
        images: [{ base64Image: 'AAAA-base64', mimeType: 'image/jpeg' }],
        description: undefined,
        totalWeight: undefined,
        weightUnit: undefined,
      })
    );
    expect(input.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not start a second estimate while the photo is being read', async () => {
    let finishRead: ((value: string) => void) | undefined;
    mockBase64.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishRead = resolve;
        })
    );
    const screen = renderScreen();

    fireEvent.press(screen.getByText('Generate estimate'));
    fireEvent.press(screen.getByText('Generate estimate'));

    expect(mockBase64).toHaveBeenCalledTimes(1);
    expect(mockMutate).not.toHaveBeenCalled();
    await act(async () => {
      finishRead?.('AAAA-base64');
    });
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it('does not submit a photo after leaving for manual logging during the local read', async () => {
    let finishRead: ((value: string) => void) | undefined;
    mockBase64.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishRead = resolve;
        })
    );
    const screen = renderScreen({ mealTypeId: 'snack' });

    fireEvent.press(screen.getByText('Generate estimate'));
    fireEvent.press(screen.getByText('Log manually'));
    await act(async () => {
      finishRead?.('AAAA-base64');
    });

    expect(mockMutate).not.toHaveBeenCalled();
    expect(parentNavigation.replace).toHaveBeenCalledWith('FoodSearch', {
      date: '2026-05-18',
      mealTypeId: 'snack',
    });
  });

  it('Generate path forwards weight+unit+description to the mutation', async () => {
    const screen = renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('e.g. 350'), '250');
    fireEvent.changeText(
      screen.getByPlaceholderText(/salmon with lemon/),
      'yogurt and berries'
    );
    fireEvent.press(screen.getByText('Generate estimate'));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });
    const [input] = mockMutate.mock.calls[0];
    expect(input).toEqual(
      expect.objectContaining({
        images: [{ base64Image: 'AAAA-base64', mimeType: 'image/jpeg' }],
        description: 'yogurt and berries',
        totalWeight: 250,
        weightUnit: 'g',
      })
    );
    expect(input.signal).toBeInstanceOf(AbortSignal);
  });

  it('shows the pending state (spinner, status message, cancel) while estimating', () => {
    mockUseEstimate.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      reset: jest.fn(),
    } as any);
    const screen = renderScreen();

    expect(screen.queryByText('Generate estimate')).toBeNull();
    expect(screen.queryByPlaceholderText('e.g. 350')).toBeNull();
    expect(screen.queryByPlaceholderText(/salmon with lemon/)).toBeNull();

    expect(screen.getByText('Reading your photo…')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('Cancel aborts the in-flight request and suppresses the error toast', async () => {
    const resetFn = jest.fn();
    let pending = false;
    mockUseEstimate.mockImplementation(
      () =>
        ({
          mutate: mockMutate,
          isPending: pending,
          reset: resetFn,
        }) as any
    );

    pending = false;
    const screen = renderScreen();

    fireEvent.press(screen.getByText('Generate estimate'));
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });
    const [input, callbacks] = mockMutate.mock.calls[0];
    const signal: AbortSignal = input.signal;
    expect(signal.aborted).toBe(false);

    pending = true;
    screen.rerender(
      <SafeAreaProvider initialMetrics={{ insets, frame }}>
        <FoodPhotoImproveScreen
          navigation={navigation}
          route={baseRoute as any}
        />
      </SafeAreaProvider>
    );

    fireEvent.press(screen.getByText('Cancel'));

    expect(signal.aborted).toBe(true);
    expect(resetFn).toHaveBeenCalledTimes(1);

    callbacks.onError({ code: 'UPSTREAM_ERROR', message: 'aborted' });
    expect(Toast.show).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('ignores a late success after Cancel, even when another estimate has started', async () => {
    const resetFn = jest.fn();
    let pending = false;
    mockUseEstimate.mockImplementation(
      () =>
        ({
          mutate: mockMutate,
          isPending: pending,
          reset: resetFn,
        }) as any
    );
    const screen = renderScreen();

    fireEvent.press(screen.getByText('Generate estimate'));
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    const firstCallbacks = mockMutate.mock.calls[0][1];

    pending = true;
    screen.rerender(
      <SafeAreaProvider initialMetrics={{ insets, frame }}>
        <FoodPhotoImproveScreen
          navigation={navigation}
          route={baseRoute as any}
        />
      </SafeAreaProvider>
    );
    fireEvent.press(screen.getByText('Cancel'));

    pending = false;
    screen.rerender(
      <SafeAreaProvider initialMetrics={{ insets, frame }}>
        <FoodPhotoImproveScreen
          navigation={navigation}
          route={baseRoute as any}
        />
      </SafeAreaProvider>
    );
    fireEvent.press(screen.getByText('Generate estimate'));
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(2));
    const secondCallbacks = mockMutate.mock.calls[1][1];

    firstCallbacks.onSuccess({ source: 'stale' });
    expect(navigation.navigate).not.toHaveBeenCalled();

    secondCallbacks.onSuccess({ source: 'current' });
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith(
      'EstimateReview',
      expect.objectContaining({ estimate: { source: 'current' } })
    );
  });

  it('offers manual logging after a provider timeout with the selected diary context', async () => {
    const screen = renderScreen({ mealTypeId: 'snack' });

    fireEvent.press(screen.getByText('Generate estimate'));
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    const [, callbacks] = mockMutate.mock.calls[0];

    callbacks.onError({ code: 'TIMEOUT', message: 'synthetic timeout' });
    fireEvent.press(screen.getByText('Log manually'));

    expect(parentNavigation.replace).toHaveBeenCalledWith('FoodSearch', {
      date: '2026-05-18',
      mealTypeId: 'snack',
    });
    callbacks.onSuccess({ source: 'stale' });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['NO_AI_CONFIGURED', 'AI not configured', true],
    ['TIMEOUT', 'AI provider timed out', false],
    ['PARSE_ERROR', "Couldn't reach AI provider", false],
  ])(
    'handles %s without opening an estimate review',
    async (code, title, leavesEstimateFlow) => {
      const screen = renderScreen();
      fireEvent.press(screen.getByText('Generate estimate'));
      await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));

      const callbacks = mockMutate.mock.calls[0][1];
      callbacks.onError({ code, message: 'synthetic provider failure' });

      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', text1: title })
      );
      expect(navigation.navigate).not.toHaveBeenCalled();
      if (leavesEstimateFlow) {
        expect(parentNavigation.popToTop).toHaveBeenCalledTimes(1);
      } else {
        expect(parentNavigation.popToTop).not.toHaveBeenCalled();
        expect(screen.getByText('Generate estimate')).toBeTruthy();
      }
    }
  );

  // Regression: the descriptionHint subject must use i18next count pluralization
  // (subjectLabel_one/few/many/other) instead of a manual ternary. PL requires
  // one/few/many/other; verify against the real PL catalog, not just defaultValue.
  describe('descriptionHint subjectLabel pluralization (real catalogs)', () => {
    beforeEach(async () => {
      await act(async () => {
        await initializeI18n('pl');
        await i18n.changeLanguage('pl');
      });
    });

    afterAll(async () => {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
    });

    it('PL: 1 zdjęcie (one)', () => {
      expect(i18n.t('foodPhotoImprove.subjectLabel', { count: 1 })).toBe(
        'zdjęcie'
      );
    });

    it('PL: 2 zdjęcia (few)', () => {
      expect(i18n.t('foodPhotoImprove.subjectLabel', { count: 2 })).toBe(
        'zdjęcia'
      );
    });

    it('PL: 3 zdjęcia (few)', () => {
      expect(i18n.t('foodPhotoImprove.subjectLabel', { count: 3 })).toBe(
        'zdjęcia'
      );
    });

    it('PL: 5 zdjęć (many)', () => {
      expect(i18n.t('foodPhotoImprove.subjectLabel', { count: 5 })).toBe(
        'zdjęć'
      );
    });

    it('PL: 12 zdjęć (many)', () => {
      expect(i18n.t('foodPhotoImprove.subjectLabel', { count: 12 })).toBe(
        'zdjęć'
      );
    });

    it('PL: 22 zdjęcia (few)', () => {
      expect(i18n.t('foodPhotoImprove.subjectLabel', { count: 22 })).toBe(
        'zdjęcia'
      );
    });
  });
});
