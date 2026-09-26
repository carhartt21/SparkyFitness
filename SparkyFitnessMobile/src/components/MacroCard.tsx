import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatLocalizedNumber } from '../localization';
import { View, Text, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { useCSSVariable } from 'uniwind';

interface MacroCardProps {
  label: string;
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
  const reducedMotion = useReducedMotion();
  const [barWidth, setBarWidth] = useState(0);
  const hasGoal = !!(goal && goal > 0);
  const progress = hasGoal ? consumed / (goal as number) : 0;
  const barHeight = compact ? 6 : 8;
  const borderRadius = compact ? 3 : 4;
  const [trackColor] = useCSSVariable(['--color-progress-track']) as [string];

  const animatedProgress = useSharedValue(0);

  // Replay the 0 -> progress entrance animation while the screen is focused.
  // Driven by useIsFocused()+useEffect (rather than useFocusEffect) so the
  // shared-value write lives in a real effect that React's compiler can
  // optimize around.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return;
    animatedProgress.value = 0;
    animatedProgress.value = withTiming(progress, {
      duration: reducedMotion ? 0 : 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFocused, progress, animatedProgress, reducedMotion]);

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

  if (row)
    return (
      <View
        className="w-full py-1"
        accessible
        accessibilityLabel={`${label}: ${formatLocalizedNumber(consumed)} ${unit}${hasGoal ? ` / ${formatLocalizedNumber(goal!)} ${unit}` : ''}`}
      >
        <View
          style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row' }}
          className="justify-between gap-1 mb-1"
        >
          <Text className="text-sm font-medium text-text-primary flex-shrink">
            {label}
          </Text>
          <Text className="text-xs text-text-secondary">
            {formatLocalizedNumber(Math.round(consumed))}
            {hasGoal
              ? ` / ${formatLocalizedNumber(Math.round(goal!))}`
              : ''}{' '}
            {unit}
          </Text>
        </View>
        {hasGoal && (
          <View className="flex-row items-center gap-3">
            <View
              className="flex-1 h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: trackColor }}
            >
              <View
                style={{
                  width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                  height: '100%',
                  backgroundColor: color,
                  borderRadius: 4,
                }}
              />
            </View>
            <Text
              className="text-xs text-text-secondary text-right"
              style={{ minWidth: 40 }}
            >
              {formatLocalizedNumber(Math.round(progress * 100))}%
            </Text>
          </View>
        )}
      </View>
    );

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
