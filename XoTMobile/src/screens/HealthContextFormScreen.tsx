import Button from '../components/ui/Button';
import React, { useRef, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HealthContextKind } from '@workspace/shared';
import TrackingScreen from '../components/tracking/TrackingScreen';
import { contextColor } from '../components/tracking/contextStyle';
import { contextKindLabel } from '../components/tracking/trackingLabels';
import { useNeonScale } from '../components/tracking/useNeonScale';
import GlowCard from '../components/ui/GlowCard';
import NeonButton from '../components/ui/NeonButton';
import Switch from '../components/ui/Switch';
import SegmentedControl from '../components/SegmentedControl';
import CalendarSheet, {
  type CalendarSheetRef,
} from '../components/CalendarSheet';
import Icon from '../components/Icon';
import {
  useHealthContextMutations,
  useHealthContextPeriods,
} from '../hooks/useDailyTracking';
import { useAppLocale } from '../localization';
import { formatDate, getTodayDate } from '../utils/dateUtils';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'HealthContextForm'>;

function DateField({
  label,
  value,
  onPress,
  testID,
}: {
  label: string;
  value: string;
  onPress: () => void;
  testID: string;
}) {
  const locale = useAppLocale();
  const secondary = useCSSVariable('--color-text-secondary') as string;
  return (
    <Button
      variant="secondary"
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      className="mb-3 min-h-12 flex-row items-center justify-between px-3"
    >
      <Text className="text-sm text-text-secondary">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Text className="text-base text-text-primary">
          {formatDate(value, locale)}
        </Text>
        <Icon name="calendar" size={16} color={secondary} />
      </View>
    </Button>
  );
}

const HealthContextFormScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const scale = useNeonScale();
  const secondary = useCSSVariable('--color-text-secondary') as string;
  const periodId = route.params?.periodId;
  const periodsQuery = useHealthContextPeriods({ enabled: Boolean(periodId) });
  const existing = periodId
    ? periodsQuery.data?.find((period) => period.id === periodId)
    : undefined;
  const { create, update, remove } = useHealthContextMutations();
  const startSheet = useRef<CalendarSheetRef>(null);
  const endSheet = useRef<CalendarSheetRef>(null);

  const [kind, setKind] = useState<HealthContextKind>('injury');
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [bodyArea, setBodyArea] = useState('');
  const [limitation, setLimitation] = useState('');
  const [pause, setPause] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Seed the form once when the period arrives.
  if (existing && !loaded) {
    setLoaded(true);
    setKind(existing.kind);
    setStartDate(existing.start_date);
    setEndDate(existing.end_date);
    setNote(existing.note ?? '');
    setBodyArea(existing.body_area ?? '');
    setLimitation(existing.limitation ?? '');
    setPause(existing.pause_discretionary_reminders);
  }

  const openStart = () => startSheet.current?.present();
  const openEnd = () => endSheet.current?.present();
  const rangeValid = endDate === null || endDate >= startDate;
  const injury = kind === 'injury';

  const submit = async () => {
    if (!rangeValid) return;
    const body = {
      kind,
      start_date: startDate,
      end_date: endDate,
      note: note.trim() || null,
      body_area: injury ? bodyArea.trim() || null : null,
      limitation: injury ? limitation.trim() || null : null,
      pause_discretionary_reminders: pause,
    };
    try {
      if (existing) await update.mutateAsync({ id: existing.id, body });
      else await create.mutateAsync(body);
      navigation.goBack();
    } catch {
      Toast.show({
        type: 'error',
        text1: t('context.saveFailed', {
          defaultValue: 'Could not save the period.',
        }),
      });
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(
      t('context.deleteTitle', { defaultValue: 'Delete this period?' }),
      t('context.deleteMessage', {
        defaultValue:
          'Only the context note is removed. Your records are not changed.',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            await remove.mutateAsync(existing.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const color = contextColor(kind, scale);
  const inputClass =
    'min-h-12 rounded-xl border border-border-subtle bg-raised px-3 text-base text-text-primary';
  return (
    <TrackingScreen
      testID="context-form"
      title={
        existing
          ? t('context.editTitle', { defaultValue: 'Edit period' })
          : t('context.newTitle', { defaultValue: 'New period' })
      }
      subtitle={t('context.formSubtitle', {
        defaultValue: 'You can backdate a period and overlap it with others.',
      })}
      onBack={navigation.goBack}
      footer={
        <NeonButton
          testID="context-save"
          icon="checkmark"
          label={t('common.save', { defaultValue: 'Save' })}
          onPress={submit}
          disabled={!rangeValid}
          loading={create.isPending || update.isPending}
        />
      }
    >
      <GlowCard glowColor={color} className="mb-3 p-4">
        <SegmentedControl
          segments={[
            { key: 'injury', label: contextKindLabel(t, 'injury') },
            { key: 'illness', label: contextKindLabel(t, 'illness') },
            { key: 'vacation', label: contextKindLabel(t, 'vacation') },
          ]}
          activeKey={kind}
          onSelect={(key) => setKind(key as HealthContextKind)}
        />
        <View className="mt-4">
          <DateField
            label={t('context.start', { defaultValue: 'Start' })}
            value={startDate}
            onPress={openStart}
            testID="context-start"
          />
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm text-text-primary">
              {t('context.ongoing', { defaultValue: 'Ongoing' })}
            </Text>
            <Switch
              testID="context-ongoing"
              value={endDate === null}
              onValueChange={(ongoing) =>
                setEndDate(
                  ongoing
                    ? null
                    : startDate > getTodayDate()
                      ? startDate
                      : getTodayDate()
                )
              }
            />
          </View>
          {endDate !== null ? (
            <DateField
              label={t('context.end', { defaultValue: 'End' })}
              value={endDate}
              onPress={openEnd}
              testID="context-end"
            />
          ) : null}
          {!rangeValid ? (
            <Text className="mb-2 text-sm text-text-danger">
              {t('context.rangeError', {
                defaultValue: 'The end date must not be before the start date.',
              })}
            </Text>
          ) : null}
        </View>
        {injury ? (
          <>
            <Text className="mb-1 text-sm font-semibold text-text-primary">
              {t('context.bodyArea', { defaultValue: 'Body area (optional)' })}
            </Text>
            <TextInput
              testID="context-body-area"
              value={bodyArea}
              onChangeText={setBodyArea}
              maxLength={100}
              placeholder={t('context.bodyAreaPlaceholder', {
                defaultValue: 'e.g. Left knee',
              })}
              placeholderTextColor={secondary}
              className={`${inputClass} mb-3`}
            />
            <Text className="mb-1 text-sm font-semibold text-text-primary">
              {t('context.limitation', {
                defaultValue: 'Limitation (optional)',
              })}
            </Text>
            <TextInput
              value={limitation}
              onChangeText={setLimitation}
              maxLength={500}
              placeholder={t('context.limitationPlaceholder', {
                defaultValue: 'e.g. No running or jumping',
              })}
              placeholderTextColor={secondary}
              className={`${inputClass} mb-3`}
            />
          </>
        ) : null}
        <Text className="mb-1 text-sm font-semibold text-text-primary">
          {t('context.note', { defaultValue: 'Note (optional)' })}
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          maxLength={2000}
          multiline
          placeholderTextColor={secondary}
          className={`${inputClass} py-3`}
        />
      </GlowCard>

      <GlowCard className="mb-3 p-4" testID="context-pause-card">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-text-primary">
              {t('context.pauseLabel', {
                defaultValue: 'Pause optional reminders',
              })}
            </Text>
          </View>
          <Switch
            testID="context-pause"
            value={pause}
            onValueChange={setPause}
          />
        </View>
        <Text
          className="mt-2 text-xs text-text-secondary"
          testID="context-pause-preview"
        >
          {pause
            ? t('context.pausePreviewOn', {
                defaultValue:
                  'While this period is active: hydration, meal photo, movement, check-in, habit and weigh-in reminders are paused. Medication and supplement reminders continue, and no schedule or missed day is changed.',
              })
            : t('context.pausePreviewOff', {
                defaultValue:
                  'Reminders continue as usual. Medication and supplement schedules are never changed.',
              })}
        </Text>
      </GlowCard>

      {existing && existing.end_date === null ? (
        <NeonButton
          variant="outline"
          icon="checkmark"
          label={t('context.endToday', { defaultValue: 'End today' })}
          onPress={() =>
            setEndDate(getTodayDate() < startDate ? startDate : getTodayDate())
          }
          className="mb-3"
        />
      ) : null}
      {existing ? (
        <NeonButton
          testID="context-delete"
          variant="outline"
          color={scale.red}
          icon="trash"
          label={t('context.delete', { defaultValue: 'Delete period' })}
          onPress={confirmDelete}
          className="mb-3"
        />
      ) : null}

      <CalendarSheet
        ref={startSheet}
        selectedDate={startDate}
        onSelectDate={setStartDate}
      />
      <CalendarSheet
        ref={endSheet}
        selectedDate={endDate ?? startDate}
        onSelectDate={setEndDate}
      />
    </TrackingScreen>
  );
};

export default HealthContextFormScreen;
