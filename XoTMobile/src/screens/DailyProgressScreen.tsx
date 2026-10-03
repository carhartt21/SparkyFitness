import {
  nutritionGoalLabel,
  progressDomainLabel,
  categoryStateLabel,
} from '../components/tracking/trackingLabels';
import React, { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { progressionStage, type DailyProgressItem } from '@workspace/shared';
import TrackingScreen from '../components/tracking/TrackingScreen';
import { useNeonScale } from '../components/tracking/useNeonScale';
import ProgressTrackX from '../components/brand/ProgressTrackX';
import GlowCard from '../components/ui/GlowCard';
import NeonButton from '../components/ui/NeonButton';
import StatusView from '../components/StatusView';
import Icon, { type IconName } from '../components/Icon';
import { useProjectedDailyProgress } from '../hooks/useProjectedDailyProgress';
import {
  useProgressActions,
  PROGRESS_DOMAIN_ORDER,
} from '../hooks/useProgressActions';
import { useServerConnection } from '../hooks';
import { usePreferences } from '../hooks/usePreferences';
import HydrationDetailsModal from '../components/HydrationDetailsModal';
import { formatLocalizedNumber, useAppLocale } from '../localization';
import { formatDate, getTodayDate } from '../utils/dateUtils';
import { useActivityPlanning } from '../hooks/useActivityPlanning';
import {
  progressCategories,
  PROGRESS_CATEGORY_ICONS,
} from '../utils/progressCategories';
import WeeklyActivityOverview from '../components/WeeklyActivityOverview';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyProgress'>;

const DailyProgressScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const scale = useNeonScale();
  const { width, fontScale } = useWindowDimensions();
  const stackedSummary = fontScale > 1.3 || width < 360;
  const isFocused = useIsFocused();
  const locale = useAppLocale();
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
  const progressQuery = useProjectedDailyProgress(date, isConnected);
  const progress = progressQuery.progress;
  const activities = useActivityPlanning(date, date, isConnected);
  const [activityFailure, setActivityFailure] = useState(false);
  const resolveActivity = async (
    id: string,
    revision: number,
    action: 'skip' | 'undo'
  ) => {
    setActivityFailure(false);
    try {
      await activities.mutation.mutateAsync({
        occurrence_id: id,
        expected_revision: revision,
        action,
      });
    } catch {
      setActivityFailure(true);
    }
  };
  const domains = progress
    ? progressCategories(progress.items).map((category) => category.domain)
    : PROGRESS_DOMAIN_ORDER;
  const focusedDomain = route.params?.domain;
  const orderedDomains = focusedDomain
    ? [focusedDomain, ...domains.filter((domain) => domain !== focusedDomain)]
    : domains;

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

  const { itemLabel, openItem } = useProgressActions(date, () =>
    setHydrationVisible(true)
  );

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
      onRefresh={async () => {
        await Promise.all([
          progressQuery.refetch(),
          activities.query.refetch(),
        ]);
      }}
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
            className={`mb-3 items-center gap-4 p-4 ${stackedSummary ? '' : 'flex-row'}`}
          >
            <ProgressTrackX
              progress={progress.percent}
              label={t('progress.xLabel', { defaultValue: 'Daily Progress' })}
              unknownLabel={
                progress.items.length
                  ? t('progress.noCountedTasks', {
                      defaultValue: 'No counted tasks',
                    })
                  : t('progress.nothingApplies', {
                      defaultValue: 'No tasks today',
                    })
              }
              size={112}
              fit="track"
              showValue={progress.percent != null}
            />
            <View className={stackedSummary ? 'w-full' : 'min-w-0 flex-1'}>
              <Text
                testID="daily-progress-count"
                className={`text-lg font-semibold text-text-primary ${stackedSummary ? 'text-center' : ''}`}
              >
                {progress.applicable > 0
                  ? t('progress.countLine', {
                      defaultValue:
                        '{{day}} · {{completed}} of {{applicable}} complete',
                      day: dayLabel,
                      completed: progress.completed,
                      applicable: progress.applicable,
                    })
                  : progress.items.length
                    ? `${dayLabel} · ${t('progress.noCountedTasks', { defaultValue: 'No counted tasks' })}`
                    : t('progress.nothingAppliesLine', {
                        defaultValue: '{{day}} · no tracking tasks',
                        day: dayLabel,
                      })}
              </Text>
              <Text
                className={`mt-1 text-text-secondary ${stackedSummary ? 'text-center text-sm' : 'text-xs'}`}
              >
                {progress.applicable > 0
                  ? t('progress.explanation', {
                      defaultValue:
                        'Each task counts equally. This is not a health score; skipped items are left out.',
                    })
                  : progress.items.length
                    ? t('progress.uncountedExplanation', {
                        defaultValue:
                          'Items below do not count toward this day’s progress. Review them or choose what counts in Tracking settings.',
                      })
                    : t('progress.emptyExplanation', {
                        defaultValue:
                          'Nothing is scheduled or selected for this day. Choose what counts in Tracking settings.',
                      })}
              </Text>
            </View>
          </GlowCard>

          {activityFailure ? (
            <Text
              accessibilityRole="alert"
              className="mb-3 text-sm text-text-secondary"
            >
              {t('progress.activitySaveFailed', {
                defaultValue:
                  'The status could not be saved. Refresh goals and try again.',
              })}
            </Text>
          ) : null}
          {orderedDomains.map((domain) => {
            const items = progress.items.filter(
              (item) => item.domain === domain
            );
            if (items.length === 0) return null;
            const coverage = progress.coverage[domain] ?? {
              applicable: 0,
              completed: 0,
            };
            return (
              <GlowCard
                key={domain}
                className="mb-3 px-4 pt-3 pb-1"
                testID={`daily-progress-${domain}`}
              >
                <View className="flex-row items-center gap-2 pb-1">
                  <Icon
                    name={PROGRESS_CATEGORY_ICONS[domain]}
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
                    {coverage.applicable === 0
                      ? categoryStateLabel(
                          t,
                          progressCategories(items)[0]?.state ?? 'unknown'
                        )
                      : t('progress.domainCount', {
                          defaultValue: '{{completed}} of {{applicable}}',
                          completed: coverage.completed,
                          applicable: coverage.applicable,
                        })}
                  </Text>
                </View>
                {items.map((item, index) => {
                  const style = stateStyle(item);
                  const occurrence = activities.query.data?.occurrences.find(
                    (row) => row.id === item.id
                  );
                  const canSkip =
                    occurrence?.source === 'workout' &&
                    occurrence.state !== 'complete' &&
                    (occurrence.state !== 'excluded' ||
                      occurrence.revision > 0);
                  const undo = occurrence?.state === 'excluded';
                  return (
                    <View key={item.id} className="flex-row items-center">
                      <Pressable
                        accessibilityRole="button"
                        className="min-h-12 flex-1 flex-row items-center gap-3 py-2 active:opacity-70"
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
                            {item.optional && item.state !== 'excluded'
                              ? t('progress.optionalActivity', {
                                  defaultValue:
                                    'Optional · does not count toward the daily goal',
                                })
                              : style.label}
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
                      {canSkip ? (
                        <Pressable
                          testID={`daily-progress-resolve-${item.id}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${itemLabel(item)}: ${
                            undo
                              ? t('activityPlanning.undo', {
                                  defaultValue: 'Undo decision',
                                })
                              : t('activityPlanning.skip', {
                                  defaultValue: 'Skip activity',
                                })
                          }`}
                          disabled={activities.mutation.isPending}
                          onPress={() =>
                            void resolveActivity(
                              occurrence.id,
                              occurrence.revision,
                              undo ? 'undo' : 'skip'
                            )
                          }
                          className="min-h-11 min-w-11 items-center justify-center"
                        >
                          <Icon
                            name={undo ? 'repeat' : 'skip-forward'}
                            size={20}
                            color={secondary}
                          />
                        </Pressable>
                      ) : null}
                    </View>
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
              unknownLabel={
                progress?.items.length
                  ? t('progress.noCountedTasks', {
                      defaultValue: 'No counted tasks',
                    })
                  : t('progress.nothingApplies', {
                      defaultValue: 'No tasks today',
                    })
              }
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
      <WeeklyActivityOverview
        key={date}
        date={date}
        enabled={isConnected}
        onOpen={(source, day) =>
          source === 'mobility'
            ? navigation.navigate('GuidedMobility')
            : navigation.navigate('ExerciseReview', { date: day })
        }
      />
    </TrackingScreen>
  );
};

export default DailyProgressScreen;
