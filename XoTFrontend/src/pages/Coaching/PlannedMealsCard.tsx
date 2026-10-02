import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  todayInZone,
  type PlannedMealOccurrence,
  type PlannedMealConfirmation,
} from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import {
  useCoachingSettings,
  useCoachingActions,
  usePlannedMeals,
  useCoachingRefresh,
} from '@/hooks/Coaching/useCoaching';
import { GlowCard } from '@/components/ui/glow-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function PlannedMealRow({
  meal,
  day,
}: {
  meal: PlannedMealOccurrence;
  day: string;
}) {
  const { t } = useTranslation(),
    refresh = useCoachingRefresh(),
    { timezone } = usePreferences();
  const [quantity, setQuantity] = useState(meal.assignment.quantity),
    [time, setTime] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [open, setOpen] = useState(false);
  const { confirmCoachingMeal, skipCoachingMeal } = useCoachingActions();
  const receipt = useRef<PlannedMealConfirmation | null>(null);
  const run = async (consume: boolean) => {
    setBusy(true);
    setError(false);
    try {
      if (consume) {
        const previous = receipt.current;
        const input =
          previous &&
          previous.quantity === quantity &&
          previous.entryTime === (time || null)
            ? previous
            : {
                operationId: crypto.randomUUID(),
                consumedDay: day,
                quantity,
                unit: meal.assignment.unit,
                entryTime: time || null,
              };
        receipt.current = input;
        await confirmCoachingMeal(meal.id, input);
      } else await skipCoachingMeal(meal.id);
      await refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 border-t pt-4">
      <p className="font-medium">{meal.name}</p>
      <p className="text-sm text-muted-foreground">
        {meal.planName} · {meal.assignment.quantity} {meal.assignment.unit}
      </p>
      {meal.state === 'planned' ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={day > todayInZone(timezone) || busy}
              onClick={() => setOpen(!open)}
            >
              {t('coaching.consumed', { defaultValue: 'I ate this' })}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => run(false)}>
              {t('coaching.skip', { defaultValue: 'Skip' })}
            </Button>
          </div>
          {open && (
            <div className="space-y-3 rounded-xl border p-4">
              <p>
                {t('coaching.consumptionHint', {
                  defaultValue:
                    'Confirm the amount you actually ate. Current library nutrition will be used, and the food will be added once to this diary date.',
                })}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`meal-qty-${meal.id}`}>
                    {t('coaching.fields.quantity', {
                      defaultValue: 'Quantity',
                    })}{' '}
                    ({meal.assignment.unit})
                  </Label>
                  <Input
                    id={`meal-qty-${meal.id}`}
                    type="number"
                    min="0.001"
                    step="any"
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(Number(event.target.value))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={`meal-time-${meal.id}`}>
                    {t('coaching.fields.time', { defaultValue: 'Time' })}
                  </Label>
                  <Input
                    id={`meal-time-${meal.id}`}
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </div>
              </div>
              <Button
                disabled={busy || quantity <= 0 || !Number.isFinite(quantity)}
                onClick={() => run(true)}
              >
                {t('coaching.confirmConsumption', {
                  defaultValue: 'Confirm and log consumption',
                })}
              </Button>
            </div>
          )}
        </>
      ) : (
        <p>
          {meal.state === 'confirmed'
            ? t('coaching.logged', { defaultValue: 'Consumption recorded' })
            : t('coaching.skipped', { defaultValue: 'Skipped' })}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {t('coaching.error', {
            defaultValue: 'Could not save. Refresh and try again.',
          })}
        </p>
      )}
    </div>
  );
}
export function PlannedMealsCard({ day }: { day: string }) {
  const { t } = useTranslation(),
    { isActingOnBehalf } = useActiveUser(),
    settings = useCoachingSettings();
  const query = usePlannedMeals(
    day,
    !isActingOnBehalf && !!settings.data?.featureEnabled
  );
  const meals = query.data?.filter((meal) => meal.state !== 'cancelled') ?? [];
  if (!meals.length) return null;
  return (
    <GlowCard as="section" tone="orange" className="space-y-4 p-5">
      <h2 className="text-xl font-semibold">
        {t('coaching.plannedMeals', { defaultValue: 'Planned meals' })}
      </h2>
      <p className="text-muted-foreground">
        {t('coaching.plannedHint', {
          defaultValue:
            'These are suggestions for this day. Only confirmed consumption counts toward your intake.',
        })}
      </p>
      {meals.map((meal) => (
        <PlannedMealRow key={meal.id} meal={meal} day={day} />
      ))}
    </GlowCard>
  );
}
