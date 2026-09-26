import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SettingsScreen from '../../src/screens/SettingsScreen';
import {
  usePreferences,
  useServerConfigs,
  useServerConnection,
} from '../../src/hooks';
import { loadLastSyncedTime } from '../../src/services/storage';

type ScreenProps = React.ComponentProps<typeof SettingsScreen>;

const navigation = {
  navigate: jest.fn(),
} as unknown as ScreenProps['navigation'];
const route = {
  key: 'Settings-1',
  name: 'Settings',
  params: undefined,
} as unknown as ScreenProps['route'];

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useFocusEffect: (callback: () => void) => callback() };
});

jest.mock('../../src/hooks', () => ({
  useServerConnection: jest.fn(),
  useServerConfigs: jest.fn(),
  usePreferences: jest.fn(),
  queryClient: { getQueryCache: () => ({ getAll: () => [] }) },
}));

jest.mock('../../src/hooks/useDiscreetMode', () => ({
  useDiscreetMode: () => ({ discreetMode: false }),
}));

jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  useActiveWorkoutBarPadding: () => 0,
}));

jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSTabsActive: () => false,
}));

jest.mock('../../src/services/storage', () => ({
  loadLastSyncedTime: jest.fn().mockResolvedValue(null),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'familyDiary.title' ? 'Family Diaries' : key),
    i18n: { language: 'en-US' },
  }),
}));

const mockUseServerConnection = useServerConnection as jest.MockedFunction<
  typeof useServerConnection
>;
const mockUseServerConfigs = useServerConfigs as jest.MockedFunction<
  typeof useServerConfigs
>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockLoadLastSyncedTime = loadLastSyncedTime as jest.MockedFunction<
  typeof loadLastSyncedTime
>;

describe('SettingsScreen family diary entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadLastSyncedTime.mockImplementation(() => new Promise(() => {}));
    mockUseServerConnection.mockReturnValue({ isConnected: true } as ReturnType<
      typeof useServerConnection
    >);
    mockUseServerConfigs.mockReturnValue({ activeConfig: null } as ReturnType<
      typeof useServerConfigs
    >);
    mockUsePreferences.mockReturnValue({ preferences: null } as ReturnType<
      typeof usePreferences
    >);
  });

  test('opens family diaries when connected', () => {
    const { getByText } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}
      >
        <SettingsScreen navigation={navigation} route={route} />
      </SafeAreaProvider>
    );

    fireEvent.press(getByText('Family Diaries'));

    expect(navigation.navigate).toHaveBeenCalledWith('FamilyMembers');
  });

  test('hides family diaries while disconnected', () => {
    mockUseServerConnection.mockReturnValue({
      isConnected: false,
    } as ReturnType<typeof useServerConnection>);

    const { queryByText } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}
      >
        <SettingsScreen navigation={navigation} route={route} />
      </SafeAreaProvider>
    );

    expect(queryByText('Family Diaries')).toBeNull();
  });

  test('shows checking states until connection and sync history resolve', async () => {
    mockUseServerConnection.mockReturnValue({
      isConnected: false,
      isLoading: true,
    } as ReturnType<typeof useServerConnection>);
    mockUseServerConfigs.mockReturnValue({
      activeConfig: { url: 'https://example.test' },
    } as ReturnType<typeof useServerConfigs>);
    let resolveSync: (value: string | null) => void = () => {};
    mockLoadLastSyncedTime.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve;
        })
    );

    const { getByText, getByLabelText, queryByText, rerender } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}
      >
        <SettingsScreen navigation={navigation} route={route} />
      </SafeAreaProvider>
    );

    expect(getByText('settings.connectionStatus.checking')).toBeTruthy();
    expect(getByText('settings.syncChecking')).toBeTruthy();
    expect(getByLabelText('settings.serverChecking')).toBeTruthy();
    expect(queryByText('date.neverSynced')).toBeNull();

    mockUseServerConnection.mockReturnValue({
      isConnected: true,
      isLoading: false,
    } as ReturnType<typeof useServerConnection>);
    await act(async () => {
      resolveSync(null);
    });
    rerender(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}
      >
        <SettingsScreen navigation={navigation} route={route} />
      </SafeAreaProvider>
    );
    expect(getByText('settings.connectionStatus.connected')).toBeTruthy();
    expect(getByText('date.neverSynced')).toBeTruthy();
  });

  test('does not claim a sync never happened when history cannot be read', async () => {
    let rejectSync: (error: Error) => void = () => {};
    mockLoadLastSyncedTime.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectSync = reject;
        })
    );

    const { getByText, queryByText } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}
      >
        <SettingsScreen navigation={navigation} route={route} />
      </SafeAreaProvider>
    );

    await act(async () => {
      rejectSync(new Error('Storage unavailable'));
    });

    expect(getByText('settings.syncHistoryUnavailable')).toBeTruthy();
    expect(queryByText('date.neverSynced')).toBeNull();
  });

  test('keeps the main settings destinations reachable after regrouping', () => {
    const { getByText } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}
      >
        <SettingsScreen navigation={navigation} route={route} />
      </SafeAreaProvider>
    );

    const destinations = [
      ['settings.rows.server', 'ServerSettings'],
      ['settings.rows.healthSync', 'Sync'],
      ['settings.rows.app', 'AppSettings'],
      ['settings.rows.dashboard', 'DashboardSettings'],
      ['settings.rows.diary', 'DiarySettings'],
      ['settings.rows.food', 'FoodSettings'],
      ['settings.rows.calories', 'CalorieSettings'],
      ['settings.rows.workout', 'WorkoutSettings'],
      ['settings.rows.cyclePregnancy', 'CycleSettings'],
      ['settings.rows.whatsNew', 'WhatsNew'],
      ['settings.rows.about', 'About'],
      ['settings.rows.logs', 'Logs'],
    ] as const;

    for (const [label, routeName] of destinations) {
      fireEvent.press(getByText(label));
      expect(navigation.navigate).toHaveBeenLastCalledWith(routeName);
    }
  });
});
