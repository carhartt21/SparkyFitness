jest.mock('@bacons/apple-targets', () => {
  const mocks = {
    reload: jest.fn(),
  };

  class ExtensionStorage {
    set() {
      throw new Error('not implemented in platform-authoritative model');
    }
    get() {
      return null;
    }
    remove() {
      throw new Error('not implemented in platform-authoritative model');
    }
    static reloadWidget(name?: string) {
      mocks.reload(name);
    }
  }

  return { ExtensionStorage, __mocks: mocks };
});

import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { ExtensionStorage } from '@bacons/apple-targets';

import { useIOSWidgetLanguageRefresh } from '../../src/hooks/useIOSWidgetLanguageRefresh';
import i18n from '../../src/localization/i18n';
import { addLog } from '../../src/services/LogService';

jest.mock('../../src/services/LogService', () => ({
  addLog: jest.fn(() => Promise.resolve()),
}));

interface AppleTargetsMocks {
  reload: jest.Mock;
}

const mockedAppleTargets = jest.requireMock('@bacons/apple-targets') as {
  ExtensionStorage: typeof ExtensionStorage;
  __mocks: AppleTargetsMocks;
};

const mockReload = mockedAppleTargets.__mocks.reload;
const mockAddLog = addLog as jest.MockedFunction<typeof addLog>;

type I18nEventListener = (lng?: string) => void;

/** Flush the serialized sync queue (one microtask per enqueued run). */
async function flushSync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('useIOSWidgetLanguageRefresh', () => {
  let languageListeners: I18nEventListener[] = [];
  let initializedListeners: I18nEventListener[] = [];
  let isInitialized = true;
  let resolvedLanguage = 'en';
  let osSpy: jest.SpyInstance | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset persistent module-factory implementations too, not only call
    // history: a mockImplementation from one test must never leak into a later
    // test in this file.
    mockReload.mockReset();
    languageListeners = [];
    initializedListeners = [];
    isInitialized = true;
    resolvedLanguage = 'en';
    jest.spyOn(i18n, 'on').mockImplementation(((
      event: string,
      listener: I18nEventListener
    ) => {
      if (event === 'languageChanged') {
        languageListeners.push(listener);
      }
      if (event === 'initialized') {
        initializedListeners.push(listener);
      }
      return i18n;
    }) as typeof i18n.on);
    jest.spyOn(i18n, 'off').mockImplementation(((event: string) => {
      if (event === 'languageChanged') {
        languageListeners = [];
      }
      if (event === 'initialized') {
        initializedListeners = [];
      }
      return i18n;
    }) as typeof i18n.off);
    Object.defineProperty(i18n, 'isInitialized', {
      get: () => isInitialized,
      configurable: true,
    });
    Object.defineProperty(i18n, 'resolvedLanguage', {
      get: () => resolvedLanguage,
      configurable: true,
    });
    osSpy = jest.replaceProperty(Platform, 'OS', 'ios');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (osSpy) osSpy.restore();
  });

  it('reloads all widget timelines on mount when i18n is already initialized', async () => {
    renderHook(() => useIOSWidgetLanguageRefresh());
    await flushSync();

    expect(mockReload).toHaveBeenCalledWith('widget');
    expect(mockReload).toHaveBeenCalledWith('macroWidget');
    expect(mockReload).toHaveBeenCalledWith('routineWidget');
    expect(mockReload).toHaveBeenCalledTimes(3);
  });

  it('waits for the initialized event when mounted before i18n init', async () => {
    isInitialized = false;
    resolvedLanguage = 'pl';

    renderHook(() => useIOSWidgetLanguageRefresh());
    await flushSync();

    expect(mockReload).not.toHaveBeenCalled();

    initializedListeners[0]();
    await flushSync();

    expect(mockReload).toHaveBeenCalledWith('widget');
    expect(mockReload).toHaveBeenCalledWith('macroWidget');
    expect(mockReload).toHaveBeenCalledWith('routineWidget');
  });

  it('does nothing on Android', async () => {
    osSpy = jest.replaceProperty(Platform, 'OS', 'android');

    renderHook(() => useIOSWidgetLanguageRefresh());
    await flushSync();

    expect(mockReload).not.toHaveBeenCalled();
  });

  it('reloads all timelines when languageChanged carries a real EN -> PL change', async () => {
    renderHook(() => useIOSWidgetLanguageRefresh());
    await flushSync();
    expect(mockReload).toHaveBeenCalledTimes(3);

    resolvedLanguage = 'pl';
    languageListeners[0]('pl');
    await flushSync();

    expect(mockReload).toHaveBeenCalledTimes(6);
    expect(mockReload).toHaveBeenLastCalledWith('routineWidget');
  });

  it('dedupes an identical effective language', async () => {
    renderHook(() => useIOSWidgetLanguageRefresh());
    await flushSync();
    expect(mockReload).toHaveBeenCalledTimes(3);

    // Same effective language: the signal is deduped, no reload storm.
    languageListeners[0]('en');
    await flushSync();
    expect(mockReload).toHaveBeenCalledTimes(3);

    resolvedLanguage = 'pl';
    languageListeners[0]('pl');
    await flushSync();
    expect(mockReload).toHaveBeenCalledTimes(6);

    languageListeners[0]('pl');
    await flushSync();
    expect(mockReload).toHaveBeenCalledTimes(6);
  });

  it('attempts every reload independently when one timeline fails', async () => {
    let reloadFailure: string | null = 'widget';
    mockReload.mockImplementation((name?: string) => {
      if (reloadFailure !== null && name === reloadFailure) {
        throw new Error('calorie reload failed');
      }
    });

    renderHook(() => useIOSWidgetLanguageRefresh());
    await flushSync();

    // Other timelines are attempted even though the calorie one failed.
    expect(mockReload).toHaveBeenCalledWith('widget');
    expect(mockReload).toHaveBeenCalledWith('macroWidget');
    expect(mockReload).toHaveBeenCalledWith('routineWidget');
    expect(mockAddLog).toHaveBeenCalledTimes(1);

    reloadFailure = null;
    resolvedLanguage = 'pl';
    languageListeners[0]('pl');
    await flushSync();

    expect(mockReload).toHaveBeenCalledTimes(6);
  });

  it('retries the flow when the macro widget reload fails', async () => {
    let reloadFailure: string | null = 'macroWidget';
    mockReload.mockImplementation((name?: string) => {
      if (reloadFailure !== null && name === reloadFailure) {
        throw new Error('macro reload failed');
      }
    });

    renderHook(() => useIOSWidgetLanguageRefresh());
    await flushSync();

    expect(mockReload).toHaveBeenCalledWith('widget');
    expect(mockReload).toHaveBeenCalledWith('macroWidget');
    expect(mockAddLog).toHaveBeenCalledTimes(1);

    reloadFailure = null;
    resolvedLanguage = 'pl';
    languageListeners[0]('pl');
    await flushSync();

    expect(mockReload).toHaveBeenCalledTimes(6);
  });

  it('retries on the next signal after a failure (state stays unapplied)', async () => {
    let reloadFailure = true;
    mockReload.mockImplementation(() => {
      if (reloadFailure) {
        throw new Error('reload failed');
      }
    });

    renderHook(() => useIOSWidgetLanguageRefresh());
    await flushSync();

    expect(mockAddLog).toHaveBeenCalledTimes(3);
    // Failure: state not marked applied, so an identical-language signal still retries.
    languageListeners[0]('en');
    await flushSync();
    expect(mockReload).toHaveBeenCalledTimes(6);
  });

  it('serializes rapid signals so the newest effective language wins', async () => {
    renderHook(() => useIOSWidgetLanguageRefresh());
    await flushSync();
    expect(mockReload).toHaveBeenCalledTimes(3);

    // Fire several signals without waiting between them. Each queued run
    // recomputes the effective language at execution time, so only the final
    // pl state actually reloads (the en runs are deduped against the mount).
    languageListeners[0]('en');
    resolvedLanguage = 'pl';
    languageListeners[0]('pl');
    languageListeners[0]('pl');
    await flushSync();

    expect(mockReload).toHaveBeenCalledTimes(6);
  });
});
