import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import { withAlpha } from './ui/glow';
import { formatLocalizedNumber } from '../localization';
import { DECIMAL_INPUT_REGEX, parseDecimalInput } from '../utils/numericInput';
import { formatServingSizeDisplay } from '../utils/foodDetails';

/** One value fills the field, like a text field; swiping spins the value. */
export const AMOUNT_WHEEL_HEIGHT = 56;
export const AMOUNT_WHEEL_ROW_HEIGHT = AMOUNT_WHEEL_HEIGHT;

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
 * A vertical spinner for the logged amount. Scrolling snaps to the grid;
 * a long press (or the VoiceOver "Enter amount" action) switches to a
 * number field for an exact amount.
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
  const scrollRef = useRef<ScrollView>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  // The grid changes with the unit and when the value leaves it.
  const steps = useMemo(
    () => buildAmountSteps(value, amountWheelScale(metric)),
    [value, metric]
  );
  const index = Math.max(
    0,
    steps.findIndex((n) => Math.abs(n - value) < 1e-6)
  );

  // Keep the wheel on the value when it changes from outside (unit switch,
  // quick amount), without animating the first placement.
  const placedRef = useRef(false);
  useEffect(() => {
    if (editing) return;
    scrollRef.current?.scrollTo({
      y: index * AMOUNT_WHEEL_ROW_HEIGHT,
      animated: placedRef.current,
    });
    placedRef.current = true;
  }, [index, editing]);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.min(
      steps.length - 1,
      Math.max(
        0,
        Math.round(event.nativeEvent.contentOffset.y / AMOUNT_WHEEL_ROW_HEIGHT)
      )
    );
    if (steps[next] !== undefined && Math.abs(steps[next] - value) > 1e-6) {
      onChange(steps[next]);
    }
  };

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

  const formatted = formatLocalizedNumber(value, { maximumFractionDigits: 2 });

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
        className="rounded-xl border bg-surface px-4 text-2xl text-text-primary"
        style={{
          flex: 0.66,
          height: AMOUNT_WHEEL_HEIGHT,
          borderColor: accent,
        }}
      />
    );
  }

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
      style={{
        flex: 0.66,
        height: AMOUNT_WHEEL_HEIGHT,
        borderColor: withAlpha(accent, 0.7),
        backgroundColor: withAlpha(accent, 0.05),
      }}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={AMOUNT_WHEEL_ROW_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(event) => {
          // A drag released without momentum still has to settle.
          if (!event.nativeEvent.velocity?.y) settle(event);
        }}
      >
        {steps.map((n, rowIndex) => {
          const selected = rowIndex === index;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              onLongPress={startEditing}
              delayLongPress={350}
              style={{ height: AMOUNT_WHEEL_ROW_HEIGHT }}
              className="justify-center pl-4 pr-8"
              importantForAccessibility="no"
            >
              <Text
                className="text-2xl text-text-primary"
                style={selected ? undefined : { color: textMuted }}
                numberOfLines={1}
              >
                {formatLocalizedNumber(n, { maximumFractionDigits: 2 })}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* Spinner hint: swipe up or down to change the amount. */}
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
