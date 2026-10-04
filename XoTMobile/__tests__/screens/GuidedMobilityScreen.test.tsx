import * as mobilityStore from '../../src/services/mobilityRoutineStore';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GuidedMobilityScreen from '../../src/screens/GuidedMobilityScreen';
import {
  saveMobilityRoutine,
  startMobilitySession,
  getMobilityState,
} from '../../src/services/mobilityRoutineStore';
import { playMobilityCueSound } from '../../src/services/sounds';
import { mobilitySession } from '../helpers/mobilityFixtures';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('react-i18next', () => {
  const english = require('../../src/localization/locales/en/translation.json');
  const t = (key: string, options: Record<string, unknown> = {}) => {
    const value = key
      .split('.')
      .reduce(
        (node: unknown, part: string) =>
          node && typeof node === 'object'
            ? (node as Record<string, unknown>)[part]
            : undefined,
        english
      );
    return String(value ?? options.defaultValue ?? key).replace(
      /{{(\w+)}}/g,
      (_: string, field: string) => String(options[field] ?? '')
    );
  };
  return { useTranslation: () => ({ t }) };
});

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
jest.mock('../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: () => null,
}));
jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
}));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: async () => ({
    serverConfigId: 'server',
    userId: 'alice',
  }),
  subscribeNutritionIdentity: () => jest.fn(),
}));
jest.mock('../../src/services/mobilityRoutineStore', () => ({
  __esModule: true,
  ...jest.requireActual('../../src/services/mobilityRoutineStore'),
  synchronizeMobility: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/sounds', () => ({
  playMobilityCueSound: jest.fn(),
}));
jest.mock('../../src/services/haptics', () => ({
  fireSuccessHaptic: jest.fn(),
}));
jest.mock('../../src/services/mobilityHealthExport', () => ({
  exportMobilityToHealth: jest.fn().mockResolvedValue('disabled'),
}));
let mockNextId = 10;
jest.mock('expo-crypto', () => ({
  randomUUID: () =>
    `00000000-0000-4000-8000-${String(++mockNextId).padStart(12, '0')}`,
}));
const identity = { serverConfigId: 'server', userId: 'alice' };
let mockTick: () => void;
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
};
beforeEach(async () => {
  jest.useFakeTimers({
    doNotFake: [
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'hrtime',
    ],
  });
  jest.setSystemTime(new Date('2026-10-04T09:00:00Z'));
  jest.clearAllMocks();
  Object.defineProperty(AppState, 'currentState', {
    get: () => 'active',
    configurable: true,
  });
  const originalInterval = global.setInterval;
  jest.spyOn(global, 'setInterval').mockImplementation(((
    callback: () => void,
    ms: number
  ) => {
    if (ms === 1000) {
      mockTick = callback;
      return 1;
    }
    return originalInterval(callback, ms);
  }) as typeof setInterval);
  await AsyncStorage.clear();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
async function setup(cue: 'both' | 'off' = 'both') {
  const step = mobilitySession().routine.steps[0];
  const routine = await saveMobilityRoutine(identity, {
    name: 'Morning mobility',
    cue,
    steps: [
      step,
      {
        ...step,
        id: '00000000-0000-4000-8000-000000000004',
        name: 'Second reach',
      },
    ],
  });
  await startMobilitySession(identity, routine.id);
  const screen = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <GuidedMobilityScreen />
    </SafeAreaProvider>
  );
  await waitFor(() => expect(screen.getByText('0:30')).toBeTruthy());
  return screen;
}
test('plays one halfway cue, waits for transition setup and starts the next timer automatically', async () => {
  const screen = await setup();
  await act(async () => {
    jest.setSystemTime(Date.now() + 15_000);
    mockTick();
  });
  expect(playMobilityCueSound).toHaveBeenCalledWith('halfway');
  await act(async () => {
    jest.setSystemTime(Date.now() + 1_000);
    mockTick();
  });
  expect(playMobilityCueSound).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText('I did this step'));
  await waitFor(() => expect(screen.getByText('0:05')).toBeTruthy());
  await act(async () => {
    jest.setSystemTime(Date.now() + 4_000);
    mockTick();
  });
  expect(screen.getByText('0:01')).toBeTruthy();
  await act(async () => {
    jest.setSystemTime(Date.now() + 1_000);
    mockTick();
  });
  await waitFor(() => expect(screen.getByText('0:30')).toBeTruthy());
  expect(screen.getByText('Second reach')).toBeTruthy();
  expect(
    (await getMobilityState(identity)).activeSession?.outcomes
  ).toHaveLength(1);
  expect((await getMobilityState(identity)).history).toEqual([]);
});
test('respects disabled cues and keeps a paused transition paused', async () => {
  const screen = await setup('off');
  await act(async () => {
    jest.setSystemTime(Date.now() + 30_000);
    mockTick();
  });
  expect(playMobilityCueSound).not.toHaveBeenCalled();
  expect((await getMobilityState(identity)).activeSession?.outcomes).toEqual(
    []
  );
  fireEvent.press(screen.getByText('I did this step'));
  await waitFor(() => expect(screen.getByText('0:05')).toBeTruthy());
  fireEvent.press(screen.getByText('Pause'));
  await waitFor(() => expect(screen.getByText('Resume')).toBeTruthy());
  await act(async () => {
    jest.setSystemTime(Date.now() + 30_000);
    mockTick();
  });
  expect(screen.getByText('0:05')).toBeTruthy();
  expect((await getMobilityState(identity)).activeSession?.phase).toBe(
    'transition'
  );
  fireEvent.press(screen.getByText('Resume'));
  await waitFor(() => expect(screen.getByText('Pause')).toBeTruthy());
  await act(async () => {
    jest.setSystemTime(Date.now() + 5_000);
    mockTick();
  });
  await waitFor(() => expect(screen.getByText('0:30')).toBeTruthy());
});

test('shows an automatic-transition save failure without retrying every tick and permits explicit retry', async () => {
  const screen = await setup();
  const apply = mobilityStore.applyMobilitySessionAction;
  const actions = jest
    .spyOn(mobilityStore, 'applyMobilitySessionAction')
    .mockImplementation((scope, id, action, now) => {
      if (action === 'continue-if-ready')
        return Promise.reject(new Error('storage unavailable'));
      return apply(scope, id, action, now);
    });
  fireEvent.press(screen.getByText('I did this step'));
  await waitFor(() => expect(screen.getByText('0:05')).toBeTruthy());
  await act(async () => {
    jest.setSystemTime(Date.now() + 5_000);
    mockTick();
  });
  await waitFor(() =>
    expect(
      screen.getByText('That change could not be saved. Try again.')
    ).toBeTruthy()
  );
  await act(async () => {
    jest.setSystemTime(Date.now() + 3_000);
    mockTick();
  });
  expect(
    actions.mock.calls.filter((call) => call[2] === 'continue-if-ready')
  ).toHaveLength(1);
  fireEvent.press(screen.getByText('Start now'));
  await waitFor(() => expect(screen.getByText('0:30')).toBeTruthy());
  expect(
    screen.queryByText('That change could not be saved. Try again.')
  ).toBeNull();
});
