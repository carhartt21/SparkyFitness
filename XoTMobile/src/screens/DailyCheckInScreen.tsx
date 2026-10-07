import Button from '../components/ui/Button';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  activeContextPeriods,
  DAILY_CHECKIN_BUILT_IN_TAGS,
  DAILY_CHECKIN_OVERALL_OPTIONS,
  DAILY_CHECKIN_QUESTION_VERSION,
  DAILY_CHECKIN_QUESTIONS_V1,
  favourableShare,
  hasCheckinResponse,
  isBuiltInCheckinTag,
  type CheckinQuestionDefinition,
  type DailyCheckin,
} from '@workspace/shared';
import TrackingScreen from '../components/tracking/TrackingScreen';
import CheckinFace from '../components/tracking/CheckinFace';
import {
  checkinQuestionText,
  checkinTagLabel,
  contextKindLabel,
  overallDayLabel,
} from '../components/tracking/trackingLabels';
import {
  colorForShare,
  useNeonScale,
  type NeonScale,
} from '../components/tracking/useNeonScale';
import GlowCard from '../components/ui/GlowCard';
import NeonButton from '../components/ui/NeonButton';
import Icon, { type IconName } from '../components/Icon';
import StatusView from '../components/StatusView';
import {
  useDailyCheckin,
  useHealthContextPeriods,
  useSaveDailyCheckin,
} from '../hooks/useDailyTracking';
import { useServerConnection } from '../hooks';
import { useCheckinTagOptions } from '../hooks/useCheckinTagOptions';
import { getTodayDate } from '../utils/dateUtils';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyCheckIn'>;

type QuestionKey = CheckinQuestionDefinition['key'];

interface Draft {
  overall_day: number | null;
  energy: number | null;
  stress: number | null;
  sleep_quality: number | null;
  nutrition_on_track: number | null;
  activity: number | null;
  note: string;
  tags: string[];
}

const EMPTY: Draft = {
  overall_day: null,
  energy: null,
  stress: null,
  sleep_quality: null,
  nutrition_on_track: null,
  activity: null,
  note: '',
  tags: [],
};

function draftFrom(checkin: DailyCheckin | null | undefined): Draft {
  if (!checkin || checkin.state === 'skipped') return EMPTY;
  return {
    overall_day: checkin.overall_day,
    energy: checkin.energy,
    stress: checkin.stress,
    sleep_quality: checkin.sleep_quality,
    nutrition_on_track: checkin.nutrition_on_track,
    activity: checkin.activity,
    note: checkin.note ?? '',
    tags: checkin.tags,
  };
}

const QUESTION_ICONS: Record<QuestionKey, IconName> = {
  energy: 'bolt',
  stress: 'brain',
  sleep_quality: 'moon',
  nutrition_on_track: 'fork-knife',
  activity: 'exercise-running',
};

function questionTint(key: QuestionKey, scale: NeonScale): string {
  switch (key) {
    case 'energy':
      return scale.yellow;
    case 'stress':
      return scale.violet;
    case 'sleep_quality':
      return scale.cyan;
    case 'nutrition_on_track':
      return scale.green;
    default:
      return scale.orange;
  }
}

const DailyCheckInScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const scale = useNeonScale();
  const [textSecondary, border] = useCSSVariable([
    '--color-text-secondary',
    '--color-border-subtle',
  ]) as [string, string];
  const [date, setDate] = useState(route.params?.date ?? getTodayDate());
  const { isConnected } = useServerConnection();
  const checkinQuery = useDailyCheckin(date, { enabled: isConnected });
  const contextQuery = useHealthContextPeriods({ enabled: isConnected });
  const { save, skip, reopen } = useSaveDailyCheckin(date);
  const checkin = checkinQuery.data;
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  // Navigation fires synchronously before React commits state/query updates.
  const saveIntent = useRef<'idle' | 'saving' | 'resolved'>('idle');
  const [customTag, setCustomTag] = useState('');
  const tagOptions = useCheckinTagOptions(checkin?.tags ?? EMPTY.tags);
  const [addingTag, setAddingTag] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Load the server state once per day; later refetches must not overwrite
  // answers the user is still editing.
  if (checkinQuery.isSuccess && loadedFor !== date) {
    setLoadedFor(date);
    setDraft(draftFrom(checkin));
    setDirty(false);
    dirtyRef.current = false;
    saveIntent.current = 'idle';
  }

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
    dirtyRef.current = true;
  }, []);

  const payload = useMemo(
    () => ({
      ...draft,
      note: draft.note.trim() ? draft.note.trim() : null,
      question_version: DAILY_CHECKIN_QUESTION_VERSION,
    }),
    [draft]
  );
  const canComplete = hasCheckinResponse(payload);

  // Leaving with unsaved answers keeps them as a draft, never as a completed
  // check-in. An empty draft is not stored.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (saveIntent.current === 'saving') {
          event.preventDefault();
          return;
        }
        if (saveIntent.current === 'resolved') return;
        if (dirtyRef.current && canComplete && checkin?.state !== 'completed') {
          dirtyRef.current = false;
          save.mutate({ ...payload, state: 'draft' });
        }
      }),
    [navigation, dirty, canComplete, checkin?.state, payload, save]
  );

  const changeDate = async (next: string) => {
    if (saveIntent.current === 'saving') return;
    saveIntent.current = 'saving';
    try {
      if (dirtyRef.current && canComplete && checkin?.state !== 'completed') {
        await save.mutateAsync({ ...payload, state: 'draft' });
      }
      dirtyRef.current = false;
      setDirty(false);
      setDate(next);
    } catch {
      saveIntent.current = 'idle';
      Toast.show({
        type: 'error',
        text1: t('checkin.saveFailed', {
          defaultValue: 'Could not save the check-in. Please try again.',
        }),
      });
    } finally {
      saveIntent.current = 'idle';
    }
  };

  const complete = async () => {
    if (!canComplete || saveIntent.current === 'saving') return;
    saveIntent.current = 'saving';
    try {
      await save.mutateAsync({ ...payload, state: 'completed' });
      saveIntent.current = 'resolved';
      dirtyRef.current = false;
      setDirty(false);
      Toast.show({
        type: 'success',
        text1: t('checkin.completedToast', {
          defaultValue: 'Check-in saved',
        }),
      });
      navigation.goBack();
    } catch {
      saveIntent.current = 'idle';
      Toast.show({
        type: 'error',
        text1: t('checkin.saveFailed', {
          defaultValue: 'Could not save the check-in. Please try again.',
        }),
      });
    }
  };

  const skipToday = async () => {
    if (saveIntent.current === 'saving') return;
    saveIntent.current = 'saving';
    try {
      await skip.mutateAsync();
      saveIntent.current = 'resolved';
      dirtyRef.current = false;
      setDraft(EMPTY);
      setDirty(false);
      navigation.goBack();
    } catch {
      saveIntent.current = 'idle';
      Toast.show({
        type: 'error',
        text1: t('checkin.skipFailed', {
          defaultValue: 'Could not skip the check-in. Please try again.',
        }),
      });
    }
  };

  const toggleTag = (tag: string) =>
    update({
      tags: draft.tags.includes(tag)
        ? draft.tags.filter((item) => item !== tag)
        : [...draft.tags, tag],
    });

  const addCustomTag = (text = customTag) => {
    const tag = text.trim();
    if (!tag) return;
    if (!tagOptions.canRemember) {
      Toast.show({
        type: 'error',
        text1: t('checkin.tagIdentityUnavailable', {
          defaultValue: 'Connect your account before creating a saved tag.',
        }),
      });
      return;
    }
    tagOptions.remember(tag);
    if (!draft.tags.includes(tag)) update({ tags: [...draft.tags, tag] });
    setCustomTag('');
    setAddingTag(false);
  };

  const tagLabel = (tag: string) =>
    isBuiltInCheckinTag(tag) ? checkinTagLabel(t, tag) : tag;

  const customTags = [
    ...new Set([
      ...tagOptions.tags,
      ...draft.tags.filter((tag) => !isBuiltInCheckinTag(tag)),
    ]),
  ];
  const activeContext = activeContextPeriods(contextQuery.data ?? [], date);
  const state = checkin?.state ?? null;

  if (!isConnected) {
    return (
      <TrackingScreen
        testID="daily-checkin"
        title={t('checkin.title', { defaultValue: 'Daily Check-In' })}
        subtitle={t('checkin.subtitle', {
          defaultValue: 'Reflect on your day in under 30 seconds.',
        })}
        onBack={navigation.goBack}
      >
        <StatusView
          icon="cloud-offline"
          iconTone="muted"
          title={t('checkin.offlineTitle', {
            defaultValue: 'Check-in needs your server',
          })}
          subtitle={t('checkin.offlineSubtitle', {
            defaultValue: 'Connect to your server to record a check-in.',
          })}
        />
      </TrackingScreen>
    );
  }

  const footer = (
    <View className="gap-2">
      <NeonButton
        testID="daily-checkin-complete"
        icon="checkmark-circle"
        label={
          state === 'completed'
            ? t('checkin.update', { defaultValue: 'Update Check-In' })
            : t('checkin.complete', { defaultValue: 'Complete Check-In' })
        }
        onPress={complete}
        disabled={!canComplete || checkinQuery.isLoading}
        loading={save.isPending}
        accessibilityHint={
          canComplete
            ? undefined
            : t('checkin.completeHint', {
                defaultValue:
                  'Answer at least one question, or add a note or tag.',
              })
        }
      />
      {state !== 'completed' ? (
        <NeonButton
          testID="daily-checkin-skip"
          variant="subtle"
          label={t('checkin.skip', { defaultValue: 'Skip for today' })}
          onPress={skipToday}
          loading={skip.isPending}
          disabled={state === 'skipped'}
        />
      ) : null}
    </View>
  );

  return (
    <TrackingScreen
      testID="daily-checkin"
      title={t('checkin.title', { defaultValue: 'Daily Check-In' })}
      subtitle={t('checkin.subtitle', {
        defaultValue: 'Reflect on your day in under 30 seconds.',
      })}
      date={date}
      onDateChange={changeDate}
      onBack={navigation.goBack}
      onRefresh={() => checkinQuery.refetch()}
      footer={footer}
    >
      {state === 'skipped' ? (
        <GlowCard className="mb-3 flex-row items-center gap-3 p-4">
          <Icon name="skip-forward" size={20} color={textSecondary} />
          <Text className="flex-1 text-sm text-text-secondary">
            {t('checkin.skippedNotice', {
              defaultValue:
                'You skipped this check-in. Answer below or reopen it to start again.',
            })}
          </Text>
          <Pressable
            testID="daily-checkin-reopen"
            accessibilityRole="button"
            onPress={() => {
              reopen.mutate();
              setLoadedFor(null);
            }}
            className="min-h-11 justify-center px-2"
          >
            <Text className="font-semibold text-text-link">
              {t('checkin.reopen', { defaultValue: 'Reopen' })}
            </Text>
          </Pressable>
        </GlowCard>
      ) : null}
      {state === 'completed' ? (
        <GlowCard
          glowColor={scale.green}
          className="mb-3 flex-row items-center gap-3 p-4"
          testID="daily-checkin-completed"
        >
          <Icon name="checkmark-circle" size={20} color={scale.green} />
          <Text className="flex-1 text-sm text-text-primary">
            {t('checkin.completedNotice', {
              defaultValue:
                'Check-in complete. You can still edit your answers.',
            })}
          </Text>
        </GlowCard>
      ) : null}

      {activeContext.length > 0 ? (
        <GlowCard
          glowColor={scale.cyan}
          className="mb-3 p-4"
          onPress={() => navigation.navigate('HealthContext')}
          accessibilityLabel={t('context.manageA11y', {
            defaultValue: 'Manage injury, illness and vacation periods',
          })}
          testID="daily-checkin-context"
        >
          <Text className="mb-1 text-xs font-semibold uppercase text-text-secondary">
            {t('context.activeTitle', { defaultValue: 'Current context' })}
          </Text>
          {activeContext.map((period) => (
            <Text key={period.id} className="text-sm text-text-primary">
              {contextKindLabel(t, period.kind)}
              {period.body_area ? ` · ${period.body_area}` : ''}
              {period.pause_discretionary_reminders
                ? ` · ${t('context.remindersPaused', {
                    defaultValue: 'optional reminders paused',
                  })}`
                : ''}
            </Text>
          ))}
        </GlowCard>
      ) : null}

      <GlowCard glowColor={scale.red} className="mb-3 p-4">
        <View className="mb-3 flex-row items-start gap-3">
          <Icon name="heart" size={26} color={scale.red} />
          <View className="flex-1">
            <Text
              accessibilityRole="header"
              className="text-lg font-semibold text-text-primary"
            >
              {t('checkin.overallTitle', {
                defaultValue: 'How was your day overall?',
              })}
            </Text>
            <Text className="text-sm text-text-secondary">
              {t('checkin.overallSubtitle', {
                defaultValue:
                  'Think about your whole day, from start to finish.',
              })}
            </Text>
          </View>
        </View>
        <View className="flex-row gap-2" accessibilityRole="radiogroup">
          {DAILY_CHECKIN_OVERALL_OPTIONS.map((option) => {
            const color = colorForShare(scale, (option.value - 1) / 4);
            const selected = draft.overall_day === option.value;
            const label = overallDayLabel(t, option.value);
            return (
              <Button
                variant={selected ? 'primary' : 'secondary'}
                color={color}
                key={option.value}
                testID={`daily-checkin-overall-${option.value}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={label}
                onPress={() =>
                  update({ overall_day: selected ? null : option.value })
                }
                className="flex-1 items-center gap-1 py-3"
              >
                <CheckinFace value={option.value} color={color} />
                <Text
                  className="text-center text-xs text-text-primary"
                  numberOfLines={2}
                  maxFontSizeMultiplier={1.3}
                >
                  {label}
                </Text>
              </Button>
            );
          })}
        </View>
      </GlowCard>

      <GlowCard glowColor={scale.green} className="mb-3 p-4">
        <View className="mb-1 flex-row items-start gap-3">
          <Icon name="chart-bar" size={24} color={textSecondary} />
          <View className="flex-1">
            <Text
              accessibilityRole="header"
              className="text-lg font-semibold text-text-primary"
            >
              {t('checkin.summaryTitle', { defaultValue: 'Day summary' })}
            </Text>
            <Text className="text-sm text-text-secondary">
              {t('checkin.summarySubtitle', {
                defaultValue: 'Optional. Tap again to clear an answer.',
              })}
            </Text>
          </View>
        </View>
        {DAILY_CHECKIN_QUESTIONS_V1.map((question, index) => {
          const value = draft[question.key];
          const tint = questionTint(question.key, scale);
          const text = checkinQuestionText(t, question.key);
          const title = text.title;
          return (
            <View
              key={question.key}
              className="gap-2 py-3"
              style={
                index > 0
                  ? { borderTopWidth: 1, borderTopColor: border }
                  : undefined
              }
            >
              <View className="flex-row items-center gap-3">
                <Icon
                  name={QUESTION_ICONS[question.key]}
                  size={24}
                  color={tint}
                />
                <View className="flex-1">
                  <Text className="text-base font-semibold text-text-primary">
                    {title}
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    {text.scale}
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-2" accessibilityRole="radiogroup">
                {[1, 2, 3, 4, 5].map((rating) => {
                  const color = colorForShare(
                    scale,
                    favourableShare(rating, question.polarity)
                  );
                  const selected = value === rating;
                  return (
                    <Button
                      variant={selected ? 'primary' : 'secondary'}
                      color={color}
                      key={rating}
                      testID={`daily-checkin-${question.key}-${rating}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={t('checkin.ratingA11y', {
                        defaultValue: '{{question}}: {{value}} of 5',
                        question: title,
                        value: rating,
                      })}
                      onPress={() =>
                        update({ [question.key]: selected ? null : rating })
                      }
                      className="min-h-11 flex-1 items-center justify-center py-1"
                    >
                      <Text className="text-base font-semibold text-text-primary">
                        {rating}
                      </Text>
                    </Button>
                  );
                })}
              </View>
            </View>
          );
        })}
      </GlowCard>

      <GlowCard glowColor={scale.mint} className="mb-3 p-4">
        <View className="mb-3 flex-row items-start gap-3">
          <Icon name="document-text" size={24} color={scale.mint} />
          <View className="flex-1">
            <Text
              accessibilityRole="header"
              className="text-lg font-semibold text-text-primary"
            >
              {t('checkin.noteTitle', {
                defaultValue: 'Anything worth noting?',
              })}{' '}
              <Text className="text-sm font-normal text-text-secondary">
                {t('common.optionalParen', { defaultValue: '(Optional)' })}
              </Text>
            </Text>
            <Text className="text-sm text-text-secondary">
              {t('checkin.noteSubtitle', {
                defaultValue:
                  'Highlights, challenges, or anything on your mind.',
              })}
            </Text>
          </View>
        </View>
        <TextInput
          testID="daily-checkin-note"
          value={draft.note}
          onChangeText={(note) => update({ note })}
          placeholder={t('checkin.notePlaceholder', {
            defaultValue: 'Write a quick note…',
          })}
          placeholderTextColor={textSecondary}
          multiline
          maxLength={2000}
          accessibilityLabel={t('checkin.noteTitle', {
            defaultValue: 'Anything worth noting?',
          })}
          className="mb-3 min-h-12 rounded-3xl border border-border-subtle bg-raised px-4 py-3 text-base text-text-primary"
        />
        <View className="flex-row flex-wrap gap-2">
          {[...DAILY_CHECKIN_BUILT_IN_TAGS, ...customTags].map((tag) => {
            const selected = draft.tags.includes(tag);
            return (
              <Button
                variant={selected ? 'primary' : 'secondary'}
                key={tag}
                testID={`daily-checkin-tag-${tag}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleTag(tag)}
                className="min-h-11 justify-center px-4"
              >
                <Text className="text-sm text-text-primary">
                  {tagLabel(tag)}
                </Text>
              </Button>
            );
          })}
          {addingTag ? (
            <TextInput
              testID="daily-checkin-custom-tag"
              value={customTag}
              onChangeText={setCustomTag}
              onEndEditing={(event) =>
                addCustomTag(event?.nativeEvent.text ?? customTag)
              }
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              maxLength={40}
              returnKeyType="done"
              placeholder={t('checkin.tagPlaceholder', {
                defaultValue: 'New tag',
              })}
              placeholderTextColor={textSecondary}
              className="min-h-11 min-w-28 rounded-full border border-border-subtle px-4 text-sm text-text-primary"
            />
          ) : (
            <Button
              variant={'secondary'}
              testID="daily-checkin-add-tag"
              accessibilityRole="button"
              onPress={() => setAddingTag(true)}
              className="min-h-11 flex-row items-center gap-1 px-4"
            >
              <Icon name="add" size={14} color={textSecondary} />
              <Text className="text-sm text-text-secondary">
                {t('checkin.addTag', { defaultValue: 'Add tag' })}
              </Text>
            </Button>
          )}
        </View>
      </GlowCard>
    </TrackingScreen>
  );
};

export default DailyCheckInScreen;
