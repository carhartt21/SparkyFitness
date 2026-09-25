import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { formatLocalizedNumber } from '../localization';
import {
  WATER_UNIT_LABELS,
  formatVolumeForUnit,
  volumeFromMl,
} from '../utils/unitConversions';
import Icon from './Icon';

interface ContainerOption {
  id: number;
  name: string;
}

interface QuickAddPreset extends ContainerOption {
  pressLabel?: string;
}

interface HydrationGaugeProps {
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
  const [hydrationColor, accentText] = useCSSVariable([
    '--color-hydration',
    '--color-accent-text',
  ]) as [string, string];
  const unitLabel = WATER_UNIT_LABELS[unit] ?? unit;
  const displayConsumed = formatVolumeForUnit(
    volumeFromMl(consumed, unit),
    unit
  );
  const displayGoal = formatVolumeForUnit(volumeFromMl(goal, unit), unit);
  const progress = goal > 0 ? Math.min(Math.max(consumed / goal, 0), 1) : null;
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

  return (
    <View className="bg-surface rounded-xl border border-border-subtle p-4 mb-3">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Icon name="water" size={20} color={hydrationColor} />
          <Text className="text-base font-semibold text-text-primary">
            {t('dashboard.hydration', { defaultValue: 'Hydration' })}
          </Text>
        </View>
        <Text className="text-xl font-bold text-text-primary">
          {displayConsumed} {unitLabel}
        </Text>
      </View>

      {progress != null ? (
        <>
          <View
            className="h-2 rounded-full bg-progress-track overflow-hidden"
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
                width: `${progress * 100}%` as `${number}%`,
                backgroundColor: hydrationColor,
              }}
            />
          </View>
          <Text className="text-sm text-text-secondary mt-2">
            {t('dashboard.ofVolume', {
              defaultValue: 'of {{value}} {{unit}}',
              value: displayGoal,
              unit: unitLabel,
            })}
          </Text>
        </>
      ) : (
        <Text className="text-sm text-text-secondary">
          {t('dashboard.noHydrationGoal', {
            defaultValue: 'No daily target set',
          })}
        </Text>
      )}

      {!!fromFoodMl && fromFoodMl > 0 ? (
        <Text className="text-xs text-text-secondary mt-1">
          {t('dashboard.waterFromFood', {
            defaultValue: 'Includes {{value}} {{unit}} from food',
            value: formatVolumeForUnit(volumeFromMl(fromFoodMl, unit), unit),
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
            value: formatVolumeForUnit(volumeFromMl(attentionMl, unit), unit),
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
      {(attentionMl > 0 || attentionContainerCount > 0) && onRetryAttention ? (
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

      {showButtons && !noContainer ? (
        <View className="flex-row items-center gap-2 mt-4">
          {onDecrement ? (
            <Pressable
              onPress={onDecrement}
              disabled={disableDecrement}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.removeWater', {
                defaultValue: 'Remove water',
              })}
              className={
                'h-11 w-11 rounded-xl border border-border-strong items-center justify-center ' +
                (disableDecrement ? 'opacity-40' : '')
              }
            >
              <Icon name="remove" size={20} color={hydrationColor} />
            </Pressable>
          ) : null}
          {onIncrement ? (
            <Pressable
              onPress={onIncrement}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.addWater', {
                defaultValue: 'Add water',
              })}
              className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-accent-primary px-3"
            >
              <Icon name="add" size={18} color={accentText} />
              <Text
                className="text-sm font-semibold text-accent-text"
                numberOfLines={1}
              >
                {pressLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : showButtons ? (
        <View className="mt-3">
          {onIncrement ? (
            <Pressable
              disabled
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.addWater', {
                defaultValue: 'Add water',
              })}
              className="min-h-11 items-center justify-center rounded-xl bg-raised border border-border-subtle opacity-50"
            >
              <Text className="text-sm font-semibold text-text-secondary">
                {t('dashboard.addWater', { defaultValue: 'Add water' })}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onConfigure}
            disabled={!onConfigure}
            className="min-h-11 justify-center"
          >
            <Text className="text-sm font-semibold text-accent-primary">
              {t('dashboard.chooseWaterContainer', {
                defaultValue:
                  'Choose a water container to enable quick add/remove',
              })}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {containers && containers.length > 0 ? (
        <View className="flex-row flex-wrap gap-2 mt-3">
          {containers.map((container) => {
            const active = container.id === activeContainerId;
            return (
              <Pressable
                key={container.id}
                onPress={() => onSelectContainer?.(container.id)}
                accessibilityRole="button"
                accessibilityLabel={t('dashboard.selectContainer', {
                  defaultValue: 'Select {{container}}',
                  container: container.name,
                })}
                accessibilityState={{ selected: active }}
                className={
                  'min-h-11 justify-center rounded-xl border px-3 ' +
                  (active
                    ? 'bg-accent-primary/15 border-accent-primary'
                    : 'bg-raised border-border-subtle')
                }
              >
                <Text
                  className={
                    'text-sm font-medium ' +
                    (active ? 'text-accent-primary' : 'text-text-primary')
                  }
                >
                  {container.name}
                </Text>
              </Pressable>
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
              <Pressable
                key={preset.id}
                onPress={() => onQuickAdd?.(preset.id)}
                disabled={!onQuickAdd}
                accessibilityRole="button"
                accessibilityLabel={t('dashboard.logDrink', {
                  defaultValue: 'Log {{drink}}',
                  drink: preset.name,
                })}
                className="min-h-11 flex-row items-center gap-2 rounded-xl border border-border-subtle bg-raised px-3"
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
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default HydrationGauge;
