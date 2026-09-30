import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PanResponder,
  Text,
  TextInput,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import { withAlpha } from './ui/glow';
import { formatLocalizedNumber } from '../localization';
import { DECIMAL_INPUT_REGEX, parseDecimalInput } from '../utils/numericInput';
import { formatServingSizeDisplay } from '../utils/foodDetails';
import { fireSelectionHaptic } from '../services/haptics';

/** One value fills the field, like a text field. */
export const AMOUNT_WHEEL_HEIGHT = 56;
/** Vertical drag distance per step while spinning. */
const STEP_PX = 14;
/** Spacing of the neighbouring values shown while dragging. */
const ROW_PX = 30;
const LONG_PRESS_MS = 400;
const MOVE_SLOP = 6;

/**
 * The amount `delta` grid steps away from `value`. An off-grid value moves
 * to its neighbouring grid point first. The range runs from one step up to
 * the maximum, or up to the value itself when it is larger. Computed rather
 * than listed, so a very large amount costs nothing.
 */
export function stepAmount(
  value: number,
  delta: number,
  { step, max }: { step: number; max: number }
): number {
  if (!Number.isFinite(value) || value <= 0) value = step;
  if (delta === 0) return value;
  const position = value / step;
  const nearest = Math.round(position);
  const onGrid = Math.abs(position - nearest) < 1e-6;
  const base = onGrid
    ? nearest
    : delta > 0
      ? Math.floor(position)
      : Math.ceil(position);
  const next = Math.round((base + delta) * step * 1000) / 1000;
  return Math.min(Math.max(next, step), Math.max(max, value));
}

/** Grid of the wheel for a unit: 5 g/ml steps for weights, quarters otherwise. */
export function amountWheelScale(metric: boolean): {
  step: number;
  max: number;
} {
  return metric ? { step: 5, max: 1000 } : { step: 0.25, max: 20 };
}

export interface AmountWheelProps {
  value: number;
  onChange: (value: number) => void;
  metric: boolean;
  /** Spoken with the value, e.g. "grams" or "Medium pot". */
  unitLabel: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * A draggable spinner for the logged amount: drag up to increase and down to
 * decrease, one grid step per few points, with the neighbouring values
 * shown while dragging. A long press (or the VoiceOver "Enter amount"
 * action) switches to a number field for an exact amount.
 */
const AmountWheel: React.FC<AmountWheelProps> = ({
  value,
  onChange,
  metric,
  unitLabel,
  disabled = false,
  testID = 'food-entry-amount-wheel',
}) => {
  const { t } = useTranslation();
  const [accent, textMuted] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-muted',
  ]) as [string, string];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [dragging, setDragging] = useState(false);
  const [dragRemainder, setDragRemainder] = useState(0);

  const scale = amountWheelScale(metric);

  const startEditing = () => {
    if (disabled) return;
    setDraft(formatServingSizeDisplay(value));
    setEditing(true);
  };
  // Each valid keystroke is committed at once, so Add logs what is typed
  // even while the field still has focus.
  const changeDraft = (text: string) => {
    if (!DECIMAL_INPUT_REGEX.test(text)) return;
    setDraft(text);
    const parsed = parseDecimalInput(text);
    if (parsed > 0) onChange(Math.round(parsed * 100) / 100);
  };
  const finishEditing = () => setEditing(false);

  // The latest props for the gesture handlers, which are created once so a
  // drag is never cut off by a re-render. Updated after each render.
  const latest = useRef({ value, scale, onChange, startEditing, disabled });
  useEffect(() => {
    latest.current = { value, scale, onChange, startEditing, disabled };
  });
  const gesture = useRef({
    startValue: 0,
    appliedValue: 0,
    moved: false,
    timer: null as ReturnType<typeof setTimeout> | null,
  });

  // The handlers read the refs only while a gesture runs, never during
  // render; the compiler cannot see that through PanResponder.create.
  /* eslint-disable react-hooks/refs */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !latest.current.disabled,
        onMoveShouldSetPanResponder: (_, g) =>
          !latest.current.disabled && Math.abs(g.dy) > Math.abs(g.dx),
        // Keep the page from scrolling while the amount is being spun.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          const state = gesture.current;
          state.startValue = latest.current.value;
          state.appliedValue = latest.current.value;
          state.moved = false;
          state.timer = setTimeout(() => {
            state.timer = null;
            if (!state.moved) latest.current.startEditing();
          }, LONG_PRESS_MS);
        },
        onPanResponderMove: (_, g) => {
          const state = gesture.current;
          if (!state.moved && Math.abs(g.dy) < MOVE_SLOP) return;
          if (!state.moved) {
            state.moved = true;
            if (state.timer) clearTimeout(state.timer);
            state.timer = null;
            setDragging(true);
          }
          const { scale: grid, onChange: change } = latest.current;
          // Dragging up (negative dy) increases the amount.
          const delta = Math.trunc(-g.dy / STEP_PX);
          const next = stepAmount(state.startValue, delta, grid);
          setDragRemainder((-g.dy / STEP_PX - delta) * ROW_PX);
          if (Math.abs(next - state.appliedValue) > 1e-9) {
            state.appliedValue = next;
            fireSelectionHaptic();
            change(next);
          }
        },
        onPanResponderRelease: () => {
          const state = gesture.current;
          if (state.timer) clearTimeout(state.timer);
          state.timer = null;
          setDragging(false);
          setDragRemainder(0);
        },
        onPanResponderTerminate: () => {
          const state = gesture.current;
          if (state.timer) clearTimeout(state.timer);
          state.timer = null;
          setDragging(false);
          setDragRemainder(0);
        },
      }),
    []
  );
  /* eslint-enable react-hooks/refs */

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const name = event.nativeEvent.actionName;
    if (name === 'increment' || name === 'decrement') {
      const next = stepAmount(value, name === 'increment' ? 1 : -1, scale);
      if (Math.abs(next - value) > 1e-9) onChange(next);
    } else if (name === 'longpress' || name === 'activate') {
      startEditing();
    }
  };

  const fieldStyle = {
    flex: 0.66,
    height: AMOUNT_WHEEL_HEIGHT,
    borderColor: withAlpha(accent, dragging ? 1 : 0.7),
    backgroundColor: withAlpha(accent, dragging ? 0.1 : 0.05),
  };

  if (editing) {
    return (
      <TextInput
        testID="food-entry-amount-input"
        autoFocus
        value={draft}
        onChangeText={changeDraft}
        onBlur={finishEditing}
        onSubmitEditing={finishEditing}
        keyboardType="decimal-pad"
        returnKeyType="done"
        selectTextOnFocus
        accessibilityLabel={t('foodEntryAdd.labels.amount', {
          defaultValue: 'Amount',
        })}
        className="rounded-xl border bg-surface px-4 text-xl text-text-primary"
        style={{ ...fieldStyle, borderColor: accent }}
      />
    );
  }

  const formatted = formatLocalizedNumber(value, { maximumFractionDigits: 2 });
  // Neighbouring values while dragging; none past either end of the range.
  const neighbours = [-1, 0, 1].map((offset) => {
    const n = stepAmount(value, offset, scale);
    return {
      offset,
      value: offset !== 0 && Math.abs(n - value) < 1e-9 ? undefined : n,
    };
  });

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t('foodEntryAdd.labels.amount', {
        defaultValue: 'Amount',
      })}
      accessibilityValue={{ text: `${formatted} ${unitLabel}` }}
      accessibilityHint={t('foodEntryAdd.wheel.hint', {
        defaultValue:
          'Swipe up or down to change. Long press to type an amount.',
      })}
      accessibilityActions={[
        { name: 'increment' },
        { name: 'decrement' },
        {
          name: 'longpress',
          label: t('foodEntryAdd.wheel.enterAmount', {
            defaultValue: 'Enter amount',
          }),
        },
      ]}
      onAccessibilityAction={onAccessibilityAction}
      className="overflow-hidden rounded-xl border"
      style={fieldStyle}
      {...panResponder.panHandlers}
    >
      {neighbours.map(({ offset, value: n }) =>
        n === undefined || (!dragging && offset !== 0) ? null : (
          <View
            key={offset}
            pointerEvents="none"
            className="absolute left-0 right-8 justify-center pl-4"
            style={{
              top: 0,
              bottom: 0,
              transform: [{ translateY: offset * -ROW_PX + dragRemainder }],
              opacity: offset === 0 ? 1 : 0.35,
            }}
          >
            <Text
              className={
                offset === 0
                  ? 'text-xl font-semibold text-text-primary'
                  : 'text-base'
              }
              style={offset === 0 ? undefined : { color: textMuted }}
              numberOfLines={1}
            >
              {formatLocalizedNumber(n, { maximumFractionDigits: 2 })}
            </Text>
          </View>
        )
      )}
      {/* Spinner hint: drag up or down to change the amount. */}
      <View
        pointerEvents="none"
        className="absolute bottom-0 right-2 top-0 justify-center"
      >
        <Icon name="chevron-up" size={12} color={textMuted} />
        <Icon name="chevron-down" size={12} color={textMuted} />
      </View>
    </View>
  );
};

export default AmountWheel;
