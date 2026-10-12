import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useCSSVariable } from 'uniwind';
import Button from './ui/Button';
import TimeWheel from './TimeWheel';
import { sheetContainer, useSheetBackdrop } from './ui/sheetChrome';
import { dateToTimeString, timeStringToDate } from '../utils/timePicker';
import type { EntryTimeFormat } from '../utils/entryTimeDisplay';

// Existing meal-form callers retain this formatting export.
export { dateToTimeString } from '../utils/timePicker';

export interface TimeSheetRef {
  present: (initialTime?: string) => void;
  dismiss: () => void;
}

interface TimeSheetProps {
  value: string; // '' or 'HH:MM'
  onSelectTime: (time: string) => void | boolean;
  minuteInterval?: 1 | 15;
  showNow?: boolean;
  getCurrentTime?: () => string;
  errorMessage?: string;
  timeFormat?: EntryTimeFormat | null;
  /**
   * 'change' (default) reports every wheel movement; 'done' reports only when
   * Done is pressed, for callers that validate the value and must not react to
   * intermediate positions mid-scroll.
   */
  commitOn?: 'change' | 'done';
}

const TimeSheet = forwardRef<TimeSheetRef, TimeSheetProps>(
  (
    {
      value,
      onSelectTime,
      commitOn = 'change',
      minuteInterval = 1,
      showNow = false,
      getCurrentTime,
      errorMessage,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [surfaceBg, textMuted] = useCSSVariable([
      '--color-surface',
      '--color-text-muted',
    ]) as [string, string];
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [displayed, setDisplayed] = useState('');
    const [session, setSession] = useState(0);
    useImperativeHandle(ref, () => ({
      present: (initialTime) => {
        setDisplayed(dateToTimeString(timeStringToDate(initialTime ?? value)));
        setSession((current) => current + 1);
        bottomSheetRef.current?.present();
      },
      dismiss: () => bottomSheetRef.current?.dismiss(),
    }));
    const renderBackdrop = useSheetBackdrop();
    const selectTime = useCallback(
      (time: string) => {
        setDisplayed(time);
        if (commitOn === 'change') onSelectTime(time);
      },
      [commitOn, onSelectTime]
    );
    const handleDone = () => {
      if (displayed && onSelectTime(displayed) === false) return;
      bottomSheetRef.current?.dismiss();
    };
    return (
      <BottomSheetModal
        accessible={false}
        ref={bottomSheetRef}
        enableDynamicSizing
        enableContentPanningGesture={false}
        backdropComponent={renderBackdrop}
        containerComponent={sheetContainer}
        backgroundStyle={{ backgroundColor: surfaceBg }}
        handleIndicatorStyle={{ backgroundColor: textMuted }}
      >
        <BottomSheetView className="bg-surface pb-safe-or-5 px-4">
          <TimeWheel
            key={session}
            value={displayed || value}
            onChange={selectTime}
            minuteInterval={minuteInterval}
          />
          <View className="pt-2 gap-2">
            {errorMessage ? (
              <Text
                accessibilityRole="alert"
                className="text-sm text-text-danger"
              >
                {errorMessage}
              </Text>
            ) : null}
            {showNow ? (
              <Button
                variant="secondary"
                onPress={() =>
                  selectTime(getCurrentTime?.() ?? dateToTimeString(new Date()))
                }
              >
                {t('timeSheet.now', { defaultValue: 'Now' })}
              </Button>
            ) : null}
            <Button variant="primary" onPress={handleDone}>
              {t('common.done', { defaultValue: 'Done' })}
            </Button>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
TimeSheet.displayName = 'TimeSheet';
export default TimeSheet;
