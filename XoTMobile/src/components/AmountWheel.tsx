import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TextInput,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
  /** Preserve typed drafts, including invalid ones, in the submission state. */
  onDraftChange?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  metric: boolean;
  /** Spoken with the value, e.g. "grams" or "Medium pot". */
  unitLabel: string;
  disabled?: boolean;
  fullWidth?: boolean;
  height?: number;
  testID?: string;
}

/**
 * Tap to enter an exact amount, or hold before dragging to spin it. Movement
 * before the hold completes belongs to the surrounding scroll view.
 */
const AmountWheel: React.FC<AmountWheelProps> = ({
  value,
  onChange,
  onDraftChange,
  onFocus,
  onBlur,
  metric,
  unitLabel,
  disabled = false,
  fullWidth = false,
  height = AMOUNT_WHEEL_HEIGHT,
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
    if (onDraftChange) onDraftChange(text);
    else if (Number.isFinite(parsed) && parsed > 0) onChange(parsed);
  };
  const finishEditing = () => {
    const parsed = parseDecimalInput(draft);
    // Keep invalid text visible so it can be corrected; never restore an old amount.
    if (Number.isFinite(parsed) && parsed > 0) setEditing(false);
  };

  // The latest props for the gesture handlers, which are created once so a
  // drag is never cut off by a re-render. Updated after each render.
  const latest = useRef({ value, scale, onChange, startEditing, disabled });
  useEffect(() => {
    latest.current = { value, scale, onChange, startEditing, disabled };
  });
  const gesture = useRef({
    startValue: 0,
    appliedValue: 0,
  });

  // Read the latest props only inside callbacks, never during render.
  const amountGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(!disabled)
      .activateAfterLongPress(LONG_PRESS_MS)
      .minDistance(MOVE_SLOP)
      .failOffsetX([-MOVE_SLOP, MOVE_SLOP])
      .runOnJS(true)
      .onStart(() => {
        const state = gesture.current;
        state.startValue = latest.current.value;
        state.appliedValue = latest.current.value;
        setDragging(true);
      })
      .onUpdate(({ translationY }) => {
        const state = gesture.current;
        const { scale: grid, onChange: change } = latest.current;
        // Dragging up (negative dy) increases the amount.
        const delta = Math.trunc(-translationY / STEP_PX);
        const next = stepAmount(state.startValue, delta, grid);
        setDragRemainder((-translationY / STEP_PX - delta) * ROW_PX);
        if (Math.abs(next - state.appliedValue) > 1e-9) {
          state.appliedValue = next;
          fireSelectionHaptic();
          change(next);
        }
      })
      .onFinalize(() => {
        setDragging(false);
        setDragRemainder(0);
      });
    const tap = Gesture.Tap()
      .enabled(!disabled)
      .maxDistance(MOVE_SLOP)
      .runOnJS(true)
      .onEnd((_, success) => {
        if (success) latest.current.startEditing();
      });
    return Gesture.Exclusive(pan, tap);
  }, [disabled]);

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (disabled) return;
    const name = event.nativeEvent.actionName;
    if (name === 'increment' || name === 'decrement') {
      const next = stepAmount(value, name === 'increment' ? 1 : -1, scale);
      if (Math.abs(next - value) > 1e-9) onChange(next);
    } else if (name === 'longpress' || name === 'activate') {
      startEditing();
    }
  };

  const fieldStyle = {
    flex: fullWidth ? undefined : 0.66,
    width: fullWidth ? ('100%' as const) : undefined,
    height,
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
        onFocus={onFocus}
        onBlur={() => {
          finishEditing();
          onBlur?.();
        }}
        onSubmitEditing={finishEditing}
        keyboardType="decimal-pad"
        // A numeric return key makes React Native inject a second iOS toolbar.
        // The screen already provides the localized Done/Add accessory.
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
    <GestureDetector gesture={amountGesture}>
      <View
        testID={testID}
        accessible
        accessibilityRole="adjustable"
        accessibilityState={{ disabled }}
        accessibilityLabel={t('foodEntryAdd.labels.amount', {
          defaultValue: 'Amount',
        })}
        accessibilityValue={{ text: `${formatted} ${unitLabel}` }}
        accessibilityHint={t('foodEntryAdd.wheel.hint', {
          defaultValue:
            'Tap to enter an amount. Hold, then drag up or down to change it.',
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
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {formatLocalizedNumber(n, { maximumFractionDigits: 2 })}
              </Text>
            </View>
          )
        )}
        {/* Hold before dragging so ordinary scrolling does not change the amount. */}
        <View
          pointerEvents="none"
          className="absolute bottom-0 right-2 top-0 justify-center"
        >
          <Icon name="chevron-up" size={12} color={textMuted} />
          <Icon name="chevron-down" size={12} color={textMuted} />
        </View>
      </View>
    </GestureDetector>
  );
};

export default AmountWheel;
