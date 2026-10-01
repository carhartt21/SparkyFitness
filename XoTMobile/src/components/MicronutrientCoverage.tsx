import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNutrientCoverage } from '../hooks/useNutrientCoverage';
import { useTranslation } from 'react-i18next';
import { HEALTH_MICRONUTRIENT_IDS } from '@workspace/shared';
import { formatLocalizedNumber } from '../localization';

export default function MicronutrientCoverage({
  date,
  enabled,
}: {
  date: string;
  enabled: boolean;
}) {
  const { t } = useTranslation();
  const labels = {
    vitamin_a: t('micronutrients.names.vitamin_a', {
      defaultValue: 'Vitamin A',
    }),
    vitamin_c: t('micronutrients.names.vitamin_c', {
      defaultValue: 'Vitamin C',
    }),
    thiamin: t('micronutrients.names.thiamin', {
      defaultValue: 'Thiamin (B1)',
    }),
    riboflavin: t('micronutrients.names.riboflavin', {
      defaultValue: 'Riboflavin (B2)',
    }),
    niacin: t('micronutrients.names.niacin', { defaultValue: 'Niacin (B3)' }),
    pantothenic_acid: t('micronutrients.names.pantothenic_acid', {
      defaultValue: 'Pantothenic Acid (B5)',
    }),
    vitamin_b6: t('micronutrients.names.vitamin_b6', {
      defaultValue: 'Vitamin B6',
    }),
    biotin: t('micronutrients.names.biotin', { defaultValue: 'Biotin (B7)' }),
    vitamin_b12: t('micronutrients.names.vitamin_b12', {
      defaultValue: 'Vitamin B12',
    }),
    folate: t('micronutrients.names.folate', { defaultValue: 'Folate (B9)' }),
    vitamin_d: t('micronutrients.names.vitamin_d', {
      defaultValue: 'Vitamin D',
    }),
    vitamin_e: t('micronutrients.names.vitamin_e', {
      defaultValue: 'Vitamin E',
    }),
    vitamin_k: t('micronutrients.names.vitamin_k', {
      defaultValue: 'Vitamin K',
    }),
    calcium: t('micronutrients.names.calcium', { defaultValue: 'Calcium' }),
    iron: t('micronutrients.names.iron', { defaultValue: 'Iron' }),
    potassium: t('micronutrients.names.potassium', {
      defaultValue: 'Potassium',
    }),
    sodium: t('micronutrients.names.sodium', { defaultValue: 'Sodium' }),
    chloride: t('micronutrients.names.chloride', { defaultValue: 'Chloride' }),
    chromium: t('micronutrients.names.chromium', { defaultValue: 'Chromium' }),
    copper: t('micronutrients.names.copper', { defaultValue: 'Copper' }),
    iodine: t('micronutrients.names.iodine', { defaultValue: 'Iodine' }),
    magnesium: t('micronutrients.names.magnesium', {
      defaultValue: 'Magnesium',
    }),
    manganese: t('micronutrients.names.manganese', {
      defaultValue: 'Manganese',
    }),
    molybdenum: t('micronutrients.names.molybdenum', {
      defaultValue: 'Molybdenum',
    }),
    phosphorus: t('micronutrients.names.phosphorus', {
      defaultValue: 'Phosphorus',
    }),
    selenium: t('micronutrients.names.selenium', { defaultValue: 'Selenium' }),
    zinc: t('micronutrients.names.zinc', { defaultValue: 'Zinc' }),
  };
  const [expanded, setExpanded] = useState(false);
  const { data, isPending, isError } = useNutrientCoverage(date, enabled);
  return (
    <View className="mt-4 rounded-xl bg-surface p-4">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        className="min-h-12 justify-center"
      >
        <Text className="text-lg font-semibold text-text-primary">
          {t('micronutrients.title', {
            defaultValue: 'Micronutrient coverage',
          })}
        </Text>
        <Text className="mt-1 text-sm text-text-secondary">
          {t('micronutrients.dailyExplanation', {
            defaultValue:
              'Recorded totals from logged foods and supplements. Expand to see which values are known.',
          })}
        </Text>
      </Pressable>
      {expanded &&
        (isPending ? (
          <Text className="text-text-secondary">
            {t('micronutrients.loading', {
              defaultValue: 'Loading micronutrient coverage…',
            })}
          </Text>
        ) : isError ? (
          <Text accessibilityRole="alert" className="text-text-secondary">
            {t('micronutrients.error', {
              defaultValue:
                'Coverage could not be loaded. Try again when connected.',
            })}
          </Text>
        ) : (
          <>
            {HEALTH_MICRONUTRIENT_IDS.map((id, index) => {
              const value = data?.[date]?.[id];
              return (
                <React.Fragment key={id}>
                  {(index === 0 || index === 13) && (
                    <Text className="mb-2 mt-4 font-semibold text-text-primary">
                      {index === 0
                        ? t('micronutrients.vitamins', {
                            defaultValue: 'Vitamins',
                          })
                        : t('micronutrients.minerals', {
                            defaultValue: 'Minerals',
                          })}
                    </Text>
                  )}
                  <View className="flex-row flex-wrap justify-between gap-2 border-b border-border py-2">
                    <Text className="text-sm text-text-primary">
                      {labels[id]}
                    </Text>
                    <View>
                      <Text className="text-right text-sm text-text-primary">
                        {value?.recordedTotal == null
                          ? t('micronutrients.unknown', {
                              defaultValue: 'Unknown',
                            })
                          : `${formatLocalizedNumber(value.recordedTotal, { maximumSignificantDigits: 4 })} ${value.unit}`}
                      </Text>
                      <Text className="text-right text-xs text-text-secondary">
                        {t('micronutrients.coverage', {
                          defaultValue:
                            '{{known}} of {{eligible}} entries known',
                          known: value?.knownEntryCount ?? 0,
                          eligible: value?.eligibleEntryCount ?? 0,
                        })}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </>
        ))}
    </View>
  );
}
