import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatLocalizedNumber } from '../localization';
import { View, Text, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useMotionPreferences } from '../hooks/useMotionPreferences';
import { useCSSVariable, useUniwind } from 'uniwind';

interface MacroCardProps {
  label: string;
  compactLabel?: string;
  consumed: number;
  goal?: number;
  color: string;
  overfillColor: string;
  unit?: string;
  /** Shrinks label/value text and the bar height for use in denser layouts (e.g. a 3-up row). */
  compact?: boolean;
  row?: boolean;
  /** Overrides the default 2-column `w-[48%]` container width. */
  widthClassName?: string;
}

const MacroCard: React.FC<MacroCardProps> = ({
  label,
  compactLabel,
  consumed,
  goal,
  color,
  overfillColor,
  unit = 'g',
  compact = false,
  row = false,
  widthClassName = 'w-[48%]',
}) => {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const { active, reducedMotion } = useMotionPreferences();
  const { theme } = useUniwind();
  const dark = theme === 'dark' || theme === 'amoled';
  const [barWidth, setBarWidth] = useState(0);
  const hasGoal = !!(goal && goal > 0);
  const progress = hasGoal ? consumed / (goal as number) : 0;
  const barHeight = compact ? 6 : 8;
  const borderRadius = compact ? 3 : 4;
  const [trackColor] = useCSSVariable(['--color-progress-track']) as [string];

  const animatedProgress = useSharedValue(progress);
  const previousProgress = useRef(progress);

  // Reanimated retargets from the current presentation value. Never reset to
  // zero on navigation or replay a value already shown during reconciliation.
  useEffect(() => {
    const changed = previousProgress.current !== progress;
    previousProgress.current = progress;
    if (!active || reducedMotion) {
      animatedProgress.value = progress;
    } else if (changed) {
      animatedProgress.value = withTiming(progress, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    }
    return () => cancelAnimation(animatedProgress);
  }, [active, progress, animatedProgress, reducedMotion]);

  const rowFillStyle = useAnimatedStyle(() => ({
    width:
      `${Math.min(100, Math.max(0, animatedProgress.value * 100))}%` as `${number}%`,
  }));

  const fillWidth = useDerivedValue(() => {
    const p = animatedProgress.value;
    if (p <= 0 || barWidth <= 0) return 0;
    return p > 1 ? barWidth / p : barWidth * p;
  }, [barWidth]);

  const overflowX = useDerivedValue(() => {
    const p = animatedProgress.value;
    if (p <= 1 || barWidth <= 0) return barWidth;
    return barWidth / p + 2;
  }, [barWidth]);

  const overflowWidth = useDerivedValue(() => {
    const p = animatedProgress.value;
    if (p <= 1 || barWidth <= 0) return 0;
    const gapStart = barWidth / p + 2;
    return Math.max(0, barWidth - gapStart);
  }, [barWidth]);

  const fillStyle = useAnimatedStyle(() => ({
    width: fillWidth.value,
  }));

  const overflowStyle = useAnimatedStyle(() => ({
    left: overflowX.value,
    width: overflowWidth.value,
  }));

  if (row) {
    // Reference layout: name and amount on one line, a slim glowing bar with
    // its percentage underneath. Missing goals omit bar and percentage.
    const amount = `${formatLocalizedNumber(Math.round(consumed))}${hasGoal ? ` / ${formatLocalizedNumber(Math.round(goal!))}` : ''} ${unit}`;
    return (
      <View
        className="w-full py-1.5"
        accessible
        accessibilityLabel={`${label}: ${formatLocalizedNumber(consumed)} ${unit}${hasGoal ? ` / ${formatLocalizedNumber(goal!)} ${unit}` : ''}`}
      >
        <View
          className="gap-x-2"
          style={{
            flexDirection: fontScale > 1.3 ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: fontScale > 1.3 ? 'flex-start' : 'baseline',
          }}
        >
          <Text
            className="text-[13px] font-medium text-text-primary"
            maxFontSizeMultiplier={1.8}
          >
            {compactLabel ?? label}
          </Text>
          <Text
            className="text-[13px] font-semibold text-text-primary"
            maxFontSizeMultiplier={1.8}
          >
            {amount}
          </Text>
        </View>
        {hasGoal && (
          <View className="mt-1.5 flex-row items-center gap-2">
            <View
              className="h-2 flex-1 rounded-full"
              style={{ backgroundColor: trackColor }}
            >
              <Animated.View
                testID="macro-row-fill"
                style={[
                  {
                    height: '100%',
                    backgroundColor: color,
                    borderRadius: 4,
                    boxShadow: dark ? `0px 0px 8px 0px ${color}99` : undefined,
                  },
                  rowFillStyle,
                ]}
              />
            </View>
            <Text
              className="text-[11px] text-text-secondary"
              maxFontSizeMultiplier={1.8}
              style={{ minWidth: 30, textAlign: 'right' }}
            >
              {formatLocalizedNumber(Math.round(progress * 100))}%
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View className={`${widthClassName} p-1`}>
      <View className="flex-row justify-between items-center mb-2">
        <Text
          className={
            compact
              ? 'text-xs font-medium text-text-primary'
              : 'text-sm font-medium text-text-primary'
          }
        >
          {label}
        </Text>
        <Text
          className={
            compact
              ? 'text-[11px] text-text-secondary'
              : 'text-xs text-text-secondary'
          }
        >
          {goal && goal > 0
            ? `${Math.round(consumed)}${unit} / ${Math.round(goal)}${unit}`
            : `${Math.round(consumed)}${unit}`}
        </Text>
      </View>
      {hasGoal && (
        <>
          <View
            className="h-2"
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          >
            {barWidth > 0 && (
              <View
                style={{
                  width: barWidth,
                  height: barHeight,
                  borderRadius,
                  overflow: 'hidden',
                  backgroundColor: trackColor,
                }}
              >
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: barHeight,
                      backgroundColor: color,
                    },
                    fillStyle,
                  ]}
                />
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      top: 0,
                      height: barHeight,
                      backgroundColor: color,
                      opacity: 0.65,
                    },
                    overflowStyle,
                  ]}
                />
              </View>
            )}
          </View>
          {barWidth > 0 && (
            <Text className="text-[10px] text-text-muted mt-1">
              {Math.round(progress * 100)}% ·{' '}
              {(() => {
                const diff = goal - consumed;
                return diff > 0
                  ? t('dashboard.nutrientRemaining', {
                      defaultValue: '{{value}} {{unit}} left',
                      value: formatLocalizedNumber(Math.round(diff)),
                      unit,
                    })
                  : diff < 0
                    ? t('dashboard.nutrientOver', {
                        defaultValue: '{{value}} {{unit}} over',
                        value: formatLocalizedNumber(
                          Math.round(Math.abs(diff))
                        ),
                        unit,
                      })
                    : t('dashboard.nutrientMet', {
                        defaultValue: 'Target reached',
                      });
              })()}
            </Text>
          )}
        </>
      )}
    </View>
  );
};

export default MacroCard;
