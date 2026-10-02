import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  type PlannedMealOccurrence,
  type PlannedMealConfirmation,
} from '@workspace/shared';
import { useCoaching } from '../../hooks/useCoaching';
import { useNeonScale } from '../tracking/useNeonScale';
import { getTodayDate } from '../../utils/dateUtils';
import { newUuid } from '../../utils/ids';
import GlowCard from '../ui/GlowCard';
import NeonButton from '../ui/NeonButton';
import FormInput from '../FormInput';

type Api = ReturnType<typeof useCoaching>['api'];
function Meal({
  meal,
  api,
  day,
}: {
  meal: PlannedMealOccurrence;
  api: Api;
  day: string;
}) {
  const { t } = useTranslation(),
    client = useQueryClient();
  const [open, setOpen] = useState(false),
    [quantity, setQuantity] = useState(String(meal.assignment.quantity)),
    [time, setTime] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const attempt = useRef<PlannedMealConfirmation | null>(null),
    amount = Number(quantity.replace(',', '.'));
  const act = async (consume: boolean) => {
    setBusy(true);
    setError(false);
    try {
      if (consume) {
        const previous = attempt.current,
          body =
            previous &&
            previous.quantity === amount &&
            previous.entryTime === (time || null)
              ? previous
              : {
                  operationId: newUuid(),
                  consumedDay: day,
                  quantity: amount,
                  unit: meal.assignment.unit,
                  entryTime: time || null,
                };
        attempt.current = body;
        await api.confirmCoachingMeal(meal.id, body);
      } else await api.skipCoachingMeal(meal.id);
      await client.invalidateQueries();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View className="gap-3 border-t border-border-subtle pt-4">
      <Text className="text-lg font-semibold text-text-primary">
        {meal.name}
      </Text>
      <Text className="text-base text-text-secondary">
        {meal.planName} · {meal.assignment.quantity} {meal.assignment.unit}
      </Text>
      {meal.state === 'planned' ? (
        <>
          <NeonButton
            variant="outline"
            disabled={busy || day > getTodayDate()}
            label={t('coaching.consumed', { defaultValue: 'I ate this' })}
            onPress={() => setOpen(!open)}
          />
          <NeonButton
            variant="subtle"
            disabled={busy}
            label={t('coaching.skip', { defaultValue: 'Skip' })}
            onPress={() => {
              void act(false);
            }}
          />
          {open && (
            <View className="gap-3">
              <Text className="text-base text-text-secondary">
                {t('coaching.consumptionHint', {
                  defaultValue:
                    'Confirm the amount you actually ate. Current library nutrition will be used, and the food will be added once to this diary date.',
                })}
              </Text>
              <FormInput
                accessibilityLabel={t('coaching.fields.quantity', {
                  defaultValue: 'Quantity',
                })}
                value={quantity}
                keyboardType="decimal-pad"
                onChangeText={setQuantity}
              />
              <FormInput
                accessibilityLabel={t('coaching.fields.time', {
                  defaultValue: 'Time',
                })}
                placeholder="12:30"
                value={time}
                onChangeText={setTime}
              />
              <NeonButton
                disabled={busy || !Number.isFinite(amount) || amount <= 0}
                label={t('coaching.confirmConsumption', {
                  defaultValue: 'Confirm and log consumption',
                })}
                onPress={() => {
                  void act(true);
                }}
              />
            </View>
          )}
        </>
      ) : (
        <Text className="text-base text-text-primary">
          {meal.state === 'confirmed'
            ? t('coaching.logged', { defaultValue: 'Consumption recorded' })
            : t('coaching.skipped', { defaultValue: 'Skipped' })}
        </Text>
      )}
      {error && (
        <Text accessibilityRole="alert" className="text-base text-text-primary">
          {t('coaching.error', {
            defaultValue: 'Could not save. Refresh and try again.',
          })}
        </Text>
      )}
    </View>
  );
}
function Contents({
  api,
  scope,
  day,
}: {
  api: Api;
  scope: string;
  day: string;
}) {
  const { t } = useTranslation(),
    scale = useNeonScale();
  const settings = useQuery({
    queryKey: ['coaching', scope, 'settings'],
    queryFn: api.loadCoachingSettings,
    retry: false,
  });
  const query = useQuery({
    queryKey: ['coaching', scope, 'planned-meals', day],
    queryFn: () => api.loadPlannedMeals(day),
    enabled: !!settings.data?.featureEnabled,
    retry: false,
  });
  const meals = query.data?.filter((meal) => meal.state !== 'cancelled') ?? [];
  if (!meals.length) return null;
  return (
    <GlowCard glowColor={scale.orange} className="gap-4 p-4 mb-3">
      <Text
        accessibilityRole="header"
        className="text-xl font-semibold text-text-primary"
      >
        {t('coaching.plannedMeals', { defaultValue: 'Planned meals' })}
      </Text>
      <Text className="text-base text-text-secondary">
        {t('coaching.plannedHint', {
          defaultValue:
            'These are suggestions for this day. Only confirmed consumption counts toward your intake.',
        })}
      </Text>
      {meals.map((meal) => (
        <Meal key={meal.id} meal={meal} api={api} day={day} />
      ))}
    </GlowCard>
  );
}
export default function PlannedMealsCard({ day }: { day: string }) {
  const { api, scope } = useCoaching();
  return scope ? (
    <Contents key={scope + day} api={api} scope={scope} day={day} />
  ) : null;
}
