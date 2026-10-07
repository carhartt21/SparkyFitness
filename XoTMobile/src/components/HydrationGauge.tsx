import Button from './ui/Button';
import { useTweenedValue } from '../hooks/useTweenedValue';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { formatLocalizedNumber } from '../localization';
import {
  WATER_UNIT_LABELS,
  formatVolumeForUnit,
  volumeFromMl,
} from '../utils/unitConversions';
import Icon from './Icon';
import EnergyGauge from './EnergyGauge';
import DashboardSectionHeader from './DashboardSectionHeader';
import GlowCard from './ui/GlowCard';
import NeonButton from './ui/NeonButton';
import { useGlowTheme, withAlpha } from './ui/glow';
import ValueChangeFade from './ui/ValueChangeFade';

interface ContainerOption {
  id: number;
  name: string;
}

interface QuickAddPreset extends ContainerOption {
  pressLabel?: string;
}

/**
 * `daily` centers an open hydration arc above the shared logger. `full` retains the compact bar/cups. Compact clients may use `tile` (totals,
 * cups, log buttons) with an `options` card (sync state, containers, presets),
 * which renders nothing when there is nothing to show.
 */
type HydrationVariant = 'full' | 'daily' | 'tile' | 'options';

const CUP_COUNT = 5;

interface HydrationGaugeProps {
  variant?: HydrationVariant;
  compact?: boolean;
  onDetails?: () => void;
  consumed: number;
  goal: number;
  fromFoodMl?: number;
  pendingMl?: number;
  attentionMl?: number;
  pendingContainerCount?: number;
  attentionContainerCount?: number;
  pendingStorageError?: boolean;
  onRetryAttention?: () => void;
  retryingAttention?: boolean;
  unit?: string;
  containerVolume?: number | null;
  linkedPressLabel?: string;
  onConfigure?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  disableDecrement?: boolean;
  containers?: ContainerOption[];
  quickAddPresets?: QuickAddPreset[];
  onQuickAdd?: (id: number) => void;
  activeContainerId?: number;
  onSelectContainer?: (id: number) => void;
}

/** Compact hydration summary. Only explicit presses create or remove a drink. */
const HydrationGauge: React.FC<HydrationGaugeProps> = ({
  variant = 'full',
  compact = false,
  onDetails,
  consumed,
  goal,
  fromFoodMl,
  pendingMl = 0,
  attentionMl = 0,
  pendingContainerCount = 0,
  attentionContainerCount = 0,
  pendingStorageError = false,
  onRetryAttention,
  retryingAttention = false,
  unit = 'ml',
  containerVolume,
  linkedPressLabel,
  onConfigure,
  onIncrement,
  onDecrement,
  disableDecrement,
  containers,
  activeContainerId,
  onSelectContainer,
  quickAddPresets,
  onQuickAdd,
}) => {
  const { t } = useTranslation();
  const expandedText = useWindowDimensions().fontScale > 1.3;
  const daily = variant === 'daily';
  const glowing = useGlowTheme();
  const [hydrationColor, trackColor] = useCSSVariable([
    '--color-hydration',
    '--color-progress-track',
  ]) as [string, string];
  const showSummary = variant !== 'options';
  const showOptions = variant !== 'tile';
  const unitLabel = WATER_UNIT_LABELS[unit] ?? unit;
  const displayConsumed = formatVolumeForUnit(
    volumeFromMl(consumed, unit),
    unit
  );
  const displayGoal = formatVolumeForUnit(volumeFromMl(goal, unit), unit);
  const progress = goal > 0 ? Math.min(Math.max(consumed / goal, 0), 1) : null;
  // The bar eases after a logged drink, correction or deletion; the text
  // above always shows the exact recorded amount.
  const shownProgress = useTweenedValue(progress ?? 0);
  const noContainer = containerVolume == null && !linkedPressLabel;
  const showButtons = !!onIncrement || !!onDecrement;
  const pressLabel =
    containerVolume != null
      ? t('dashboard.perPress', {
          defaultValue: '{{value}} {{unit}}',
          value: formatLocalizedNumber(volumeFromMl(containerVolume, unit), {
            maximumFractionDigits: 1,
          }),
          unit: unitLabel,
        })
      : (linkedPressLabel ?? null);

  const hasOptionContent =
    (!!fromFoodMl && fromFoodMl > 0) ||
    pendingMl > 0 ||
    attentionMl > 0 ||
    pendingContainerCount > 0 ||
    attentionContainerCount > 0 ||
    pendingStorageError ||
    (!!containers &&
      containers.length > (compact || variant === 'options' ? 1 : 0)) ||
    (!!quickAddPresets && quickAddPresets.length > 0);
  if (variant === 'options' && !hasOptionContent) return null;

  return (
    <GlowCard
      glowColor={variant === 'options' ? undefined : hydrationColor}
      className={variant === 'tile' ? 'p-3 flex-1' : 'p-3 mb-3'}
      testID={`hydration-${variant}`}
    >
      {variant === 'options' ? (
        <Text className="text-sm font-semibold text-text-primary mb-1">
          {t('dashboard.drinks', { defaultValue: 'Drinks' })}
        </Text>
      ) : null}
      {showSummary ? (
        <>
          <DashboardSectionHeader
            compact={compact}
            title={
              daily
                ? t('hydrationDetails.daily', {
                    defaultValue: 'Daily hydration',
                  })
                : t('dashboard.hydration', { defaultValue: 'Hydration' })
            }
            icon="water"
            color={hydrationColor}
            onDetails={onDetails}
            testID="dashboard-hydration-details"
          />
          {daily ? (
            <View
              className="items-center py-3"
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t('dashboard.hydration', {
                defaultValue: 'Hydration',
              })}
              accessibilityValue={
                goal > 0
                  ? {
                      min: 0,
                      max: goal,
                      now: Math.min(Math.max(consumed, 0), goal),
                      text: `${displayConsumed} ${unitLabel}`,
                    }
                  : { text: `${displayConsumed} ${unitLabel}` }
              }
            >
              <View
                className="items-center justify-center"
                style={
                  expandedText ? { width: '100%' } : { width: 212, height: 212 }
                }
              >
                {!expandedText && (
                  <EnergyGauge
                    color={hydrationColor}
                    trackColor={trackColor}
                    size={212}
                    strokeWidth={15}
                    progress={progress ?? 0}
                  />
                )}
                <View
                  className="items-center gap-1"
                  style={
                    expandedText
                      ? { width: '100%' }
                      : { position: 'absolute', width: 156 }
                  }
                >
                  <Text className="text-center text-3xl font-bold text-text-primary">
                    {displayConsumed}
                  </Text>
                  <Text className="text-center text-base text-text-primary">
                    {unitLabel}
                  </Text>
                  <Text className="text-center text-xs text-text-secondary">
                    {progress == null
                      ? t('dashboard.noHydrationGoal', {
                          defaultValue: 'No daily target set',
                        })
                      : t('dashboard.ofVolume', {
                          defaultValue: 'of {{value}} {{unit}}',
                          value: displayGoal,
                          unit: unitLabel,
                        })}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={compact ? { minHeight: 92 } : undefined}>
              <Text
                className={`${variant === 'tile' ? 'text-2xl' : 'text-xl'} font-bold text-text-primary mb-2`}
              >
                {displayConsumed} {unitLabel}
              </Text>

              {progress != null ? (
                <>
                  <View className="flex-row items-center gap-2">
                    <View
                      className="h-2 flex-1 rounded-full bg-progress-track"
                      accessibilityRole="progressbar"
                      accessibilityLabel={t('dashboard.hydration', {
                        defaultValue: 'Hydration',
                      })}
                      accessibilityValue={{
                        min: 0,
                        max: goal,
                        now: Math.min(Math.max(consumed, 0), goal),
                      }}
                    >
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${shownProgress * 100}%` as `${number}%`,
                          backgroundColor: hydrationColor,
                          boxShadow: glowing
                            ? `0px 0px 8px 0px ${withAlpha(hydrationColor, 0.6)}`
                            : undefined,
                        }}
                      />
                    </View>
                    <Text className="text-xs text-text-secondary">
                      {formatLocalizedNumber(Math.round(progress * 100))}%
                    </Text>
                  </View>
                  <Text className="text-sm text-text-secondary mt-2">
                    {t('dashboard.ofVolume', {
                      defaultValue: 'of {{value}} {{unit}}',
                      value: displayGoal,
                      unit: unitLabel,
                    })}
                  </Text>
                  <View
                    className="mt-3 flex-row justify-between"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    {Array.from({ length: CUP_COUNT }, (_, index) => {
                      const filled = progress >= (index + 1) / CUP_COUNT - 1e-6;
                      return (
                        <ValueChangeFade
                          key={index}
                          changeKey={filled}
                          duration={200}
                          testID={
                            filled ? 'hydration-cup-filled' : 'hydration-cup'
                          }
                          className="h-8 w-6 rounded-b-md border-2 border-t-0 overflow-hidden justify-end"
                          style={{
                            borderColor: filled ? hydrationColor : trackColor,
                          }}
                        >
                          {filled ? (
                            <View
                              style={{
                                height: '72%',
                                backgroundColor: withAlpha(
                                  hydrationColor,
                                  0.85
                                ),
                              }}
                            />
                          ) : null}
                        </ValueChangeFade>
                      );
                    })}
                  </View>
                </>
              ) : (
                <Text className="text-sm text-text-secondary">
                  {t('dashboard.noHydrationGoal', {
                    defaultValue: 'No daily target set',
                  })}
                </Text>
              )}
            </View>
          )}

          {showButtons && !noContainer ? (
            <View className="flex-row items-center gap-2 mt-3">
              {onDecrement ? (
                <Pressable
                  onPress={onDecrement}
                  disabled={disableDecrement}
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.removeWater', {
                    defaultValue: 'Remove water',
                  })}
                  className={
                    'h-11 w-11 rounded-full border items-center justify-center ' +
                    (disableDecrement ? 'opacity-40' : '')
                  }
                  style={{ borderColor: withAlpha(hydrationColor, 0.6) }}
                >
                  <Icon name="remove" size={20} color={hydrationColor} />
                </Pressable>
              ) : null}
              {onIncrement ? (
                <NeonButton
                  variant="outline"
                  color={hydrationColor}
                  icon="add-circle"
                  size="sm"
                  className="flex-1"
                  label={pressLabel ?? ''}
                  accessibilityLabel={t('dashboard.addWater', {
                    defaultValue: 'Add water',
                  })}
                  onPress={onIncrement}
                />
              ) : null}
            </View>
          ) : showButtons ? (
            <View className="mt-3">
              {onIncrement ? (
                <Button
                  variant="secondary"
                  disabled
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.addWater', {
                    defaultValue: 'Add water',
                  })}
                  className="min-h-11 items-center justify-center opacity-50"
                >
                  <Text className="text-sm font-semibold text-text-secondary">
                    {t('dashboard.addWater', { defaultValue: 'Add water' })}
                  </Text>
                </Button>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={onConfigure}
                disabled={!onConfigure}
                className="min-h-11 justify-center"
              >
                <Text className="text-sm font-semibold text-text-primary">
                  {t('dashboard.chooseWaterContainer', {
                    defaultValue:
                      'Choose a water container to enable quick add/remove',
                  })}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
      {showOptions ? (
        <>
          {!!fromFoodMl && fromFoodMl > 0 ? (
            <Text className="text-xs text-text-secondary mt-1">
              {t('dashboard.waterFromFood', {
                defaultValue:
                  'Includes {{value}} {{unit}} from drinks and supplements',
                value: formatVolumeForUnit(
                  volumeFromMl(fromFoodMl, unit),
                  unit
                ),
                unit: unitLabel,
              })}
            </Text>
          ) : null}

          {pendingMl > 0 ? (
            <Text className="text-xs text-text-secondary mt-1">
              {t('dashboard.waterAwaitingSync', {
                defaultValue: '{{value}} {{unit}} awaiting sync',
                value: formatVolumeForUnit(volumeFromMl(pendingMl, unit), unit),
                unit: unitLabel,
              })}
            </Text>
          ) : null}
          {attentionMl > 0 ? (
            <Text className="text-xs text-text-danger mt-1">
              {t('dashboard.waterNeedsAttention', {
                defaultValue: '{{value}} {{unit}} needs attention',
                value: formatVolumeForUnit(
                  volumeFromMl(attentionMl, unit),
                  unit
                ),
                unit: unitLabel,
              })}
            </Text>
          ) : null}
          {pendingContainerCount > 0 ? (
            <Text className="text-xs text-text-secondary mt-1">
              {t('dashboard.waterDrinksAwaitingSync', {
                count: pendingContainerCount,
                defaultValue: '{{count}} drinks awaiting sync',
                defaultValue_one: '{{count}} drink awaiting sync',
              })}
            </Text>
          ) : null}
          {attentionContainerCount > 0 ? (
            <Text className="text-xs text-text-danger mt-1">
              {t('dashboard.waterDrinksNeedAttention', {
                count: attentionContainerCount,
                defaultValue: '{{count}} drinks need attention',
                defaultValue_one: '{{count}} drink needs attention',
              })}
            </Text>
          ) : null}
          {(attentionMl > 0 || attentionContainerCount > 0) &&
          onRetryAttention ? (
            <Pressable
              onPress={onRetryAttention}
              disabled={retryingAttention}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.retrySavedWater', {
                defaultValue: 'Retry saved water entries',
              })}
              className="min-h-11 self-start justify-center"
            >
              <Text className="text-sm font-semibold text-accent-primary">
                {retryingAttention
                  ? t('dashboard.retryingSavedWater', {
                      defaultValue: 'Retrying saved water…',
                    })
                  : t('dashboard.retrySavedWater', {
                      defaultValue: 'Retry saved water entries',
                    })}
              </Text>
            </Pressable>
          ) : null}
          {pendingStorageError ? (
            <Text className="text-xs text-text-danger mt-1">
              {t('dashboard.waterPendingUnavailable', {
                defaultValue: 'Pending water entries could not be read',
              })}
            </Text>
          ) : null}

          {containers &&
          containers.length > (compact || variant === 'options' ? 1 : 0) ? (
            <View className="flex-row flex-wrap gap-2 mt-3">
              {containers.map((container) => {
                const active = container.id === activeContainerId;
                return (
                  <Button
                    variant={active ? 'primary' : 'secondary'}
                    key={container.id}
                    onPress={() => onSelectContainer?.(container.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('dashboard.selectContainer', {
                      defaultValue: 'Select {{container}}',
                      container: container.name,
                    })}
                    accessibilityState={{ selected: active }}
                    className={
                      'min-h-11 justify-center   px-3 ' + (active ? ' ' : ' ')
                    }
                  >
                    <Text className="text-sm font-medium text-text-primary">
                      {container.name}
                    </Text>
                  </Button>
                );
              })}
            </View>
          ) : null}

          {quickAddPresets && quickAddPresets.length > 0 ? (
            <View className="mt-4 pt-3 border-t border-border-subtle">
              <Text className="text-xs font-semibold text-text-secondary mb-2">
                {t('dashboard.quickAddDrinks', { defaultValue: 'Quick add' })}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {quickAddPresets.map((preset) => (
                  <Button
                    variant="secondary"
                    key={preset.id}
                    onPress={() => onQuickAdd?.(preset.id)}
                    disabled={!onQuickAdd}
                    accessibilityRole="button"
                    accessibilityLabel={t('dashboard.logDrink', {
                      defaultValue: 'Log {{drink}}',
                      drink: preset.name,
                    })}
                    className="min-h-11 flex-row items-center gap-2 px-3"
                  >
                    <View>
                      <Text className="text-sm font-medium text-text-primary">
                        {preset.name}
                      </Text>
                      {preset.pressLabel ? (
                        <Text className="text-xs text-text-secondary">
                          {preset.pressLabel}
                        </Text>
                      ) : null}
                    </View>
                    <Icon name="add-circle" size={18} color={hydrationColor} />
                  </Button>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </GlowCard>
  );
};

export default HydrationGauge;
