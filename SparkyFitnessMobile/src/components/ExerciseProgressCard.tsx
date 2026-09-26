import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatLocalizedNumber } from '../localization';
import Icon from './Icon';
import DashboardSectionHeader from './DashboardSectionHeader';
import { View, Text, Pressable } from 'react-native';
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

interface ProgressBarProps {
  label: string;
  current: number;
  goal: number;
  unit: string;
  color: string;
  trackColor: string;
  opacity?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  current,
  goal,
  unit,
  color,
  trackColor,
  opacity = 1,
}) => {
  const [barWidth, setBarWidth] = useState(0);
  const barHeight = 8;
  const borderRadius = 4;
  const progress = goal > 0 ? current / goal : current > 0 ? 1 : 0;
  const showBar = goal > 0 || current > 0;

  const animatedProgress = useSharedValue(0);

  // Replay the 0 -> progress entrance animation while the screen is focused.
  // Driven by useIsFocused()+useEffect (rather than useFocusEffect) so the
  // shared-value write lives in a real effect that React's compiler can
  // optimize around.
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotion();
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

  return (
    <View>
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-sm font-semibold text-text-primary">{label}</Text>
        <Text className="text-sm text-text-primary">
          {goal > 0
            ? `${Math.round(current)} / ${Math.round(goal)} ${unit}`
            : `${Math.round(current)} ${unit}`}
        </Text>
      </View>
      {showBar && (
        <View
          className="h-3"
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
                opacity,
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
      )}
    </View>
  );
};

interface ExerciseProgressCardProps {
  compact?: boolean;
  onLog?: () => void;
  onDetails?: () => void;
  exerciseMinutes: number;
  exerciseMinutesGoal: number;
  exerciseCalories: number;
  exerciseCaloriesGoal: number;
}

const ExerciseProgressCard: React.FC<ExerciseProgressCardProps> = ({
  compact = false,
  onLog,
  onDetails,
  exerciseMinutes,
  exerciseMinutesGoal,
  exerciseCalories,
  exerciseCaloriesGoal,
}) => {
  const { t } = useTranslation();
  const [exerciseColor, trackColor, burnedColor] = useCSSVariable([
    '--color-exercise',
    '--color-progress-track',
    '--color-activity-energy',
  ]) as [string, string, string];

  const hasEntries = exerciseMinutes > 0 || exerciseCalories > 0;

  if (compact)
    return (
      <View className="bg-surface rounded-xl border border-border-subtle p-3 mb-3 w-full">
        <DashboardSectionHeader
          compact={compact}
          title={t('dashboard.exercise', { defaultValue: 'Exercise' })}
          icon="exercise-running"
          color={exerciseColor}
          onDetails={onDetails}
          testID="dashboard-exercise-details"
        />
        <View style={{ minHeight: 88 }}>
          <View className="flex-row items-center gap-2">
            <Icon name="clock" size={20} color={exerciseColor} />
            <Text className="text-xl font-bold text-text-primary flex-shrink">
              {formatLocalizedNumber(Math.round(exerciseMinutes))}
              <Text className="text-xs font-normal text-text-secondary">
                {exerciseMinutesGoal > 0
                  ? ` / ${formatLocalizedNumber(exerciseMinutesGoal)}`
                  : ''}{' '}
                {t('dashboard.minutesUnit', { defaultValue: 'min' })}
              </Text>
            </Text>
          </View>
          <View className="flex-row items-center gap-2 mt-1">
            <Icon name="exercise" size={20} color={burnedColor} />
            <Text className="text-sm text-text-secondary flex-shrink">
              {formatLocalizedNumber(Math.round(exerciseCalories))}
              {exerciseCaloriesGoal > 0
                ? ` / ${formatLocalizedNumber(exerciseCaloriesGoal)}`
                : ''}{' '}
              {t('dashboard.kcal', { defaultValue: 'kcal' })}
            </Text>
          </View>
          {!hasEntries && (
            <Text className="text-xs text-text-secondary mt-2">
              {t('dashboard.noExerciseEntries', {
                defaultValue: 'No exercise entries yet',
              })}
            </Text>
          )}
        </View>
        {onLog && (
          <Pressable
            accessibilityRole="button"
            onPress={onLog}
            className="min-h-11 mt-3 rounded-xl bg-accent-primary px-2 justify-center items-center"
          >
            <Text className="text-sm font-semibold text-accent-text text-center">
              {t('dashboard.logExercise', { defaultValue: 'Log exercise' })}
            </Text>
          </Pressable>
        )}
      </View>
    );

  return (
    <View className="bg-surface rounded-xl p-4 mb-3 shadow-sm">
      <DashboardSectionHeader
        compact={compact}
        title={t('dashboard.exercise', { defaultValue: 'Exercise' })}
        icon="exercise-running"
        color={exerciseColor}
        onDetails={onDetails}
        testID="dashboard-exercise-details"
      />
      {hasEntries ? (
        <>
          <ProgressBar
            label={t('dashboard.minutes', { defaultValue: 'Minutes' })}
            current={exerciseMinutes}
            goal={exerciseMinutesGoal}
            unit="min"
            color={exerciseColor}
            trackColor={trackColor}
            opacity={0.8}
          />
          <View className="h-3" />
          <ProgressBar
            label={t('dashboard.calories', { defaultValue: 'Calories' })}
            current={exerciseCalories}
            goal={exerciseCaloriesGoal}
            unit={t('nutrition.caloriesUnit', { defaultValue: 'Cal' })}
            color={exerciseColor}
            trackColor={trackColor}
            opacity={0.5}
          />
        </>
      ) : (
        <Text className="text-sm text-text-secondary text-center py-2">
          {t('dashboard.noExerciseEntries', {
            defaultValue: 'No exercise entries yet',
          })}
        </Text>
      )}
      {onLog && (
        <Pressable
          accessibilityRole="button"
          onPress={onLog}
          className="min-h-11 mt-3 rounded-xl bg-accent-primary px-2 justify-center items-center"
        >
          <Text className="text-sm font-semibold text-accent-text">
            {t('dashboard.logExercise', { defaultValue: 'Log exercise' })}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

export default ExerciseProgressCard;
