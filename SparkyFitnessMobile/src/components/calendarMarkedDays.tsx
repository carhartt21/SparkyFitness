import React, { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { type CalendarDay } from 'react-native-ui-datepicker';
import type { DailyProgressDayState } from '@workspace/shared';
import { toLocalDateString } from '../utils/dateUtils';

export interface ProgressMarkColors {
  complete: string;
  partial: string;
  notStarted: string;
}

interface MarkedDayOptions {
  /** Calendar days (YYYY-MM-DD) to flag with a dot. */
  markedDates?: string[];
  /** Daily Progress state per day; unknown and "none" days get no mark. */
  progressStates?: Readonly<Record<string, DailyProgressDayState>>;
  progressColors?: ProgressMarkColors;
  /** Accessible wording for a day's progress state. */
  progressLabel?: (state: DailyProgressDayState) => string | null;
  textPrimary: string;
  textMuted: string;
  accentPrimary: string;
  accentText: string;
}

/**
 * A `Day` override for `react-native-ui-datepicker` that dots the given days,
 * ready to spread into the picker's `components` prop.
 *
 * Shared by the single-date and range sheets so a day carrying a photo looks
 * the same wherever it is picked from. Returns an empty object when there is
 * nothing to mark, which leaves the library's own day cell in place for every
 * caller that passes no dates.
 */
export function useMarkedDayComponent({
  markedDates,
  textPrimary,
  textMuted,
  accentPrimary,
  accentText,
  progressStates,
  progressColors,
  progressLabel,
}: MarkedDayOptions): { Day?: (day: CalendarDay) => React.ReactNode } {
  const markedSet = useMemo(() => new Set(markedDates ?? []), [markedDates]);
  const hasProgress =
    progressStates !== undefined && Object.keys(progressStates).length > 0;

  // The library keeps its own Pressable and container styling around an
  // overridden Day, so selection, today, range and disabled backgrounds still
  // come from each sheet's `styles` map; only the label is ours to draw.
  const renderMarkedDay = useCallback(
    (day: CalendarDay) => {
      // CalendarDay.date is declared `string` by the library but actually
      // arrives as its internal dayjs object, so it goes through the same
      // `new Date(...)` + toLocalDateString conversion the change handlers use.
      // That also keeps the comparison on the local calendar day rather than a
      // UTC instant, which would mark the wrong cell either side of midnight.
      const dayString = toLocalDateString(
        new Date(day.date as unknown as string | number | Date)
      );
      const marked = markedSet.has(dayString);
      const progress = progressStates?.[dayString];
      // Small marks sized for the cell: filled when complete, a ring when
      // partial or not started. Unknown and "nothing applies" stay blank.
      const progressMark =
        progress && progressColors
          ? progress === 'complete'
            ? { backgroundColor: progressColors.complete }
            : progress === 'partial'
              ? { borderWidth: 1.5, borderColor: progressColors.partial }
              : progress === 'not_started'
                ? { borderWidth: 1.5, borderColor: progressColors.notStarted }
                : null
          : null;
      const label = progress && progressLabel ? progressLabel(progress) : null;
      // Both ends of a range get the same solid accent fill a single selection
      // does, so the label and the dot have to invert there too or they vanish
      // into it.
      const onAccent = day.isSelected || day.rangeStart || day.rangeEnd;
      const selectedProgressMark =
        onAccent && progressMark
          ? progress === 'complete'
            ? { backgroundColor: accentText }
            : { borderWidth: 1.5, borderColor: accentText }
          : progressMark;
      return (
        <View
          style={{ alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel={label ? `${day.text}, ${label}` : undefined}
        >
          <Text
            style={{
              color: onAccent
                ? accentText
                : day.isDisabled
                  ? textMuted
                  : textPrimary,
            }}
          >
            {day.text}
          </Text>
          <View style={{ flexDirection: 'row', gap: 2, marginTop: 1 }}>
            {hasProgress ? (
              <View
                testID={`calendar-day-progress-${progress ?? 'unknown'}`}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  ...(selectedProgressMark ?? {}),
                }}
              />
            ) : null}
            <View
              testID={marked ? 'calendar-day-marked' : 'calendar-day-unmarked'}
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                marginTop: 1,
                backgroundColor: marked
                  ? onAccent
                    ? accentText
                    : accentPrimary
                  : 'transparent',
              }}
            />
          </View>
        </View>
      );
    },
    [
      markedSet,
      textPrimary,
      textMuted,
      accentPrimary,
      accentText,
      hasProgress,
      progressStates,
      progressColors,
      progressLabel,
    ]
  );

  return markedSet.size > 0 || hasProgress ? { Day: renderMarkedDay } : {};
}
