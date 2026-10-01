import {
  plannedActivityLabel,
  progressGoalLabel,
  nutritionGoalLabel,
  progressDomainLabel,
} from '../components/tracking/trackingLabels';
import { useMealTypes } from '../hooks/useMealTypes';
import { getMealTypeDisplayLabel } from '../utils/mealNutrition';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { AccessibilityInfo, Modal, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  progressionStage,
  type DailyProgressDomain,
  type DailyProgressItem,
} from '@workspace/shared';
import TrackingScreen from '../components/tracking/TrackingScreen';
import { useNeonScale } from '../components/tracking/useNeonScale';
import ProgressTrackX from '../components/brand/ProgressTrackX';
import GlowCard from '../components/ui/GlowCard';
import NeonButton from '../components/ui/NeonButton';
import StatusView from '../components/StatusView';
import Icon, { type IconName } from '../components/Icon';
import { useDailyProgress } from '../hooks/useDailyTracking';
import { useMedicationEntries } from '../hooks/useMedications';
import { usePlannedSupplementActions } from '../hooks/usePlannedSupplementActions';
import { useServerConnection } from '../hooks';
import { usePreferences } from '../hooks/usePreferences';
import HydrationDetailsModal from '../components/HydrationDetailsModal';
import { formatLocalizedNumber, useAppLocale } from '../localization';
import { formatDate, getTodayDate } from '../utils/dateUtils';
import { activeLocalSupplementStatus } from '../utils/medications';
import {
  overlayLocalSupplementResponses,
  type LocalSupplementResponse,
} from '../utils/dailyProgressOverlay';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyProgress'>;

const DOMAIN_ORDER: DailyProgressDomain[] = [
  'checkin',
  'habit',
  'measurement',
  'supplement',
  'meal',
  'goal',
  'workout',
];

const DOMAIN_ICON: Record<DailyProgressDomain, IconName> = {
  checkin: 'daily-checkin',
  habit: 'habit',
  measurement: 'scale',
  supplement: 'medication',
  meal: 'meal',
  goal: 'target',
  workout: 'exercise-running',
};

const DailyProgressScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const scale = useNeonScale();
  const isFocused = useIsFocused();
  const locale = useAppLocale();
  const { mealTypes } = useMealTypes();
  const previousProgress = useRef<{
    date: string;
    percent: number | null;
  } | null>(null);
  const celebratedDays = useRef(new Set<string>());
  const [completionProgress, setCompletionProgress] = useState(100);
  const [completionVisible, setCompletionVisible] = useState(false);
  const [hydrationVisible, setHydrationVisible] = useState(false);
  const { preferences } = usePreferences();
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion
    );
    return () => sub.remove();
  }, []);
  const [secondary, border] = useCSSVariable([
    '--color-text-secondary',
    '--color-border-subtle',
  ]) as [string, string];
  const [date, setDate] = useState(route.params?.date ?? getTodayDate());
  const { isConnected } = useServerConnection();
  const progressQuery = useDailyProgress(date, { enabled: isConnected });
  const entriesQuery = useMedicationEntries({
    fromDate: date,
    toDate: date,
    enabled: isConnected,
  });
  const { bySchedule } = usePlannedSupplementActions(date, entriesQuery.data);

  const progress = useMemo(() => {
    if (!progressQuery.data) return null;
    const responses: LocalSupplementResponse[] = [];
    for (const [scheduleId, action] of bySchedule) {
      const status = activeLocalSupplementStatus(action);
      if (status && action.syncState !== 'synced') {
        responses.push({ scheduleId, status, occurredAt: action.occurredAt });
      }
    }
    return overlayLocalSupplementResponses(progressQuery.data, responses);
  }, [progressQuery.data, bySchedule]);

  useEffect(() => {
    if (!progress || !isFocused) return;
    const previous = previousProgress.current;
    if (
      date === getTodayDate() &&
      previous?.date === date &&
      previous.percent != null &&
      previous.percent < 100 &&
      progress.percent === 100 &&
      progress.applicable > 0 &&
      !celebratedDays.current.has(date)
    ) {
      celebratedDays.current.add(date);
      setCompletionProgress(previous.percent);
      setCompletionVisible(true);
    }
    previousProgress.current = { date, percent: progress.percent };
  }, [date, progress, isFocused]);

  useEffect(() => {
    if (!completionVisible) return;
    const frame = requestAnimationFrame(() => setCompletionProgress(100));
    return () => cancelAnimationFrame(frame);
  }, [completionVisible]);

  const isToday = date === getTodayDate();
  const dayLabel = isToday
    ? t('dashboard.today', { defaultValue: 'Today' })
    : formatDate(date, locale);

  const stateStyle = (
    item: DailyProgressItem
  ): { icon: IconName; color: string; label: string } => {
    switch (item.state) {
      case 'complete':
        return {
          icon: 'checkmark-circle',
          color: scale.green,
          label: t('progress.state.complete', { defaultValue: 'Complete' }),
        };
      case 'started':
        return {
          icon: 'timer',
          color: scale.yellow,
          label: t('progress.state.started', { defaultValue: 'Started' }),
        };
      case 'excluded':
        return {
          icon: 'skip-forward',
          color: secondary,
          label: t('progress.state.excluded', {
            defaultValue: 'Skipped, not counted',
          }),
        };
      default:
        return {
          icon: 'radio-button-off',
          color: secondary,
          label: t('progress.state.pending', {
            defaultValue: 'Not recorded yet',
          }),
        };
    }
  };

  const itemLabel = (item: DailyProgressItem) => {
    if (item.domain === 'workout' && item.activity_type)
      return plannedActivityLabel(t, item.activity_type);
    if (item.domain === 'goal') return progressGoalLabel(t, item.label);
    if (item.domain === 'meal') {
      const type = mealTypes.find((type) => type.id === item.reference_id);
      return type ? getMealTypeDisplayLabel(type, t) : item.label;
    }
    if (item.domain === 'checkin')
      return t('progress.checkinItem', { defaultValue: 'Daily check-in' });
    if (item.domain === 'measurement' && item.label === 'weight') {
      return t('progress.weighIn', { defaultValue: 'Weigh-in' });
    }
    if (item.domain === 'measurement') {
      return t('progress.measurement', { defaultValue: 'Measurement' });
    }
    return item.label;
  };

  const openItem = (item: DailyProgressItem) => {
    switch (item.domain) {
      case 'checkin':
        return navigation.navigate('DailyCheckIn', { date });
      case 'habit':
        return navigation.navigate('Habits', {
          date,
          habitId: item.reference_id ?? undefined,
        });
      case 'supplement':
        return navigation.navigate('Supplements', {
          date,
          scheduleId: item.reference_id ?? undefined,
        });
      case 'measurement':
        return navigation.navigate('MeasurementsAdd', {
          date,
          measurementKey: item.label,
        });
      case 'workout':
        return navigation.navigate('WorkoutPlans', {
          date,
          assignmentId: item.reference_id ?? undefined,
        });
      case 'goal':
        if (item.label === 'hydration') return setHydrationVisible(true);
        return item.label === 'activity_duration'
          ? navigation.navigate('ExerciseReview', { date })
          : navigation.navigate('DailyNutritionDetails', { date });
      case 'meal':
        return navigation.navigate('MealTypeDetail', {
          date,
          mealTypeId: item.reference_id ?? undefined,
          mealLabel: itemLabel(item),
        });
      default:
        return navigation.navigate('Tabs', {
          screen: 'Diary',
          params: { selectedDate: date },
        });
    }
  };

  const stage = progressionStage(progress?.percent ?? null);
  const stageColor =
    stage === 'completed'
      ? scale.green
      : stage === 'progressing'
        ? scale.yellow
        : stage === 'started'
          ? scale.orange
          : secondary;

  return (
    <TrackingScreen
      testID="daily-progress"
      title={t('progress.title', { defaultValue: 'Daily Progress' })}
      subtitle={t('progress.subtitle', {
        defaultValue: 'The share of today’s tracking tasks you have completed.',
      })}
      date={date}
      onDateChange={setDate}
      onBack={navigation.goBack}
      onRefresh={() => progressQuery.refetch()}
    >
      {!isConnected ? (
        <StatusView
          icon="cloud-offline"
          iconTone="muted"
          title={t('progress.offline', {
            defaultValue: 'Connect to your server to see progress.',
          })}
        />
      ) : !progress ? (
        <StatusView
          loading
          title={t('progress.loading', { defaultValue: 'Loading progress…' })}
        />
      ) : (
        <>
          <GlowCard
            testID="daily-progress-summary"
            glowColor={stage === 'ready' ? undefined : stageColor}
            className="mb-3 items-center p-5"
          >
            <ProgressTrackX
              progress={progress.percent}
              label={t('progress.xLabel', { defaultValue: 'Daily Progress' })}
              unknownLabel={t('progress.nothingApplies', {
                defaultValue: 'No tasks today',
              })}
              size={176}
            />
            <Text
              testID="daily-progress-count"
              className="mt-3 text-xl font-bold text-text-primary"
            >
              {progress.applicable > 0
                ? t('progress.countLine', {
                    defaultValue:
                      '{{day}} · {{completed}} of {{applicable}} complete',
                    day: dayLabel,
                    completed: progress.completed,
                    applicable: progress.applicable,
                  })
                : t('progress.nothingAppliesLine', {
                    defaultValue: '{{day}} · no tracking tasks',
                    day: dayLabel,
                  })}
            </Text>
            <Text className="mt-1 text-center text-sm text-text-secondary">
              {progress.applicable > 0
                ? t('progress.explanation', {
                    defaultValue:
                      'Each task counts equally. This is not a health score; skipped items are left out.',
                  })
                : t('progress.emptyExplanation', {
                    defaultValue:
                      'Nothing is scheduled or selected for this day. Choose what counts in Tracking settings.',
                  })}
            </Text>
          </GlowCard>

          {DOMAIN_ORDER.map((domain) => {
            const items = progress.items.filter(
              (item) => item.domain === domain
            );
            if (items.length === 0) return null;
            const coverage = progress.coverage[domain];
            return (
              <GlowCard
                key={domain}
                className="mb-3 px-4 pt-3 pb-1"
                testID={`daily-progress-${domain}`}
              >
                <View className="flex-row items-center gap-2 pb-1">
                  <Icon
                    name={DOMAIN_ICON[domain]}
                    size={20}
                    color={secondary}
                  />
                  <Text
                    accessibilityRole="header"
                    className="flex-1 text-base font-semibold text-text-primary"
                  >
                    {progressDomainLabel(t, domain)}
                  </Text>
                  <Text className="text-sm text-text-secondary">
                    {t('progress.domainCount', {
                      defaultValue: '{{completed}} of {{applicable}}',
                      completed: coverage.completed,
                      applicable: coverage.applicable,
                    })}
                  </Text>
                </View>
                {items.map((item, index) => {
                  const style = stateStyle(item);
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      className="min-h-12 flex-row items-center gap-3 py-2 active:opacity-70"
                      style={
                        index > 0
                          ? { borderTopWidth: 1, borderTopColor: border }
                          : undefined
                      }
                      onPress={() => openItem(item)}
                      accessibilityLabel={`${itemLabel(item)}: ${style.label}`}
                      testID={`daily-progress-item-${item.id}`}
                    >
                      <Icon name={style.icon} size={22} color={style.color} />
                      <View className="flex-1">
                        <Text className="text-base text-text-primary">
                          {itemLabel(item)}
                        </Text>
                        {item.domain === 'goal' && (
                          <Text className="text-sm text-text-secondary">
                            {item.goal_summary
                              ? Object.entries(item.goal_summary)
                                  .map(
                                    ([key, value]) =>
                                      `${nutritionGoalLabel(t, key)}: ${formatLocalizedNumber(value)} ${key === 'calories' ? 'kcal' : 'g'}`
                                  )
                                  .join(' · ')
                              : `${item.value == null ? t('progress.goals.unknown', { defaultValue: 'No value recorded' }) : formatLocalizedNumber(item.value)} / ${formatLocalizedNumber(item.target ?? 0)} ${item.unit ?? ''}`}
                          </Text>
                        )}
                        <Text className="text-xs text-text-secondary">
                          {style.label}
                          {item.reason.endsWith('_pending_sync')
                            ? ` · ${t('progress.pendingSync', { defaultValue: 'saved on this phone' })}`
                            : ''}
                        </Text>
                      </View>
                      <Icon
                        name="chevron-forward"
                        size={16}
                        color={secondary}
                      />
                    </Pressable>
                  );
                })}
              </GlowCard>
            );
          })}

          <NeonButton
            variant="outline"
            icon="settings"
            label={t('progress.chooseTasks', {
              defaultValue: 'Choose what counts',
            })}
            onPress={() => navigation.navigate('TrackingSettings')}
            className="mb-3"
          />
        </>
      )}
      <HydrationDetailsModal
        visible={hydrationVisible}
        date={date}
        unit={preferences?.water_display_unit ?? 'ml'}
        onClose={() => setHydrationVisible(false)}
        onConfigure={() => {
          setHydrationVisible(false);
          navigation.navigate('WaterContainers');
        }}
      />
      <Modal
        visible={completionVisible}
        transparent
        animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={() => setCompletionVisible(false)}
      >
        <Pressable
          className="flex-1 items-center justify-end bg-black/50 p-6"
          onPress={() => setCompletionVisible(false)}
          accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
        >
          <View className="w-full rounded-2xl bg-surface p-6 gap-4 items-center">
            <ProgressTrackX
              progress={completionProgress}
              size={120}
              label={t('progress.title', { defaultValue: 'Daily Progress' })}
              unknownLabel={t('progress.nothingApplies', {
                defaultValue: 'No tasks today',
              })}
            />
            <Text
              accessibilityRole="header"
              className="text-xl font-semibold text-text-primary"
            >
              {t('progress.completedTitle', {
                defaultValue: 'Your tracking tasks are complete',
              })}
            </Text>
            <Text className="text-text-secondary text-center">
              {t('progress.completedHint', {
                defaultValue:
                  'You have recorded or reviewed every applicable task for today. This reflects tracking, not a health score.',
              })}
            </Text>
            <NeonButton
              label={t('common.done', { defaultValue: 'Done' })}
              onPress={() => setCompletionVisible(false)}
            />
          </View>
        </Pressable>
      </Modal>
    </TrackingScreen>
  );
};

export default DailyProgressScreen;
