import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, Platform } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PresetSessionResponse } from '@workspace/shared';
import type { WorkoutDurationSheetRef } from '../components/WorkoutDurationSheet';
import type { CompletedSetMap } from '../stores/activeWorkoutStore';
import { useActiveWorkoutStore } from '../stores/activeWorkoutStore';
import { formatDuration, summarizeWorkoutSpan } from '../utils/workoutSession';
import {
  queueCompletedWorkoutExport,
  needsPhoneWorkoutEnergy,
} from '../services/workoutHealthExport';
import { addLog } from '../services/LogService';
import type { RootStackParamList } from '../types/navigation';

interface UseActiveWorkoutFinishArgs {
  navigation: Pick<NativeStackNavigationProp<RootStackParamList>, 'replace'>;
  session: PresetSessionResponse | null;
  completedSetIds: CompletedSetMap;
  flush: () => Promise<boolean>;
  durationSheetRef: React.RefObject<WorkoutDurationSheetRef | null>;
  safeGoBack: () => void;
}

export function useActiveWorkoutFinish({
  navigation,
  session,
  completedSetIds,
  flush,
  durationSheetRef,
  safeGoBack,
}: UseActiveWorkoutFinishArgs): {
  handleFinish: () => Promise<void>;
  maybeAdjustDurationThenFinish: () => void;
  handleDurationSave: (minutes: number) => void;
  handleConfirmEnd: () => void;
} {
  const { t } = useTranslation();
  const finishInFlight = useRef(false);

  const handleFinish = useCallback(async (): Promise<void> => {
    if (finishInFlight.current) return;
    finishInFlight.current = true;
    const initial = useActiveWorkoutStore.getState();
    const isCurrentWorkout = () => {
      const current = useActiveWorkoutStore.getState();
      return (
        current.sessionId === initial.sessionId &&
        current.startedAt === initial.startedAt &&
        current.sourceServerConfigId === initial.sourceServerConfigId
      );
    };
    function confirmDiscardChanges(): void {
      if (!isCurrentWorkout() || finishInFlight.current) return;
      Alert.alert(
        t('workout.discardChangesTitle', {
          defaultValue: 'Discard unsaved changes?',
        }),
        t('workout.discardChangesMessage', {
          defaultValue:
            "Sets and edits that haven't reached the server will be lost. Changes already saved are kept.",
        }),
        [
          {
            text: t('common.cancel', { defaultValue: 'Cancel' }),
            style: 'cancel',
          },
          {
            text: t('workout.discard', { defaultValue: 'Discard' }),
            style: 'destructive',
            onPress: () => {
              if (!isCurrentWorkout() || finishInFlight.current) return;
              useActiveWorkoutStore.getState().clearWorkout();
              safeGoBack();
            },
          },
        ]
      );
    }

    function showSaveError(): void {
      Alert.alert(
        t('workout.saveError', {
          defaultValue: 'Could not save your workout',
        }),
        t('workout.failedChangesMessage', {
          defaultValue: 'Some changes have not reached the server yet.',
        }),
        [
          {
            text: t('workout.retry', { defaultValue: 'Retry' }),
            onPress: () => {
              if (isCurrentWorkout()) void handleFinish();
            },
          },
          {
            text: t('common.discardChanges', {
              defaultValue: 'Discard changes',
            }),
            style: 'destructive',
            onPress: confirmDiscardChanges,
          },
          {
            text: t('common.cancel', { defaultValue: 'Cancel' }),
            style: 'cancel',
          },
        ]
      );
    }

    function readSavedWorkout() {
      if (!isCurrentWorkout()) return null;
      const state = useActiveWorkoutStore.getState();
      if (state.hasUnsavedChanges) {
        showSaveError();
        return null;
      }
      return state;
    }

    async function flushForFinish(): Promise<boolean> {
      if (!isCurrentWorkout()) return false;
      const ok = await flush();
      if (!isCurrentWorkout()) return false;
      if (!ok) {
        showSaveError();
        return false;
      }
      return readSavedWorkout() != null;
    }

    async function attempt(): Promise<void> {
      if (!(await flushForFinish())) return;
      let state = readSavedWorkout();
      if (!state) return;
      const finishedAt = Date.now();
      if (state.sessionId) {
        try {
          let activeEnergyKcal: number | undefined;
          if (
            Object.keys(state.completedSetIds).length > 0 &&
            Platform.OS === 'ios' &&
            (await needsPhoneWorkoutEnergy(state.sessionId))
          ) {
            if (!isCurrentWorkout()) return;
            activeEnergyKcal = await new Promise<number | undefined>(
              (resolve) => {
                const ask = () =>
                  Alert.prompt(
                    t('healthSync.workoutEnergyTitle', {
                      defaultValue: 'Active calories for Apple Health',
                    }),
                    t('healthSync.workoutEnergyMessage', {
                      defaultValue:
                        'No Watch energy recording was started. Enter active calories only if you know them. Skip export to keep the workout in X on Track without a zero-calorie Health entry. Your goal settings stay unchanged.',
                    }),
                    [
                      {
                        text: t('healthSync.workoutSkipExport', {
                          defaultValue: 'Skip export',
                        }),
                        style: 'cancel',
                        onPress: () => resolve(undefined),
                      },
                      {
                        text: t('common.save', { defaultValue: 'Save' }),
                        onPress: (value?: string) => {
                          const energy = Number(
                            value?.trim().replace(',', '.')
                          );
                          if (Number.isFinite(energy) && energy > 0)
                            resolve(energy);
                          else
                            Alert.alert(
                              t('healthSync.workoutEnergyInvalid', {
                                defaultValue:
                                  'Enter a positive calorie amount, or skip export.',
                              }),
                              undefined,
                              [
                                {
                                  text: t('common.ok', { defaultValue: 'OK' }),
                                  onPress: ask,
                                },
                              ]
                            );
                        },
                      },
                    ],
                    'plain-text',
                    '',
                    'decimal-pad'
                  );
                ask();
              }
            );
          }
          // Watch edits can arrive while the calorie/permission prompt is open.
          // Persist them and use the fresh snapshot for Health export.
          if (!(await flushForFinish())) return;
          state = readSavedWorkout();
          if (!state?.sessionId) return;
          const exportResult = await queueCompletedWorkoutExport({
            sessionId: state.sessionId,
            startedAt: state.startedAt,
            finishedAt,
            completedSetCount: Object.keys(state.completedSetIds).length,
            sourceServerConfigId: state.sourceServerConfigId,
            activeEnergyKcal,
          });
          if (!isCurrentWorkout()) return;
          if (exportResult === 'watch-unavailable') {
            Alert.alert(
              t('healthSync.workoutWatchUnavailableTitle', {
                defaultValue: 'Check Apple Health export',
              }),
              t('healthSync.workoutWatchUnavailableMessage', {
                defaultValue:
                  'Your workout is saved in X on Track, but the Watch could not confirm its Health export. Check Apple Health after reconnecting. The phone will not create a second workout.',
              })
            );
          }
          if (exportResult === 'watch-pending') {
            Alert.alert(
              t('healthSync.workoutWatchPendingTitle', {
                defaultValue: 'Apple Health recording on Watch',
              }),
              t('healthSync.workoutWatchPendingMessage', {
                defaultValue:
                  'Your workout is saved in X on Track. The Watch will finish its energy recording when it receives the finish command. Keep both devices connected; the phone will not create a duplicate Health workout.',
              })
            );
          }
        } catch (error) {
          if (!isCurrentWorkout()) return;
          addLog(
            `[Workout Health] Finish export pending: ${String(error)}`,
            'WARNING'
          );
          Alert.alert(
            t('healthSync.workoutExportErrorTitle', {
              defaultValue: 'Apple Health export unavailable',
            }),
            t('healthSync.workoutExportCheckPermissions', {
              defaultValue:
                'Your workout is saved in X on Track. Check the workout and active-energy write permissions in Sync settings, then reconnect your Watch and check Apple Health. No extra workout will be created to replace an unconfirmed Watch save.',
            })
          );
        }
      }
      // Export can also await native permissions or transport. Never clear edits
      // that arrived during that wait, or clear a replacement/account session.
      if (!(await flushForFinish())) return;
      state = readSavedWorkout();
      if (!state) return;
      const isIntervalWorkout = state.workoutFormat !== 'standard';
      const hasCompletedSets = Object.keys(state.completedSetIds).length > 0;
      const celebration =
        state.session != null && (hasCompletedSets || isIntervalWorkout)
          ? {
              session: state.session,
              completedSetIds: state.completedSetIds,
              prSetIds: state.prSetIds,
              startedAt: state.startedAt,
              finishedAt,
              sourcePresetId: state.sourcePresetId,
              sourceServerConfigId: state.sourceServerConfigId,
              plannedSetValues: state.plannedSetValues,
              workoutFormat: state.workoutFormat,
              timeCapSeconds: state.timeCapSeconds,
              intervalRoundsCompleted: state.intervalRoundsCompleted,
              intervalRepsCompleted: state.intervalRepsCompleted,
              intervalStatus: state.intervalStatus,
              intervalScalingNotes: state.intervalScalingNotes,
            }
          : null;
      state.clearWorkout();
      if (celebration != null) {
        navigation.replace('WorkoutComplete', celebration);
      } else {
        safeGoBack();
      }
    }
    try {
      await attempt();
    } finally {
      finishInFlight.current = false;
    }
  }, [flush, navigation, safeGoBack, t]);

  const maybeAdjustDurationThenFinish = useCallback(() => {
    const { completedSetIds: completed, startedAt } =
      useActiveWorkoutStore.getState();
    const span = summarizeWorkoutSpan(completed, startedAt);
    if (span == null || !span.hasLongGap) {
      void handleFinish();
      return;
    }
    const activeLabel = formatDuration(span.activeMinutes);
    Alert.alert(
      t('workout.adjustDurationTitle', {
        defaultValue: 'Adjust workout duration?',
      }),
      t('workout.endWorkoutMessage', {
        defaultValue:
          'This workout spans {{span}}, including a long break. Log {{active}} of active time instead?',
        span: formatDuration(span.totalMinutes),
        active: activeLabel,
      }),
      [
        {
          text: t('workout.logWorkout', {
            defaultValue: 'Log {{name}}',
            name: activeLabel,
          }),
          onPress: () => {
            useActiveWorkoutStore
              .getState()
              .setWorkoutDurationMinutes(span.activeMinutes);
            void handleFinish();
          },
        },
        {
          text: t('workout.keep', {
            defaultValue: 'Keep {{name}}',
            name: formatDuration(span.totalMinutes),
          }),
          onPress: () => void handleFinish(),
        },
        {
          text: t('workout.custom', { defaultValue: 'Custom…' }),
          onPress: () =>
            durationSheetRef.current?.present(
              span.activeMinutes,
              Math.floor(span.totalMinutes)
            ),
        },
      ]
    );
  }, [durationSheetRef, handleFinish, t]);

  const handleDurationSave = useCallback(
    (minutes: number) => {
      useActiveWorkoutStore.getState().setWorkoutDurationMinutes(minutes);
      void handleFinish();
    },
    [handleFinish]
  );

  const handleConfirmEnd = useCallback(() => {
    Keyboard.dismiss();
    const totalSets =
      session?.exercises.reduce((sum, e) => sum + e.sets.length, 0) ?? 0;
    const doneSets =
      session?.exercises.reduce(
        (sum, e) =>
          sum + e.sets.filter((s) => completedSetIds[String(s.id)]).length,
        0
      ) ?? 0;
    const remaining = totalSets - doneSets;
    const message =
      remaining > 0
        ? t('workout.setsRemaining', {
            defaultValue:
              '{{done}} of {{total}} sets logged. {{remaining}} still to go.',
            done: doneSets,
            total: totalSets,
            remaining,
          })
        : t('workout.allSetsLogged', {
            defaultValue: 'All {{total}} sets logged. Nice work!',
            total: totalSets,
          });
    Alert.alert(
      t('workout.endWorkoutTitle', { defaultValue: 'End workout?' }),
      message,
      [
        {
          text: t('workout.keepGoing', { defaultValue: 'Keep going' }),
          style: 'cancel',
        },
        {
          text: t('workout.endWorkout', { defaultValue: 'End Workout' }),
          style: 'default',
          onPress: maybeAdjustDurationThenFinish,
        },
      ]
    );
  }, [session, completedSetIds, maybeAdjustDurationThenFinish, t]);

  return {
    handleFinish,
    maybeAdjustDurationThenFinish,
    handleDurationSave,
    handleConfirmEnd,
  };
}
