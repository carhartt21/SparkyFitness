import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatLocalizedNumber } from '../localization';

/** Read-only device data, never blended into the server's energy allowance. */
export default function OfflineHealthSummary({ date }: { date: string }) {
  const { t } = useTranslation();
  const [values, setValues] = useState<{
    date: string;
    steps?: number;
    energy?: number;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (Platform.OS !== 'ios') return;
    void (async () => {
      const health = await import('../services/healthkit');
      const { loadHealthPreference } =
        await import('../services/healthkit/preferences');
      if (!(await health.initHealthConnect())) return;
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      if (start > new Date()) return;
      const [stepsEnabled, energyEnabled] = await Promise.all([
        loadHealthPreference<boolean>('syncStepsEnabled'),
        loadHealthPreference<boolean>('syncCaloriesEnabled'),
      ]);
      const [steps, energy] = await Promise.all([
        stepsEnabled
          ? health.getAggregatedStepsByDateDetailed(start, end)
          : null,
        energyEnabled
          ? health.getAggregatedActiveCaloriesByDateDetailed(start, end)
          : null,
      ]);
      // Empty HealthKit reads cannot distinguish no permission from no samples.
      if (!cancelled)
        setValues({
          date,
          steps: steps?.error
            ? undefined
            : steps?.records.find((r) => r.date === date)?.value,
          energy: energy?.error
            ? undefined
            : energy?.records.find((r) => r.date === date)?.value,
        });
    })().catch(() => {
      if (!cancelled) setValues(null);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);
  if (Platform.OS !== 'ios') return null;
  const current = values?.date === date ? values : null;
  return (
    <View className="p-3 mb-3 rounded-xl bg-surface gap-1">
      <Text className="text-sm font-semibold text-text-primary">
        {t('dashboard.localHealth', {
          defaultValue: 'Apple Health on this device',
        })}
      </Text>
      {current?.steps != null && (
        <Text className="text-sm text-text-primary">
          {formatLocalizedNumber(current.steps)}{' '}
          {t('dashboard.steps', { defaultValue: 'Steps' })}
        </Text>
      )}
      {current?.energy != null && (
        <Text className="text-sm text-text-primary">
          {t('dashboard.localActiveEnergy', {
            defaultValue: 'Active energy: {{value}} kcal',
            value: formatLocalizedNumber(current.energy),
          })}
        </Text>
      )}
      <Text className="text-xs text-text-secondary">
        {current?.steps == null && current?.energy == null
          ? t('dashboard.localHealthUnknown', {
              defaultValue: 'No shared data is available for this day.',
            })
          : t('dashboard.localHealthNote', {
              defaultValue:
                'Shown separately; not added to the saved daily target.',
            })}
      </Text>
    </View>
  );
}
