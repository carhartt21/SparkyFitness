import { Alert } from 'react-native';
import type { TFunction } from 'i18next';
import { getAppLocale } from '../localization';
import type { MobilityEnergyEstimate } from '../utils/mobilityEnergyEstimate';

/** Foreground iOS prompt; unknown energy is never converted into zero. */
export function requestWorkoutActiveEnergy(
  t: TFunction,
  options?: { mobility: true; estimate?: MobilityEnergyEstimate }
): Promise<number | undefined> {
  return new Promise<number | undefined>((resolve) => {
    const ask = () =>
      Alert.prompt(
        options?.mobility
          ? t('mobility.energyEstimateTitle', {
              defaultValue: 'Confirm mobility calories',
            })
          : t('healthSync.workoutEnergyTitle', {
              defaultValue: 'Active calories for Apple Health',
            }),
        options?.estimate
          ? t('mobility.energyEstimateMessage', {
              defaultValue:
                'Estimate: {{kcal}} active kcal from {{minutes}} min of confirmed timed exercises and your latest weight ({{weight}} kg). Assumes mild stretching (2.3 MET), with resting energy excluded. This is not a measurement. Check or edit the value before confirming.',
              kcal: options.estimate.activeKcal,
              minutes: new Intl.NumberFormat(getAppLocale(), {
                maximumFractionDigits: 1,
              }).format(options.estimate.timedSeconds / 60),
              weight: new Intl.NumberFormat(getAppLocale(), {
                maximumFractionDigits: 1,
              }).format(options.estimate.weightKg),
            })
          : options?.mobility
            ? t('mobility.energyNoEstimateMessage', {
                defaultValue:
                  'A calorie estimate needs a known weight and confirmed timed exercises. Enter active calories only if you know them, or skip export. The session stays in your diary.',
              })
            : t('healthSync.workoutEnergyMessage', {
                defaultValue:
                  'No Watch energy recording was started. Enter active calories only if you know them. Skip export to keep the workout in X on Track without a zero-calorie Health entry. Your goal settings stay unchanged.',
              }),
        [
          {
            text: t('healthSync.workoutSkipExport', {
              defaultValue: 'Skip export',
            }),
            style: 'cancel',
            onPress: () => resolve(undefined),
          },
          {
            text: options?.mobility
              ? t('mobility.energyEstimateConfirm', {
                  defaultValue: 'Confirm and export',
                })
              : t('common.save', { defaultValue: 'Save' }),
            onPress: (value?: string) => {
              const energy = Number(value?.trim().replace(',', '.'));
              if (Number.isFinite(energy) && energy > 0) resolve(energy);
              else
                Alert.alert(
                  t('healthSync.workoutEnergyInvalid', {
                    defaultValue:
                      'Enter a positive calorie amount, or skip export.',
                  }),
                  undefined,
                  [
                    {
                      text: t('common.ok', { defaultValue: 'OK' }),
                      onPress: ask,
                    },
                  ]
                );
            },
          },
        ],
        'plain-text',
        options?.estimate ? String(options.estimate.activeKcal) : '',
        'decimal-pad'
      );
    ask();
  });
}
