import { AppState } from 'react-native';
import { addUserInteractionListener } from 'expo-widgets';
import i18n from '../localization/i18n';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from './nutritionIdentity';
import { addLog } from './LogService';
import WellbeingLiveActivityFactory, {
  type WellbeingLiveActivityProps,
} from './WellbeingLiveActivityLayout';
import {
  endStoredWellbeingSession,
  getWellbeingSession,
  setWellbeingActivityId,
  startStoredMovementBreak,
  type WellbeingSession,
} from './wellbeingSessionStore';

const URL = 'sparkyfitnessmobile://movement-break';
const FINISH_TARGET_PREFIX = 'engagement-finish-break:';
let initialized = false;
let tail: Promise<void> = Promise.resolve();
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = tail.then(work, work);
  tail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function propsFor(session: WellbeingSession): WellbeingLiveActivityProps {
  return {
    sessionId: session.id,
    startedAt: Date.parse(session.startedAt),
    endsAt: Date.parse(session.endsAt),
    title: i18n.t('engagement.breakTitle', { defaultValue: 'Movement break' }),
    subtitle: i18n.t('engagement.breakSubtitle', {
      defaultValue: 'A timer, not a movement record',
    }),
    finishLabel: i18n.t('engagement.finishBreak', {
      defaultValue: 'Finish timer',
    }),
  };
}

async function reconcile(): Promise<void> {
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
  const session = await getWellbeingSession();
  const identity = await getActiveNutritionIdentity();
  const valid =
    session?.state === 'active' &&
    Date.parse(session.endsAt) > Date.now() &&
    identity?.serverConfigId === session.serverConfigId &&
    identity.userId === session.userId;
  const instances = WellbeingLiveActivityFactory.getInstances();
  for (const instance of instances) {
    if (!valid || instance.getId() !== session.activityId) {
      await instance.end('immediate');
    }
  }
  if (session?.state === 'active' && !valid) {
    await endStoredWellbeingSession(session.id);
  } else if (
    valid &&
    session.activityId &&
    !instances.some((instance) => instance.getId() === session.activityId)
  ) {
    // User/system dismissed it. Never recreate a dismissed presentation.
    await endStoredWellbeingSession(session.id);
  }
  if (valid && session) {
    // Best effort while JS is executing. staleDate is the suspended-app fallback;
    // foreground reconciliation performs the actual end request later.
    expiryTimer = setTimeout(
      () => {
        void serialized(reconcile).catch((error) =>
          reportFailure('expiry reconcile', error)
        );
      },
      Math.max(0, Date.parse(session.endsAt) - Date.now())
    );
  }
}

function reportFailure(context: string, error: unknown): void {
  addLog(
    `[WellbeingLiveActivity] ${context}: ${error instanceof Error ? error.name : 'unknown'}`,
    'ERROR'
  );
}

export function initWellbeingLiveActivity(): void {
  if (initialized) return;
  initialized = true;
  void serialized(reconcile).catch((error) =>
    reportFailure('startup reconcile', error)
  );
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void serialized(reconcile).catch((error) =>
        reportFailure('foreground reconcile', error)
      );
    }
  });
  subscribeNutritionIdentity(() => {
    void serialized(reconcile).catch((error) =>
      reportFailure('scope reconcile', error)
    );
  });
  addUserInteractionListener((event) => {
    if (!event.target.startsWith(FINISH_TARGET_PREFIX)) return;
    const sessionId = event.target.slice(FINISH_TARGET_PREFIX.length);
    void finishMovementBreak(sessionId).catch((error) =>
      reportFailure('finish interaction', error)
    );
  });
  i18n.on('languageChanged', () => {
    void serialized(async () => {
      const session = await getWellbeingSession();
      if (!session?.activityId || session.state !== 'active') return;
      const instance = WellbeingLiveActivityFactory.getInstances().find(
        (item) => item.getId() === session.activityId
      );
      await instance?.update(propsFor(session), new Date(session.endsAt));
    }).catch((error) => reportFailure('language update', error));
  });
}

/** Local session persistence precedes ActivityKit. No domain intake is logged. */
export async function startMovementBreak(
  durationMinutes: number
): Promise<WellbeingSession> {
  const identity = await getActiveNutritionIdentity();
  if (!identity)
    throw new Error('Sign in once before starting a movement break.');
  const session = await startStoredMovementBreak(identity, durationMinutes);
  await serialized(async () => {
    await reconcile();
    const current = await getWellbeingSession();
    if (
      current?.id !== session.id ||
      current.state !== 'active' ||
      current.activityId
    )
      return;
    try {
      const instance = WellbeingLiveActivityFactory.start(
        propsFor(current),
        URL,
        new Date(current.endsAt)
      );
      await setWellbeingActivityId(current.id, instance.getId());
    } catch (error) {
      // The locally saved timer survives if ActivityKit is unavailable.
      reportFailure('start', error);
    }
  });
  return (await getWellbeingSession()) ?? session;
}

/** Ending presentation never reports movement or finishes another task. */
export async function finishMovementBreak(
  expectedSessionId?: string
): Promise<void> {
  await serialized(async () => {
    const session = await getWellbeingSession();
    if (!session || (expectedSessionId && session.id !== expectedSessionId))
      return;
    await endStoredWellbeingSession(session.id);
    await reconcile();
  });
}
