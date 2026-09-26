import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import MovementBreakScreen from '../../src/screens/MovementBreakScreen';
import {
  finishMovementBreak,
  startMovementBreak,
} from '../../src/services/wellbeingLiveActivity';
import {
  getWellbeingSession,
  type WellbeingSession,
} from '../../src/services/wellbeingSessionStore';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { getTodayDate } from '../../src/utils/dateUtils';

jest.mock('../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: () => null,
}));
jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../src/components/SegmentedControl', () => () => null);
jest.mock('../../src/services/wellbeingLiveActivity', () => ({
  startMovementBreak: jest.fn(),
  finishMovementBreak: jest.fn(),
}));
let sessionChanged: (() => void) | null = null;
jest.mock('../../src/services/wellbeingSessionStore', () => ({
  getWellbeingSession: jest.fn(),
  subscribeWellbeingSession: jest.fn((listener: () => void) => {
    sessionChanged = listener;
    return () => {
      sessionChanged = null;
    };
  }),
}));
let identityChanged: (() => void) | null = null;
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
  subscribeNutritionIdentity: jest.fn((listener: () => void) => {
    identityChanged = listener;
    return () => {
      identityChanged = null;
    };
  }),
}));

const navigation = { navigate: jest.fn() } as never;
const route = { params: undefined } as never;

function activeSession(): WellbeingSession {
  return {
    version: 1,
    id: '11111111-1111-4111-8111-111111111111',
    mode: 'movementBreak',
    serverConfigId: 'server-A',
    userId: 'user-A',
    startedAt: new Date(Date.now() - 30_000).toISOString(),
    endsAt: new Date(Date.now() + 270_000).toISOString(),
    activityId: null,
    state: 'active',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getWellbeingSession).mockResolvedValue(activeSession());
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue({
    serverConfigId: 'server-A',
    userId: 'user-A',
  });
});

it('opens the explicit Activity form without turning a timer into an entry', async () => {
  const screen = render(
    <MovementBreakScreen navigation={navigation} route={route} />
  );
  await screen.findByText('Finish timer');

  fireEvent.press(screen.getByText('Log an activity'));

  expect(navigation.navigate).toHaveBeenCalledWith('ActivityAdd', {
    date: getTodayDate(),
  });
  expect(startMovementBreak).not.toHaveBeenCalled();
  expect(finishMovementBreak).not.toHaveBeenCalled();
});

it('finishes only the timer currently shown on the screen', async () => {
  jest.mocked(finishMovementBreak).mockResolvedValue();
  const screen = render(
    <MovementBreakScreen navigation={navigation} route={route} />
  );
  fireEvent.press(await screen.findByText('Finish timer'));

  await waitFor(() => {
    expect(finishMovementBreak).toHaveBeenCalledWith(activeSession().id);
  });
});

it('hides another account’s timer as soon as the active identity changes', async () => {
  const screen = render(
    <MovementBreakScreen navigation={navigation} route={route} />
  );
  await screen.findByText('Finish timer');

  jest.mocked(getActiveNutritionIdentity).mockResolvedValue({
    serverConfigId: 'server-A',
    userId: 'user-B',
  });
  await act(async () => {
    identityChanged?.();
  });

  await waitFor(() => {
    expect(screen.queryByText('Finish timer')).toBeNull();
    expect(screen.getByText('Ready for a movement break?')).toBeTruthy();
  });
  expect(sessionChanged).not.toBeNull();
});

it('does not reveal an old account’s timer when start finishes after an account switch', async () => {
  jest
    .mocked(getWellbeingSession)
    .mockResolvedValueOnce(null)
    .mockResolvedValue(activeSession());
  let finishStart: (session: WellbeingSession) => void = () => {};
  jest.mocked(startMovementBreak).mockReturnValue(
    new Promise<WellbeingSession>((resolve) => {
      finishStart = resolve;
    })
  );
  const screen = render(
    <MovementBreakScreen navigation={navigation} route={route} />
  );
  await screen.findByText('Start break timer');

  fireEvent.press(screen.getByText('Start break timer'));
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue({
    serverConfigId: 'server-A',
    userId: 'user-B',
  });
  await act(async () => {
    identityChanged?.();
  });
  await act(async () => {
    finishStart(activeSession());
  });

  expect(screen.queryByText('Finish timer')).toBeNull();
  expect(screen.getByText('Ready for a movement break?')).toBeTruthy();
});
