import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import i18n from '../localization/i18n';
import type { FastingLog } from '../types/fasting';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import {
  getMobilityState,
  mobilitySecondsRemaining,
  subscribeMobilityState,
} from './mobilityRoutineStore';
import ActiveTimerFactory, {
  type ActiveTimerLiveActivityProps,
} from './ActiveTimerLiveActivityLayout';
import { addLog } from './LogService';

type Kind = 'fasting' | 'mobility';
type Stored = { sessionId: string; activityId: string; dismissed: boolean };
type StoredMap = Partial<Record<Kind, Stored>>;
const PREFIX = '@XonTrack/activeTimerActivities/v1/';
const ACTIVE_SCOPE_KEY = '@XonTrack/activeTimerActivities/activeScope/v1';
function timerCopy(key: string, defaultValue: string): string {
  // i18n-audit-ignore-next-line dynamic-i18n-key -- call sites use literal activeTimer catalog keys.
  return i18n.t(key, { defaultValue });
}
let currentIdentity: NutritionActionIdentity | null = null;
let currentFast: FastingLog | null | undefined;
let started = false;
let lastReconciledScope: string | null = null;
let tail: Promise<void> = Promise.resolve();

function scope(identity: NutritionActionIdentity): string {
  return `${PREFIX}${encodeURIComponent(identity.serverConfigId)}:${encodeURIComponent(identity.userId)}`;
}

function queue(work: () => Promise<void>): Promise<void> {
  const next = tail.then(work);
  tail = next.catch(() => undefined);
  return next;
}

function report(error: unknown): void {
  addLog(
    `[ActiveTimerLiveActivity] ${error instanceof Error ? error.name : 'unknown'}`,
    'ERROR'
  );
}

async function readStored(
  identity: NutritionActionIdentity
): Promise<StoredMap> {
  const raw = await AsyncStorage.getItem(scope(identity));
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' ? (value as StoredMap) : {};
  } catch {
    return {};
  }
}

async function syncKind(
  kind: Kind,
  expected: ActiveTimerLiveActivityProps | null | undefined,
  stored: StoredMap,
  identity: NutritionActionIdentity
): Promise<void> {
  if (expected === undefined) return;
  const record = stored[kind];
  const instance = record
    ? ActiveTimerFactory.getInstances().find(
        (item) => item.getId() === record.activityId
      )
    : undefined;
  if (
    record &&
    (expected === null || expected.sessionId !== record.sessionId)
  ) {
    await instance?.end('immediate');
    delete stored[kind];
  }
  if (!expected) return;
  if (record?.sessionId === expected.sessionId) {
    if (instance) {
      await instance.update(
        expected,
        expected.mode === 'countdown' ? new Date(expected.endsAt) : undefined
      );
    } else if (!record.dismissed) {
      stored[kind] = { ...record, dismissed: true };
    }
    return;
  }
  const destination =
    kind === 'fasting'
      ? 'sparkyfitnessmobile://fasting'
      : 'sparkyfitnessmobile://guided-mobility';
  const started = ActiveTimerFactory.start(
    expected,
    destination,
    expected.mode === 'countdown' ? new Date(expected.endsAt) : undefined
  );
  stored[kind] = {
    sessionId: expected.sessionId,
    activityId: started.getId(),
    dismissed: false,
  };
  await AsyncStorage.setItem(scope(identity), JSON.stringify(stored));
}

function fastingProps(
  fast: FastingLog | null | undefined
): ActiveTimerLiveActivityProps | null | undefined {
  if (fast === undefined) return undefined;
  if (!fast || fast.status !== 'ACTIVE') return null;
  const startedAt = Date.parse(fast.start_time);
  if (!Number.isFinite(startedAt)) return null;
  const target = fast.target_end_time ? Date.parse(fast.target_end_time) : NaN;
  const hasFutureTarget = Number.isFinite(target) && target > Date.now();
  return {
    kind: 'fasting',
    sessionId: fast.id,
    title: timerCopy('fastingDetail.title', 'Fasting'),
    subtitle: hasFutureTarget
      ? timerCopy('activeTimer.timeToTarget', 'Time to target')
      : timerCopy('activeTimer.elapsed', 'Elapsed time'),
    symbol: 'timer',
    mode: hasFutureTarget ? 'countdown' : 'elapsed',
    startedAt,
    endsAt: hasFutureTarget ? target : startedAt,
    staticValue: '',
  };
}

async function mobilityProps(
  identity: NutritionActionIdentity
): Promise<ActiveTimerLiveActivityProps | null> {
  const state = await getMobilityState(identity);
  const session = state.activeSession;
  if (!session || (session.state !== 'running' && session.state !== 'paused'))
    return null;
  const step = session.routine.steps[session.stepIndex];
  if (!step) return null;
  const remaining = mobilitySecondsRemaining(session);
  const countdown =
    session.state === 'running' && remaining !== null && remaining > 0;
  return {
    kind: 'mobility',
    sessionId: session.id,
    title: session.routine.name,
    subtitle: step.name,
    symbol: 'figure.flexibility',
    mode: countdown ? 'countdown' : 'static',
    startedAt: Date.parse(session.phaseStartedAt ?? session.startedAt),
    endsAt: Date.now() + (remaining ?? 0) * 1000,
    staticValue:
      session.state === 'paused'
        ? timerCopy('activeTimer.paused', 'Paused')
        : remaining === 0
          ? timerCopy('activeTimer.continue', 'Continue')
          : timerCopy('activeTimer.currentStep', 'Current step'),
  };
}

async function reconcile(): Promise<void> {
  const identity = currentIdentity;
  const nextScope = identity ? scope(identity) : null;
  const previousScope =
    lastReconciledScope ?? (await AsyncStorage.getItem(ACTIVE_SCOPE_KEY));
  if (previousScope !== nextScope) {
    for (const instance of ActiveTimerFactory.getInstances())
      await instance.end('immediate');
    if (previousScope) await AsyncStorage.removeItem(previousScope);
    if (nextScope) await AsyncStorage.setItem(ACTIVE_SCOPE_KEY, nextScope);
    else await AsyncStorage.removeItem(ACTIVE_SCOPE_KEY);
  }
  lastReconciledScope = nextScope;
  if (!identity) {
    return;
  }
  const stored = await readStored(identity);
  const fast = fastingProps(currentFast);
  let mobility: ActiveTimerLiveActivityProps | null | undefined;
  try {
    mobility = await mobilityProps(identity);
  } catch {
    mobility = undefined;
  }
  await syncKind('fasting', fast, stored, identity);
  await syncKind('mobility', mobility, stored, identity);
  await AsyncStorage.setItem(scope(identity), JSON.stringify(stored));
}

export function initActiveTimerLiveActivities(): void {
  if (started) return;
  started = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void queue(reconcile).catch(report);
  });
  subscribeMobilityState(() => {
    void queue(reconcile).catch(report);
  });
  i18n.on('languageChanged', () => {
    void queue(reconcile).catch(report);
  });
}

export function reconcileActiveTimerLiveActivities(
  identity: NutritionActionIdentity | null,
  fast: FastingLog | null | undefined
): Promise<void> {
  if (
    currentIdentity &&
    (!identity || scope(currentIdentity) !== scope(identity))
  ) {
    currentFast = undefined;
  }
  currentIdentity = identity;
  currentFast = fast;
  return queue(reconcile).catch(report);
}
