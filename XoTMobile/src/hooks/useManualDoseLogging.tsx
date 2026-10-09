import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  utcToLocalDateTimeInput,
  type Medication,
  type MedicationEntry,
} from '@workspace/shared';
import TimeSheet, { type TimeSheetRef } from '../components/TimeSheet';
import { useLogDose } from './useMedications';
import { usePreferences } from './usePreferences';
import { getDeviceTimezone } from '../utils/dateUtils';
import { supplementIntakeTimestamp } from '../utils/supplementIntakeTime';
import type { DueDose } from '../utils/medications';
import Toast from 'react-native-toast-message';

type Intake =
  | { kind: 'scheduled'; dose: DueDose }
  | { kind: 'extra'; medication: Medication };

/** UI-only confirmation; the existing medication mutations and invalidation remain authoritative. */
export function useManualDoseLogging(
  date: string,
  entries?: MedicationEntry[]
) {
  const base = useLogDose(date, entries);
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const timezone = preferences?.timezone || getDeviceTimezone();
  const sheet = useRef<TimeSheetRef>(null);
  const pending = useRef<Intake | null>(null);
  const [error, setError] = useState(false);
  const currentTime = () =>
    utcToLocalDateTimeInput(new Date().toISOString(), timezone).slice(11, 16);
  const request = (intake: Intake) => {
    if (base.isPending) return;
    pending.current = intake;
    setError(false);
    sheet.current?.present(currentTime());
  };
  const logDose = (dose: DueDose, status: 'taken' | 'skipped') => {
    const existing = base.entryForDue(dose);
    if (
      status === 'taken' &&
      dose.medication.is_supplement &&
      existing?.status !== 'taken' &&
      existing?.status !== 'prn_taken'
    ) {
      request({ kind: 'scheduled', dose });
    } else base.logDose(dose, status);
  };
  const toggleTaken = (dose: DueDose) => {
    if (!dose.medication.is_supplement || base.entryForDue(dose))
      base.toggleTaken(dose);
    else logDose(dose, 'taken');
  };
  const logPrn = (medication: Medication) => {
    if (medication.is_supplement) request({ kind: 'extra', medication });
    else base.logPrn(medication);
  };
  const confirm = (time: string) => {
    const intake = pending.current;
    if (!intake || base.isPending) return false;
    const timestamp = supplementIntakeTimestamp(date, time, timezone);
    if (!timestamp) {
      setError(true);
      Toast.show({
        type: 'error',
        text1: t('supplements.intakeTime.invalid', {
          defaultValue: 'Choose a valid intake time that is not in the future.',
        }),
      });
      return false;
    }
    pending.current = null;
    if (intake.kind === 'scheduled')
      base.logDose(intake.dose, 'taken', timestamp);
    else base.logPrn(intake.medication, timestamp);
    return true;
  };
  return {
    ...base,
    logDose,
    toggleTaken,
    logPrn,
    timeSheet: (
      <TimeSheet
        ref={sheet}
        value=""
        onSelectTime={confirm}
        timeFormat="HH:mm"
        minuteInterval={15}
        showNow
        getCurrentTime={currentTime}
        commitOn="done"
        errorMessage={
          error
            ? t('supplements.intakeTime.invalid', {
                defaultValue:
                  'Choose a valid intake time that is not in the future.',
              })
            : undefined
        }
      />
    ),
  };
}
