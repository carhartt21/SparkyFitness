import { isRecordedMobilitySession } from '@workspace/shared';
import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Button from '../components/ui/Button';
import Icon from '../components/Icon';
import { useCSSVariable } from 'uniwind';
import NeonButton from '../components/ui/NeonButton';
import { KeepAwakeLock } from '../components/ActiveWorkoutKeepAwake';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import MobilityHistorySection from '../components/MobilityHistorySection';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { fireSuccessHaptic } from '../services/haptics';
import {
  applyMobilitySessionAction,
  deleteMobilitySessionHistory,
  deleteMobilityRoutine,
  getMobilityState,
  mobilitySecondsRemaining,
  mobilityElapsedSeconds,
  MOBILITY_TRANSITION_SECONDS,
  saveMobilityRoutine,
  startMobilitySession,
  subscribeMobilityState,
  synchronizeMobility,
  resolveMobilityConflict,
  type MobilityRoutine,
  type MobilityState,
  type MobilityStepDraft,
  type MobilitySessionAction,
} from '../services/mobilityRoutineStore';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import type { NutritionActionIdentity } from '../services/nutritionActionOutbox';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { playMobilityCueSound } from '../services/sounds';
import { newUuid } from '../utils/ids';
import { mobilityCueAt, type MobilityCuePosition } from '../utils/mobilityCue';
import { exportMobilityToHealth } from '../services/mobilityHealthExport';

type StepDraft = {
  id?: string;
  name: string;
  instructions: string;
  side: 'both' | 'left' | 'right';
  kind: 'timed' | 'repetitions';
  amount: string;
  transition: string;
};
type RoutineDraft = {
  id?: string;
  name: string;
  cue: MobilityRoutine['cue'];
  reminderTime: string;
  steps: StepDraft[];
};

const blankStep = (): StepDraft => ({
  id: newUuid(),
  name: '',
  instructions: '',
  side: 'both',
  kind: 'timed',
  amount: '30',
  transition: String(MOBILITY_TRANSITION_SECONDS),
});
const blankRoutine = (): RoutineDraft => ({
  name: '',
  cue: 'both',
  reminderTime: '',
  steps: [blankStep()],
});

function toDraft(routine: MobilityRoutine): RoutineDraft {
  return {
    id: routine.id,
    name: routine.name,
    cue: routine.cue,
    reminderTime: routine.reminderTime ?? '',
    steps: routine.steps.map((step) => ({
      id: step.id,
      name: step.name,
      instructions: step.instructions,
      side: step.side,
      kind: step.kind,
      amount: String(
        step.kind === 'timed' ? step.durationSeconds : step.repetitions
      ),
      transition: String(
        Math.max(MOBILITY_TRANSITION_SECONDS, step.transitionSeconds)
      ),
    })),
  };
}

function parseStep(step: StepDraft): MobilityStepDraft {
  const amount = Number(step.amount);
  const transitionSeconds = Number(step.transition);
  if (
    !step.name.trim() ||
    !Number.isInteger(amount) ||
    amount < (step.kind === 'timed' ? 5 : 1) ||
    amount > (step.kind === 'timed' ? 3600 : 1000) ||
    !Number.isInteger(transitionSeconds) ||
    transitionSeconds < MOBILITY_TRANSITION_SECONDS ||
    transitionSeconds > 600
  ) {
    throw new Error('invalid-step');
  }
  const common = {
    ...(step.id ? { id: step.id } : {}),
    name: step.name.trim(),
    instructions: step.instructions.trim(),
    side: step.side,
    transitionSeconds,
  };
  return step.kind === 'timed'
    ? { ...common, kind: 'timed', durationSeconds: amount }
    : { ...common, kind: 'repetitions', repetitions: amount };
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function GuidedMobilityScreen() {
  const { t } = useTranslation();
  const [accent, danger] = useCSSVariable([
    '--color-accent-primary',
    '--color-icon-danger',
  ]) as [string, string];
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const focused = useRef(isFocused);
  focused.current = isFocused;
  const nativeHeader = useNativeIOSHeadersActive();
  const keepScreenAwake = useAppPreferencesStore(
    (preferences) => preferences.workoutKeepAwakeEnabled
  );
  const [identity, setIdentity] = useState<NutritionActionIdentity | null>(
    null
  );
  const [state, setState] = useState<MobilityState | null>(null);
  const [draft, setDraft] = useState<RoutineDraft | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshGeneration = useRef(0);
  const previousCue = useRef<MobilityCuePosition | null>(null);
  const transitionInFlight = useRef(false);
  const workInFlight = useRef(false);
  const autoTransitionKey = useRef<string | null>(null);

  const refresh = useCallback(() => {
    const generation = ++refreshGeneration.current;
    void getActiveNutritionIdentity()
      .then(async (nextIdentity) => ({
        nextIdentity,
        nextState: nextIdentity ? await getMobilityState(nextIdentity) : null,
      }))
      .then(({ nextIdentity, nextState }) => {
        if (generation !== refreshGeneration.current) return;
        setIdentity(nextIdentity);
        setState(nextState);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        if (generation === refreshGeneration.current) {
          setState(null);
          setError(
            t('mobility.loadError', {
              defaultValue: 'Your routines could not be loaded.',
            })
          );
          setLoading(false);
        }
      });
  }, [t]);

  useEffect(() => {
    const sync = async () => {
      const scope = await getActiveNutritionIdentity();
      if (scope) await synchronizeMobility(scope).catch(() => undefined);
    };
    void sync();
    const subscription = AppState.addEventListener('change', (value) => {
      if (value === 'active') void sync();
    });
    const timer = setInterval(() => void sync(), 60_000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    refresh();
    const stopState = subscribeMobilityState(refresh);
    const stopIdentity = subscribeNutritionIdentity(() => {
      setIdentity(null);
      setState(null);
      setDraft(null);
      setLoading(true);
      refresh();
    });
    const foreground = AppState.addEventListener('change', (value) => {
      previousCue.current = null;
      if (value === 'active') {
        setNow(Date.now());
        refresh();
      }
    });
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      refreshGeneration.current += 1;
      stopState();
      stopIdentity();
      foreground.remove();
      clearInterval(interval);
    };
  }, [refresh]);

  const session = state?.activeSession ?? null;
  const remaining = session
    ? mobilitySecondsRemaining(session, new Date(now))
    : null;
  useEffect(() => {
    if (!session || !isFocused || AppState.currentState !== 'active') {
      previousCue.current = null;
      return;
    }
    const event = mobilityCueAt(
      session,
      mobilityElapsedSeconds(session, new Date(now)),
      previousCue.current
    );
    previousCue.current = event.position;
    if (event.cue) {
      if (session.routine.cue === 'haptic' || session.routine.cue === 'both')
        fireSuccessHaptic();
      if (session.routine.cue === 'sound' || session.routine.cue === 'both')
        playMobilityCueSound(event.cue);
    }
  }, [now, session, isFocused]);

  useEffect(() => {
    if (
      !identity ||
      !session ||
      session.phase !== 'transition' ||
      session.state !== 'running' ||
      remaining !== 0 ||
      !isFocused ||
      busy ||
      AppState.currentState !== 'active' ||
      transitionInFlight.current
    )
      return;
    const key = `${identity.serverConfigId}:${identity.userId}:${session.id}:${session.stepIndex}:${session.phaseStartedAt}`;
    if (autoTransitionKey.current === key) return;
    autoTransitionKey.current = key;
    transitionInFlight.current = true;
    let failed = false;
    void (async () => {
      const active = await getActiveNutritionIdentity();
      if (
        active?.serverConfigId !== identity.serverConfigId ||
        active?.userId !== identity.userId ||
        AppState.currentState !== 'active' ||
        !focused.current
      ) {
        autoTransitionKey.current = null;
        return;
      }
      await applyMobilitySessionAction(
        identity,
        session.id,
        'continue-if-ready'
      );
    })()
      .catch(() => {
        failed = true;
        setError(
          t('mobility.actionError', {
            defaultValue: 'That change could not be saved. Try again.',
          })
        );
      })
      .finally(() => {
        transitionInFlight.current = false;
        if (!failed) refresh();
      });
  }, [identity, session, remaining, isFocused, busy, refresh, t]);

  const header = useScreenHeader({
    title: t('mobility.title', { defaultValue: 'Guided mobility' }),
    left: { kind: 'back' },
  });

  const sideLabel = (side: StepDraft['side']): string => {
    if (side === 'left')
      return t('mobility.side.left', { defaultValue: 'Left side' });
    if (side === 'right')
      return t('mobility.side.right', { defaultValue: 'Right side' });
    return t('mobility.side.both', { defaultValue: 'Both sides' });
  };
  const cueLabel = (cue: MobilityRoutine['cue']): string => {
    if (cue === 'haptic')
      return t('mobility.cueOption.haptic', { defaultValue: 'Haptic' });
    if (cue === 'sound')
      return t('mobility.cueOption.sound', { defaultValue: 'Sound' });
    if (cue === 'both')
      return t('mobility.cueOption.both', { defaultValue: 'Both' });
    return t('mobility.cueOption.off', { defaultValue: 'Off' });
  };

  const perform = async (work: () => Promise<unknown>) => {
    if (workInFlight.current) return;
    workInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
      refresh();
    } catch {
      setError(
        t('mobility.actionError', {
          defaultValue: 'That change could not be saved. Try again.',
        })
      );
    } finally {
      workInFlight.current = false;
      setBusy(false);
    }
  };

  const exportSession = async (
    savedSession: MobilityState['history'][number],
    explicit = false
  ) => {
    if (
      !identity ||
      Platform.OS !== 'ios' ||
      !isRecordedMobilitySession(savedSession)
    )
      return;
    try {
      const result = await exportMobilityToHealth(savedSession, identity, t);
      if (explicit || result === 'pending') {
        const message =
          result === 'saved'
            ? t('mobility.healthSaved', {
                defaultValue:
                  'This session is saved as a flexibility workout in Apple Health and Apple Fitness.',
              })
            : result === 'disabled'
              ? t('mobility.healthDisabled', {
                  defaultValue:
                    'Enable workout recording in Sync settings to export mobility sessions to Apple Health.',
                })
              : result === 'pending'
                ? t('mobility.healthPending', {
                    defaultValue:
                      'The export is pending. Check workout and active-energy write permissions in Sync settings, then retry here.',
                  })
                : t('mobility.healthSkipped', {
                    defaultValue:
                      'The session stays in your X on Track diary. You can export it later with confirmed active calories.',
                  });
        Alert.alert(
          t('mobility.healthTitle', {
            defaultValue: 'Mobility in Apple Health',
          }),
          message
        );
      }
    } catch {
      Alert.alert(
        t('mobility.healthTitle', { defaultValue: 'Mobility in Apple Health' }),
        t('mobility.healthError', {
          defaultValue:
            'The session is saved in X on Track. Check workout and active-energy write permissions in Sync settings and retry the export from session history.',
        })
      );
    }
  };
  const runAction = (action: MobilitySessionAction) => {
    if (!identity || !session || busy) return;
    void perform(async () => {
      const active = await getActiveNutritionIdentity();
      if (
        active?.serverConfigId !== identity.serverConfigId ||
        active?.userId !== identity.userId
      )
        throw new Error('Account changed.');
      const savedSession = await applyMobilitySessionAction(
        identity,
        session.id,
        action
      );
      // Save locally first; a cancelled export never loses confirmed movement.
      if (
        savedSession.state === 'finished' ||
        savedSession.state === 'cancelled'
      ) {
        refresh();
        await exportSession(savedSession);
      }
    });
  };

  const confirmEndSession = () => {
    Alert.alert(
      t('mobility.endSession', { defaultValue: 'End session' }),
      t('mobility.endSessionConfirm', {
        defaultValue: 'End this routine? Your confirmed steps will be kept.',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('mobility.endSession', { defaultValue: 'End session' }),
          style: 'destructive',
          onPress: () => runAction('cancel'),
        },
      ]
    );
  };

  const confirmDeleteRoutine = (routine: MobilityRoutine) => {
    if (!identity) return;
    Alert.alert(
      t('mobility.deleteRoutine', { defaultValue: 'Delete routine' }),
      t('mobility.deleteRoutineConfirm', {
        defaultValue:
          'Delete {{name}}? Past sessions will stay in your history. This cannot be undone.',
        name: routine.name,
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () =>
            void perform(async () => {
              const active = await getActiveNutritionIdentity();
              if (
                active?.serverConfigId !== identity.serverConfigId ||
                active?.userId !== identity.userId
              ) {
                throw new Error('Account changed.');
              }
              await deleteMobilityRoutine(identity, routine.id);
            }),
        },
      ]
    );
  };

  const confirmDeleteSession = (
    savedSession: MobilityState['history'][number]
  ) => {
    if (!identity) return;
    Alert.alert(
      t('mobility.historyDelete', { defaultValue: 'Delete session' }),
      t('mobility.historyDeleteConfirm', {
        defaultValue: 'Delete this saved session? This cannot be undone.',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () =>
            void perform(async () => {
              const active = await getActiveNutritionIdentity();
              if (
                active?.serverConfigId !== identity.serverConfigId ||
                active?.userId !== identity.userId
              ) {
                throw new Error('Account changed.');
              }
              await deleteMobilitySessionHistory(identity, savedSession.id);
            }),
        },
      ]
    );
  };

  const updateStep = (index: number, patch: Partial<StepDraft>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            steps: current.steps.map((step, stepIndex) =>
              stepIndex === index ? { ...step, ...patch } : step
            ),
          }
        : current
    );
  };

  const saveDraft = () => {
    if (!identity || !draft) return;
    if (!draft.name.trim() || draft.steps.length === 0) {
      setError(
        t('mobility.nameAndStepRequired', {
          defaultValue: 'Add a routine name and at least one step.',
        })
      );
      return;
    }
    const reminderTime = draft.reminderTime.trim();
    if (reminderTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
      setError(
        t('mobility.invalidReminderTime', {
          defaultValue: 'Enter the reminder time as HH:mm, or leave it blank.',
        })
      );
      return;
    }
    let steps: MobilityStepDraft[];
    try {
      steps = draft.steps.map(parseStep);
    } catch {
      setError(
        t('mobility.invalidStep', {
          defaultValue:
            'Check each step: timed steps need 5–3600 seconds, repetitions need 1–1000, and transitions need 5–600 seconds.',
        })
      );
      return;
    }
    void perform(async () => {
      await saveMobilityRoutine(identity, {
        id: draft.id,
        name: draft.name.trim(),
        cue: draft.cue,
        reminderTime: reminderTime || null,
        steps,
      });
      setDraft(null);
    });
  };

  const step = session?.routine.steps[session.stepIndex];
  const previousStep = session?.routine.steps[session.stepIndex - 1];

  return (
    <View
      className="flex-1 bg-background"
      style={nativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {isFocused && session?.state === 'running' && keepScreenAwake ? (
        <KeepAwakeLock tag="mobility-routine" />
      ) : null}
      {header}
      <KeyboardAwareScrollView
        mode="layout"
        className="flex-1"
        contentContainerClassName="px-4 py-3 gap-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {error ? (
          <Text className="text-icon-danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {loading ? (
          <ActivityIndicator
            accessibilityLabel={t('mobility.loading', {
              defaultValue: 'Loading routines',
            })}
          />
        ) : error && !state ? (
          <Button variant="secondary" onPress={refresh}>
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        ) : !identity ? (
          <Text className="text-text-secondary">
            {t('mobility.accountRequired', {
              defaultValue: 'Connect to your account to use saved routines.',
            })}
          </Text>
        ) : session ? (
          <View className="rounded-2xl bg-raised p-5 gap-4">
            <Text className="text-2xl font-semibold text-text-primary">
              {session.routine.name}
            </Text>
            <Text className="text-text-secondary">
              {t('mobility.stepCount', {
                defaultValue: 'Step {{current}} of {{total}}',
                current: session.stepIndex + 1,
                total: session.routine.steps.length,
              })}
            </Text>
            <Text className="text-xl font-semibold text-text-primary">
              {session.phase === 'transition'
                ? t('mobility.transition', { defaultValue: 'Transition' })
                : step?.name}
            </Text>
            {session.phase === 'step' && step ? (
              <>
                <Text className="text-text-secondary">
                  {step.instructions ||
                    t('mobility.moveComfortably', {
                      defaultValue: 'Move at a comfortable range.',
                    })}
                </Text>
                <Text className="text-text-secondary">
                  {sideLabel(step.side)}
                  {step.kind === 'timed' && step.side === 'both'
                    ? ` · ${mobilityElapsedSeconds(session, new Date(now)) >= step.durationSeconds / 2 ? t('mobility.secondHalf', { defaultValue: 'Second half · switch sides if needed' }) : t('mobility.firstHalf', { defaultValue: 'First half' })}`
                    : ''}
                </Text>
              </>
            ) : null}
            {remaining !== null ? (
              <Text className="text-4xl font-bold text-text-primary text-center">
                {formatClock(remaining)}
              </Text>
            ) : step ? (
              <Text className="text-3xl font-bold text-text-primary text-center">
                {t('mobility.repetitionsCount', {
                  defaultValue: '{{count}} repetitions',
                  count: step.kind === 'repetitions' ? step.repetitions : 0,
                })}
              </Text>
            ) : null}
            {session.phase === 'transition' && previousStep ? (
              <Text className="text-text-secondary text-center">
                {t('mobility.nextStep', {
                  defaultValue: 'Next: {{name}}',
                  name: step?.name ?? '',
                })}
              </Text>
            ) : null}
            <Text className="text-sm text-text-secondary">
              {session.phase === 'transition'
                ? t('mobility.transitionHint', {
                    defaultValue:
                      'Get ready for the next exercise. Its timer starts after this countdown; pause if you need more time.',
                  })
                : t('mobility.expiryIsNotCompletion', {
                    defaultValue:
                      'The timer does not mark a step complete. Confirm what you did.',
                  })}
            </Text>
            {session.phase === 'transition' ? (
              <Button disabled={busy} onPress={() => runAction('continue')}>
                {t('mobility.startNow', {
                  defaultValue: 'Start now',
                })}
              </Button>
            ) : (
              <>
                <Button
                  disabled={busy}
                  onPress={() => runAction('complete-step')}
                >
                  {t('mobility.completeStep', {
                    defaultValue: 'I did this step',
                  })}
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onPress={() => runAction('skip-step')}
                >
                  {t('mobility.skipStep', { defaultValue: 'Skip step' })}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onPress={() => runAction('repeat')}
                >
                  {step?.kind === 'repetitions'
                    ? t('mobility.repeatRepetitions', {
                        defaultValue: 'Repeat this step',
                      })
                    : t('mobility.repeatStep', {
                        defaultValue: 'Restart step timer',
                      })}
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              disabled={busy}
              onPress={() =>
                runAction(session.state === 'paused' ? 'resume' : 'pause')
              }
            >
              {session.state === 'paused'
                ? t('mobility.resume', { defaultValue: 'Resume' })
                : t('mobility.pause', { defaultValue: 'Pause' })}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onPress={confirmEndSession}
            >
              {t('mobility.endSession', { defaultValue: 'End session' })}
            </Button>
          </View>
        ) : draft ? (
          <View className="gap-4">
            <Text className="text-xl font-semibold text-text-primary">
              {draft.id
                ? t('mobility.editRoutine', { defaultValue: 'Edit routine' })
                : t('mobility.newRoutine', { defaultValue: 'New routine' })}
            </Text>
            <TextInput
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
              placeholder={t('mobility.routineName', {
                defaultValue: 'Routine name',
              })}
              accessibilityLabel={t('mobility.routineName', {
                defaultValue: 'Routine name',
              })}
              className="rounded-xl bg-raised px-4 py-3 text-text-primary"
              maxLength={120}
            />
            <Text className="font-semibold text-text-primary">
              {t('mobility.cue', { defaultValue: 'Timer and halfway cues' })}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {(['off', 'haptic', 'sound', 'both'] as const).map((cue) => (
                <Button
                  key={cue}
                  variant={draft.cue === cue ? 'primary' : 'secondary'}
                  onPress={() => setDraft({ ...draft, cue })}
                  className="min-w-20"
                >
                  {cueLabel(cue)}
                </Button>
              ))}
            </View>
            <Text className="text-sm text-text-secondary">
              {t('mobility.cueHint', {
                defaultValue:
                  'Timed steps marked Both sides cue halfway and at the end. Choose Sound or Both for an audible cue, including in silent mode. Cues play while this screen is open.',
              })}
            </Text>
            <Text className="font-semibold text-text-primary">
              {t('mobility.dailyReminderTime', {
                defaultValue: 'Daily reminder time (optional)',
              })}
            </Text>
            <TextInput
              value={draft.reminderTime}
              onChangeText={(reminderTime) =>
                setDraft({ ...draft, reminderTime })
              }
              placeholder={t('mobility.reminderTimePlaceholder', {
                defaultValue: 'HH:mm',
              })}
              accessibilityLabel={t('mobility.dailyReminderTime', {
                defaultValue: 'Daily reminder time (optional)',
              })}
              className="rounded-xl bg-raised px-4 py-3 text-text-primary"
              maxLength={5}
            />
            <Text className="text-sm text-text-secondary">
              {t('mobility.reminderPolicy', {
                defaultValue:
                  'This shares the one-per-day movement reminder limit with movement breaks. A reminder opens the routine list; it never records activity.',
              })}
            </Text>
            {draft.steps.map((item, index) => (
              <View
                key={item.id ?? index}
                className="rounded-2xl bg-raised p-4 gap-3"
              >
                <Text className="font-semibold text-text-primary">
                  {t('mobility.stepLabel', {
                    defaultValue: 'Step {{number}}',
                    number: index + 1,
                  })}
                </Text>
                <TextInput
                  value={item.name}
                  onChangeText={(name) => updateStep(index, { name })}
                  placeholder={t('mobility.movementName', {
                    defaultValue: 'Movement name',
                  })}
                  accessibilityLabel={t('mobility.movementName', {
                    defaultValue: 'Movement name',
                  })}
                  className="rounded-xl bg-surface px-3 py-3 text-text-primary"
                  maxLength={120}
                />
                <TextInput
                  value={item.instructions}
                  onChangeText={(instructions) =>
                    updateStep(index, { instructions })
                  }
                  placeholder={t('mobility.instructions', {
                    defaultValue: 'Optional instructions',
                  })}
                  accessibilityLabel={t('mobility.instructions', {
                    defaultValue: 'Optional instructions',
                  })}
                  multiline
                  className="rounded-xl bg-surface px-3 py-3 text-text-primary"
                  maxLength={500}
                />
                <View className="flex-row flex-wrap gap-2">
                  {(['timed', 'repetitions'] as const).map((kind) => (
                    <Button
                      key={kind}
                      variant={item.kind === kind ? 'primary' : 'secondary'}
                      onPress={() => updateStep(index, { kind })}
                    >
                      {kind === 'timed'
                        ? t('mobility.timed', { defaultValue: 'Timed' })
                        : t('mobility.repetitions', {
                            defaultValue: 'Repetitions',
                          })}
                    </Button>
                  ))}
                </View>
                <Text className="text-sm text-text-secondary">
                  {item.kind === 'timed'
                    ? t('mobility.durationSeconds', {
                        defaultValue: 'Duration in seconds',
                      })
                    : t('mobility.repetitionCount', {
                        defaultValue: 'Number of repetitions',
                      })}
                </Text>
                <TextInput
                  value={item.amount}
                  onChangeText={(amount) => updateStep(index, { amount })}
                  keyboardType="number-pad"
                  accessibilityLabel={
                    item.kind === 'timed'
                      ? t('mobility.durationSeconds', {
                          defaultValue: 'Duration in seconds',
                        })
                      : t('mobility.repetitionCount', {
                          defaultValue: 'Number of repetitions',
                        })
                  }
                  className="rounded-xl bg-surface px-3 py-3 text-text-primary"
                />
                <Text className="text-sm text-text-secondary">
                  {t('mobility.sideLabel', { defaultValue: 'Side' })}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {(['both', 'left', 'right'] as const).map((side) => (
                    <Button
                      key={side}
                      variant={item.side === side ? 'primary' : 'secondary'}
                      onPress={() => updateStep(index, { side })}
                    >
                      {sideLabel(side)}
                    </Button>
                  ))}
                </View>
                <Text className="text-sm text-text-secondary">
                  {t('mobility.transitionSeconds', {
                    defaultValue: 'Transition after this step (seconds)',
                  })}
                </Text>
                <TextInput
                  value={item.transition}
                  onChangeText={(transition) =>
                    updateStep(index, { transition })
                  }
                  keyboardType="number-pad"
                  accessibilityLabel={t('mobility.transitionSeconds', {
                    defaultValue: 'Transition after this step (seconds)',
                  })}
                  className="rounded-xl bg-surface px-3 py-3 text-text-primary"
                />
                {draft.steps.length > 1 ? (
                  <Button
                    variant="destructive"
                    onPress={() =>
                      setDraft({
                        ...draft,
                        steps: draft.steps.filter(
                          (_, stepIndex) => stepIndex !== index
                        ),
                      })
                    }
                  >
                    {t('mobility.removeStep', { defaultValue: 'Remove step' })}
                  </Button>
                ) : null}
              </View>
            ))}
            <Button
              variant="secondary"
              onPress={() =>
                setDraft({ ...draft, steps: [...draft.steps, blankStep()] })
              }
              disabled={draft.steps.length >= 40}
            >
              {t('mobility.addStep', { defaultValue: 'Add step' })}
            </Button>
            <Button disabled={busy} onPress={saveDraft}>
              {t('common.save', { defaultValue: 'Save' })}
            </Button>
            <Button variant="ghost" onPress={() => setDraft(null)}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
          </View>
        ) : (
          <View className="gap-4">
            <Text className="text-base text-text-secondary">
              {t('mobility.intro', {
                defaultValue:
                  'Build a short sequence you know. Only steps you confirm are recorded.',
              })}
            </Text>
            <Button onPress={() => setDraft(blankRoutine())}>
              {t('mobility.newRoutine', { defaultValue: 'New routine' })}
            </Button>
            {state?.syncError && (
              <View className="mb-4 gap-3 rounded-xl border border-border-subtle p-4">
                <Text className="text-base text-text-primary">
                  {state.syncError === 'conflict'
                    ? t('mobility.syncConflict', {
                        defaultValue: 'Mobility changed elsewhere',
                      })
                    : t('mobility.syncOffline', {
                        defaultValue: 'Saved on device \u00b7 sync pending',
                      })}
                </Text>
                <Button
                  onPress={() => {
                    if (identity)
                      void synchronizeMobility(identity).catch(() => undefined);
                  }}
                >
                  {t('mobility.syncRetry', { defaultValue: 'Sync now' })}
                </Button>
              </View>
            )}
            {state?.conflicts.map((conflict) => (
              <View key={conflict.operation.operationId} className="mb-4 gap-3">
                <Text className="text-base text-text-secondary">
                  {t('mobility.syncConflictDescription', {
                    defaultValue:
                      'Your local version is preserved. Keep a separate copy or use the server version. An active session copy runs without claiming the original plan.',
                  })}
                </Text>
                {['routine', 'session'].includes(
                  conflict.operation.mutation.kind
                ) && (
                  <Button
                    onPress={() => {
                      if (identity)
                        void resolveMobilityConflict(
                          identity,
                          conflict.operation.operationId,
                          'copy'
                        )
                          .then(() => synchronizeMobility(identity))
                          .catch(() => undefined);
                    }}
                  >
                    {t('mobility.syncKeepCopy', {
                      defaultValue: 'Keep a separate copy',
                    })}
                  </Button>
                )}
                <Button
                  onPress={() => {
                    if (identity)
                      void resolveMobilityConflict(
                        identity,
                        conflict.operation.operationId,
                        'server'
                      )
                        .then(() => synchronizeMobility(identity))
                        .catch(() => undefined);
                  }}
                >
                  {t('mobility.syncUseServer', {
                    defaultValue: 'Use server version',
                  })}
                </Button>
              </View>
            ))}
            {(state?.plans ?? [])
              .filter(
                (record) => !record.deleted && record.data.state === 'planned'
              )
              .map((record) => (
                <View
                  key={record.data.id}
                  className="mb-3 gap-3 rounded-xl border border-border-subtle p-4"
                >
                  <Text className="text-lg font-semibold text-text-primary">
                    {record.data.routine.name}
                  </Text>
                  <Text className="text-base text-text-secondary">
                    {record.data.day} · {record.data.time}
                  </Text>
                  <Button
                    disabled={busy}
                    onPress={() => {
                      if (identity)
                        void startMobilitySession(
                          identity,
                          record.data.routine.id,
                          new Date(),
                          record.data.id
                        )
                          .then(() => synchronizeMobility(identity))
                          .catch(() =>
                            setError(
                              t('mobility.syncConflict', {
                                defaultValue: 'Mobility changed elsewhere',
                              })
                            )
                          );
                    }}
                  >
                    {t('mobility.startPlanned', {
                      defaultValue: 'Start planned session',
                    })}
                  </Button>
                </View>
              ))}
            {state?.routines.map((routine) => (
              <View
                key={routine.id}
                testID={`mobility-routine-${routine.id}`}
                className="rounded-2xl border border-border-subtle bg-surface p-4 gap-3"
              >
                <View className="flex-row items-start gap-3">
                  <Icon name="exercise-yoga" size={24} color={accent} />
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="text-lg font-semibold text-text-primary">
                      {routine.name}
                    </Text>
                    <Text className="text-sm text-text-secondary">
                      {t('mobility.stepTotal', {
                        defaultValue: '{{count}} steps',
                        count: routine.steps.length,
                      })}
                      {routine.reminderTime
                        ? ` · ${routine.reminderTime.slice(0, 5)}`
                        : ''}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-2">
                  <NeonButton
                    className="flex-1"
                    icon="play"
                    size="sm"
                    disabled={busy}
                    label={t('mobility.startShort', { defaultValue: 'Start' })}
                    accessibilityLabel={t('mobility.startNamed', {
                      defaultValue: 'Start {{name}}',
                      name: routine.name,
                    })}
                    onPress={() =>
                      void perform(() =>
                        startMobilitySession(identity, routine.id)
                      )
                    }
                  />
                  <Pressable
                    className="h-11 w-11 items-center justify-center rounded-xl border border-border-subtle bg-raised"
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={t('mobility.editNamed', {
                      defaultValue: 'Edit {{name}}',
                      name: routine.name,
                    })}
                    onPress={() => setDraft(toDraft(routine))}
                  >
                    <Icon name="pencil" size={20} color={accent} />
                  </Pressable>
                  <Pressable
                    className="h-11 w-11 items-center justify-center rounded-xl"
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={t('mobility.deleteNamed', {
                      defaultValue: 'Delete {{name}}',
                      name: routine.name,
                    })}
                    onPress={() => confirmDeleteRoutine(routine)}
                  >
                    <Icon name="trash" size={20} color={danger} />
                  </Pressable>
                </View>
              </View>
            ))}
            <MobilityHistorySection
              history={state?.history ?? []}
              deleting={busy}
              onDelete={confirmDeleteSession}
              onExport={
                Platform.OS === 'ios'
                  ? (saved) => void perform(() => exportSession(saved, true))
                  : undefined
              }
            />
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}
