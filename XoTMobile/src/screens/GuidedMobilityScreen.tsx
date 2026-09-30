import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Button from '../components/ui/Button';
import MobilityHistorySection from '../components/MobilityHistorySection';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { fireSuccessHaptic } from '../services/haptics';
import {
  applyMobilitySessionAction,
  deleteMobilitySessionHistory,
  deleteMobilityRoutine,
  getMobilityState,
  mobilitySecondsRemaining,
  saveMobilityRoutine,
  startMobilitySession,
  subscribeMobilityState,
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
  transition: '0',
});
const blankRoutine = (): RoutineDraft => ({
  name: '',
  cue: 'haptic',
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
      transition: String(step.transitionSeconds),
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
    transitionSeconds < 0 ||
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
  const insets = useSafeAreaInsets();
  const nativeHeader = useNativeIOSHeadersActive();
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
  const previousRemaining = useRef<{ key: string; seconds: number } | null>(
    null
  );

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
    if (!session || session.state !== 'running' || remaining === null) {
      previousRemaining.current = null;
      return;
    }
    const key = `${session.id}:${session.phase}:${session.stepIndex}`;
    const previous = previousRemaining.current;
    if (
      previous?.key === key &&
      previous.seconds > 0 &&
      remaining === 0 &&
      AppState.currentState === 'active'
    ) {
      if (session.routine.cue === 'haptic' || session.routine.cue === 'both') {
        fireSuccessHaptic();
      }
      if (session.routine.cue === 'sound' || session.routine.cue === 'both') {
        playMobilityCueSound();
      }
    }
    previousRemaining.current = { key, seconds: remaining };
  }, [remaining, session]);

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
      setBusy(false);
    }
  };

  const runAction = (action: MobilitySessionAction) => {
    if (!identity || !session) return;
    void perform(() =>
      applyMobilitySessionAction(identity, session.id, action)
    );
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
            'Check each step: timed steps need 5–3600 seconds, repetitions need 1–1000, and transitions need 0–600 seconds.',
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
      {header}
      <KeyboardAwareScrollView
        mode="layout"
        className="flex-1"
        contentContainerClassName="px-4 py-5 gap-5"
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
              {t('mobility.expiryIsNotCompletion', {
                defaultValue:
                  'The timer does not mark a step complete. Confirm what you did.',
              })}
            </Text>
            {session.phase === 'transition' ? (
              <Button disabled={busy} onPress={() => runAction('continue')}>
                {t('mobility.continue', {
                  defaultValue: 'Continue to next step',
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
              {t('mobility.cue', { defaultValue: 'End-of-timer cue' })}
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
            {state?.routines.map((routine) => (
              <View
                key={routine.id}
                className="rounded-2xl bg-raised p-4 gap-3"
              >
                <Text className="text-xl font-semibold text-text-primary">
                  {routine.name}
                </Text>
                <Text className="text-sm text-text-secondary">
                  {t('mobility.stepTotal', {
                    defaultValue: '{{count}} steps',
                    count: routine.steps.length,
                  })}
                </Text>
                <Button
                  disabled={busy}
                  onPress={() =>
                    void perform(() =>
                      startMobilitySession(identity, routine.id)
                    )
                  }
                >
                  {t('mobility.start', { defaultValue: 'Start routine' })}
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => setDraft(toDraft(routine))}
                >
                  {t('common.edit', { defaultValue: 'Edit' })}
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onPress={() => confirmDeleteRoutine(routine)}
                >
                  {t('common.delete', { defaultValue: 'Delete' })}
                </Button>
              </View>
            ))}
            <MobilityHistorySection
              history={state?.history ?? []}
              deleting={busy}
              onDelete={confirmDeleteSession}
            />
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}
