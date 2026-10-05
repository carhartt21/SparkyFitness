import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  localDateTimeToUtc,
  type Medication,
  type MedicationEntry,
} from '@workspace/shared';
import BottomSheetPicker, { PickerTrigger } from './BottomSheetPicker';
import FormInput from './FormInput';
import TimeSheet, { dateToTimeString, type TimeSheetRef } from './TimeSheet';
import NeonButton from './ui/NeonButton';
import {
  useCreateMedicationEntry,
  useDeleteMedicationEntry,
} from '../hooks/useMedications';
import { getDeviceTimezone, getTodayDate } from '../utils/dateUtils';
import { parseDecimalInput } from '../utils/numericInput';
import { formatLocalizedNumber } from '../localization';

/** Explicit extra intake; PRN attribution never resolves a scheduled dose slot. */
export default function AdditionalSupplementIntake({
  supplements,
  entries,
  date,
}: {
  supplements: Medication[];
  entries: MedicationEntry[];
  date: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState('');
  const [amount, setAmount] = useState('');
  const [time, setTime] = useState(() => dateToTimeString(new Date()));
  const [error, setError] = useState(false);
  const saveInFlight = useRef(false);
  const timeRef = useRef<TimeSheetRef>(null);
  const creating = useCreateMedicationEntry();
  const removing = useDeleteMedicationEntry();
  const supplement = supplements.find((item) => item.id === id);
  const quantity = parseDecimalInput(amount);
  const unit = supplement?.dose_unit ?? '';
  const extra = entries.filter(
    (entry) =>
      entry.status === 'prn_taken' &&
      !entry.schedule_id &&
      supplements.some((item) => item.id === entry.medication_id)
  );
  const busy = creating.isPending || removing.isPending;
  const save = async () => {
    if (
      !supplement ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      busy ||
      saveInFlight.current ||
      date > getTodayDate()
    )
      return;
    const takenAt = localDateTimeToUtc(`${date}T${time}`, getDeviceTimezone());
    if (!Number.isFinite(takenAt.getTime()) || takenAt.getTime() > Date.now()) {
      setError(true);
      return;
    }
    saveInFlight.current = true;
    setError(false);
    try {
      await creating.mutateAsync({
        medication_id: supplement.id,
        schedule_id: null,
        status: 'prn_taken',
        entry_date: date,
        taken_at: takenAt.toISOString(),
        dose_amount_snapshot: quantity,
        dose_unit_snapshot: unit || null,
        source: 'manual',
      });
      setOpen(false);
      setAmount('');
    } catch {
      setError(true);
    } finally {
      saveInFlight.current = false;
    }
  };
  return (
    <View className="mb-3 gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
      <NeonButton
        testID="supplements-log-extra"
        icon="add"
        variant="subtle"
        className="rounded-xl"
        label={t('supplements.extra.add', { defaultValue: 'Log extra intake' })}
        disabled={busy || date > getTodayDate()}
        onPress={() => {
          setOpen(!open);
          setError(false);
        }}
      />
      {open && (
        <View className="gap-3" testID="supplements-extra-form">
          <Text className="text-sm text-text-secondary">
            {t('supplements.extra.hint', {
              defaultValue:
                'Record an additional intake. Your schedule and planned doses stay unchanged.',
            })}
          </Text>
          <BottomSheetPicker
            value={id}
            options={supplements.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            placeholder={t('supplements.extra.select', {
              defaultValue: 'Choose supplement',
            })}
            title={t('supplements.extra.select', {
              defaultValue: 'Choose supplement',
            })}
            onSelect={(next) => {
              setId(next);
              const med = supplements.find((item) => item.id === next);
              setAmount(
                med?.dose_amount != null ? String(med.dose_amount) : ''
              );
            }}
          />
          <Text className="text-sm text-text-secondary">
            {t('supplements.extra.amount', { defaultValue: 'Amount taken' })}
            {unit ? ` · ${unit}` : ''}
          </Text>
          <FormInput
            testID="supplements-extra-amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            accessibilityLabel={t('supplements.extra.amount', {
              defaultValue: 'Amount taken',
            })}
          />
          <PickerTrigger
            label={time}
            onPress={() => timeRef.current?.present()}
            accessibilityLabel={t('supplements.extra.time', {
              defaultValue: 'Intake time',
            })}
          />
          <NeonButton
            testID="supplements-extra-save"
            className="rounded-xl"
            loading={creating.isPending}
            disabled={
              !supplement || !Number.isFinite(quantity) || quantity <= 0 || busy
            }
            label={t('common.save', { defaultValue: 'Save' })}
            onPress={() => void save()}
          />
          <TimeSheet
            ref={timeRef}
            value={time}
            onSelectTime={setTime}
            timeFormat="HH:mm"
            commitOn="done"
          />
        </View>
      )}
      {error && (
        <Text accessibilityRole="alert" className="text-sm text-text-danger">
          {t('supplements.extra.error', {
            defaultValue: 'Could not save the intake. Please try again.',
          })}
        </Text>
      )}
      {extra.map((entry) => (
        <View
          key={entry.id}
          className="flex-row items-center gap-3 border-t border-border-subtle pt-3"
        >
          <View className="min-w-0 flex-1">
            <Text className="text-base font-medium text-text-primary">
              {entry.med_name_snapshot ??
                supplements.find((item) => item.id === entry.medication_id)
                  ?.name}
            </Text>
            <Text className="text-sm text-text-secondary">
              {entry.dose_amount_snapshot == null
                ? '—'
                : formatLocalizedNumber(entry.dose_amount_snapshot)}{' '}
              {entry.dose_unit_snapshot ?? ''}
            </Text>
          </View>
          <NeonButton
            variant="subtle"
            size="sm"
            className="rounded-xl"
            disabled={busy}
            label={t('wellness.undo', { defaultValue: 'Undo' })}
            onPress={() => {
              setError(false);
              removing.mutate(entry.id, { onError: () => setError(true) });
            }}
          />
        </View>
      ))}
    </View>
  );
}
