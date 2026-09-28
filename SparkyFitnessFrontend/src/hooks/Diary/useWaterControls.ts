import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/contexts/PreferencesContext';
import { convertMlToSelectedUnit } from '@/utils/nutritionCalculations';
import { useWaterContainer } from '@/contexts/WaterContainerContext';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import {
  useWaterGoalQuery,
  useWaterIntakeQuery,
  useManualWaterIntakeQuery,
  useFoodWaterIntakeQuery,
  useUpdateWaterIntakeMutation,
  useWaterIntakeLogQuery,
  useDeleteWaterIntakeLogMutation,
  useUpdateWaterIntakeLogTimeMutation,
} from '@/hooks/Diary/useWaterIntake';

/**
 * Water totals, container selection and logging for one day. Shared by the
 * Diary water widget and the Dashboard hydration card so both credit a press
 * exactly the same way (#2115 volume precedence lives in one place).
 */
export function useWaterControls(selectedDate: string) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeUserId } = useActiveUser(); // Get activeUserId
  const { activeContainer, standardContainers, quickAddPresets } =
    useWaterContainer();
  const { water_display_unit } = usePreferences();
  const userId = activeUserId || user?.id;
  const { data: waterGoalMl } = useWaterGoalQuery(selectedDate, userId);
  const { data: waterMl = 0 } = useWaterIntakeQuery(selectedDate, userId);
  // Only manually logged water can be removed here; provider-synced water is
  // owned by its provider and would just reappear on the next sync.
  const { data: manualWaterMl = 0 } = useManualWaterIntakeQuery(
    selectedDate,
    userId
  );
  const { data: foodWaterMl = 0 } = useFoodWaterIntakeQuery(
    selectedDate,
    userId
  );
  const { mutate: updateWaterIntake, isPending: loading } =
    useUpdateWaterIntakeMutation();
  const { data: logEntries = [] } = useWaterIntakeLogQuery(
    selectedDate,
    userId
  );
  const { mutate: deleteLogEntry, isPending: deleting } =
    useDeleteWaterIntakeLogMutation();
  const { mutate: updateLogTime } = useUpdateWaterIntakeLogTimeMutation();

  // Local state for the selected container in the diary
  const [selectedContainerId, setSelectedContainerId] = useState<number | null>(
    () => activeContainer?.id ?? null
  );

  // Derived selected container from standard containers only
  const currentContainer =
    standardContainers.find((c) => c.id === selectedContainerId) ||
    activeContainer;

  const cycleContainer = (direction: 'next' | 'prev') => {
    if (standardContainers.length <= 1) return;

    const currentIndex = standardContainers.findIndex(
      (c) => c.id === currentContainer?.id
    );
    let nextIndex;

    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % standardContainers.length;
    } else {
      nextIndex =
        (currentIndex - 1 + standardContainers.length) %
        standardContainers.length;
    }

    const nextContainer = standardContainers[nextIndex];
    if (nextContainer) {
      setSelectedContainerId(nextContainer.id);
    }
  };
  const saveWaterIntake = (
    changeDrinks: number,
    containerId: number | null
  ) => {
    if (!userId) {
      return;
    }
    updateWaterIntake({
      user_id: userId,
      entry_date: selectedDate,
      change_drinks: changeDrinks,
      container_id: containerId,
    });
  };

  const adjustWater = (changeDrinks: number) => {
    saveWaterIntake(changeDrinks, currentContainer?.id || null);
  };

  const hasWaterGoal = typeof waterGoalMl === 'number' && waterGoalMl > 0;
  const fillPercentage = hasWaterGoal
    ? Math.min((waterMl / waterGoalMl) * 100, 100)
    : 0;
  // A container's unit qualifies its own volume. A linked container has none
  // -- volume is 0 and the credit comes from the food -- so whatever unit was
  // left in the form when it was created is vestigial, and letting it drive the
  // card put the day's total in oz for a container the user thinks of as ml.
  const containerUnitIsMeaningful =
    !!currentContainer &&
    (!currentContainer.linked_food_id || currentContainer.volume > 0);
  const displayUnit = containerUnitIsMeaningful
    ? currentContainer.unit
    : water_display_unit;

  const getVolumeDisplay = () => {
    if (currentContainer) {
      // Mirror the server's precedence (measurementService, #2115) so the label
      // and the ring can never disagree: an explicit container volume wins,
      // otherwise a linked food supplies its own water, scaled by how much of
      // it one press logs. This used to always show volume / servings, so a
      // linked container promised "+500 ml" and credited the food's 22.
      const servings = Math.max(
        1,
        currentContainer.servings_per_container || 1
      );
      const hasVolumeOverride =
        !currentContainer.linked_food_id || currentContainer.volume > 0;
      // water_ml is stored per serving_size, so the credit for linked_quantity
      // of it is water * quantity / serving_size -- the same scaling the server
      // applies. Without the divisor a 250 ml drink read as 5500 ml.
      const linkedServingSize =
        Number(currentContainer.linked_variant_serving_size) || 0;
      const linkedWater =
        Number(currentContainer.linked_variant_water_ml ?? 0) *
        Number(currentContainer.linked_quantity ?? 1);
      const volumePerDrink = hasVolumeOverride
        ? currentContainer.volume / servings
        : linkedServingSize > 0
          ? linkedWater / linkedServingSize
          : linkedWater;
      const credited =
        volumePerDrink * Number(currentContainer.hydration_factor ?? 1);
      const displayVolume = convertMlToSelectedUnit(
        credited,
        displayUnit
      ).toFixed(displayUnit === 'ml' ? 0 : 2);

      return t('foodDiary.waterIntake.perDrink', {
        volume: displayVolume,
        unit: displayUnit,
      });
    }

    const displayVolume = convertMlToSelectedUnit(
      250,
      water_display_unit
    ).toFixed(water_display_unit === 'ml' ? 0 : 2);
    return t('foodDiary.waterIntake.defaultPerDrink', {
      volume: displayVolume,
      unit: water_display_unit,
    });
  };

  return {
    user,
    userId,
    waterGoalMl,
    waterMl,
    manualWaterMl,
    foodWaterMl,
    loading,
    logEntries,
    deleteLogEntry,
    deleting,
    updateLogTime,
    standardContainers,
    quickAddPresets,
    currentContainer,
    cycleContainer,
    saveWaterIntake,
    adjustWater,
    getVolumeDisplay,
    hasWaterGoal,
    fillPercentage,
    displayUnit,
    water_display_unit,
  };
}
