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

/** Wheel values: a regular grid, plus the current value when it is off-grid. */
export function buildAmountSteps(
  value: number,
  { step, max }: { step: number; max: number }
): number[] {
  const limit = Math.max(max, Number.isFinite(value) ? value : 0);
  const steps: number[] = [];
  for (let n = step; n <= limit + 1e-9; n += step) {
    steps.push(Math.round(n * 1000) / 1000);
  }
  if (value > 0 && !steps.some((n) => Math.abs(n - value) < 1e-6)) {
    steps.push(value);
    steps.sort((a, b) => a - b);
  }
  return steps;
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

  const steps = useMemo(
    () => buildAmountSteps(value, amountWheelScale(metric)),
    [value, metric]
  );
  const index = Math.max(
    0,
    steps.findIndex((n) => Math.abs(n - value) < 1e-6)
  );

  const startEditing = () => {
    if (disabled) return;
    setDraft(formatServingSizeDisplay(value));
    setEditing(true);
  };
  const finishEditing = () => {
    const parsed = parseDecimalInput(draft);
    if (parsed > 0) onChange(Math.round(parsed * 100) / 100);
    setEditing(false);
  };

  // The latest props for the gesture handlers, which are created once so a
  // drag is never cut off by a re-render. Updated after each render.
  const latest = useRef({ steps, index, onChange, startEditing, disabled });
  useEffect(() => {
    latest.current = { steps, index, onChange, startEditing, disabled };
  });
  const gesture = useRef({
    startIndex: 0,
    appliedIndex: 0,
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
          state.startIndex = latest.current.index;
          state.appliedIndex = latest.current.index;
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
          const { steps: grid, onChange: change } = latest.current;
          // Dragging up (negative dy) increases the amount.
          const delta = Math.trunc(-g.dy / STEP_PX);
          const next = Math.min(
            grid.length - 1,
            Math.max(0, state.startIndex + delta)
          );
          setDragRemainder((-g.dy / STEP_PX - delta) * ROW_PX);
          if (next !== state.appliedIndex && grid[next] !== undefined) {
            state.appliedIndex = next;
            fireSelectionHaptic();
            change(grid[next]);
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
    if (name === 'increment' && index < steps.length - 1) {
      onChange(steps[index + 1]);
    } else if (name === 'decrement' && index > 0) {
      onChange(steps[index - 1]);
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
        onChangeText={(text) => {
          if (DECIMAL_INPUT_REGEX.test(text)) setDraft(text);
        }}
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
  const neighbours = [-1, 0, 1].map((offset) => ({
    offset,
    value: steps[index + offset],
  }));

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
