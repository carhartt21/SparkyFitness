import { useMemo, useState } from 'react';
import {
  Text,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import WheelPicker, { type PickerOption } from './ui/wheel-picker';
import { dateToTimeString, timeStringToDate } from '../utils/timePicker';

export interface TimeWheelProps {
  value: string | null | undefined;
  onChange: (time: string) => void;
  minuteInterval?: 1 | 15;
  testID?: string;
}
const pad = (value: number) => String(value).padStart(2, '0');
const hours: PickerOption[] = Array.from({ length: 24 }, (_, value) => ({
  value,
  text: pad(value),
}));

/** Full-width, 24-hour wheels with scalable rows and independent adjustable controls. */
export default function TimeWheel({
  value,
  onChange,
  minuteInterval = 1,
  testID,
}: TimeWheelProps) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const [textPrimary, borderSubtle] = useCSSVariable([
    '--color-text-primary',
    '--color-border-subtle',
  ]) as [string, string];
  // A blank value is seeded once, never changed by an unrelated parent render.
  const [seed] = useState(() =>
    dateToTimeString(timeStringToDate(value ?? ''))
  );
  const time = value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : seed;
  const [hour, minute] = time.split(':').map(Number);
  const [extraMinutes, setExtraMinutes] = useState<number[]>(() =>
    minute % minuteInterval ? [minute] : []
  );
  // Preserve exact off-grid initial/Now values alongside the quarter hours.
  // Keep visited values until this wheel closes, so selecting a quarter hour
  // never changes row positions halfway through its scroll gesture.
  if (minute % minuteInterval && !extraMinutes.includes(minute)) {
    setExtraMinutes([...extraMinutes, minute]);
  }
  const minutes = useMemo<PickerOption[]>(
    () =>
      [
        ...new Set([
          ...Array.from(
            { length: 60 / minuteInterval },
            (_, index) => index * minuteInterval
          ),
          ...extraMinutes,
        ]),
      ]
        .sort((a, b) => a - b)
        .map((value) => ({ value, text: pad(value) })),
    [minuteInterval, extraMinutes]
  );
  const itemHeight = Math.max(44, Math.ceil(28 * fontScale + 16));
  const visibleRest = fontScale > 1.25 ? 1 : 2;
  const textStyle = {
    color: textPrimary,
    fontSize: 28,
    fontWeight: '500' as const,
  };
  const indicatorStyle = { backgroundColor: borderSubtle, borderRadius: 10 };
  const column = (
    label: string,
    selected: number,
    options: PickerOption[],
    change: (next: number) => void
  ) => {
    const adjust = (event: AccessibilityActionEvent) => {
      const delta =
        event.nativeEvent.actionName === 'increment'
          ? 1
          : event.nativeEvent.actionName === 'decrement'
            ? -1
            : 0;
      if (!delta) return;
      const index = options.findIndex((option) => option.value === selected);
      const next =
        options[Math.max(0, Math.min(options.length - 1, index + delta))];
      if (next && next.value !== selected) change(Number(next.value));
    };
    return (
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text className="text-sm text-center font-semibold text-text-secondary mb-1">
          {label}
        </Text>
        <WheelPicker
          value={selected}
          options={options}
          onChange={(next) => change(Number(next))}
          itemHeight={itemHeight}
          visibleRest={visibleRest}
          itemTextStyle={textStyle}
          selectedIndicatorStyle={indicatorStyle}
          decelerationRate="fast"
          containerProps={{
            accessible: true,
            accessibilityRole: 'adjustable',
            accessibilityLabel: label,
            accessibilityValue: {
              min: Number(options[0].value),
              max: Number(options[options.length - 1].value),
              now: selected,
              text: pad(selected),
            },
            accessibilityActions: [
              { name: 'increment' },
              { name: 'decrement' },
            ],
            onAccessibilityAction: adjust,
          }}
          flatListProps={{
            accessibilityElementsHidden: true,
            importantForAccessibility: 'no-hide-descendants',
          }}
        />
      </View>
    );
  };
  return (
    <View testID={testID} style={{ width: '100%', alignSelf: 'stretch' }}>
      <View className="flex-row items-end gap-3">
        {column(
          t('timeSheet.hours', { defaultValue: 'Hours' }),
          hour,
          hours,
          (next) => onChange(`${pad(next)}:${pad(minute)}`)
        )}
        {column(
          t('timeSheet.minutes', { defaultValue: 'Minutes' }),
          minute,
          minutes,
          (next) => onChange(`${pad(hour)}:${pad(next)}`)
        )}
      </View>
    </View>
  );
}
