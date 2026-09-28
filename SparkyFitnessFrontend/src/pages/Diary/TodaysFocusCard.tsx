import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Circle, Flame, Target } from 'lucide-react';
import { addDays } from '@workspace/shared';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { useMiniNutritionTrendData } from '@/hooks/Foods/useFoods';
import { convertMlToSelectedUnit } from '@/utils/nutritionCalculations';
import {
  buildTodaysFocus,
  computeLoggingStreak,
  type FocusInputs,
  type FocusItem,
} from '@/utils/todaysFocus';

/** How far back the streak looks; longer streaks read as "90+". */
const STREAK_WINDOW_DAYS = 90;

export function LoggingStreakBadge({ selectedDate }: { selectedDate: string }) {
  const { t } = useTranslation();
  const { activeUserId } = useActiveUser();
  const startDate = addDays(selectedDate, -(STREAK_WINDOW_DAYS - 1));
  const { data, isLoading, isError } = useMiniNutritionTrendData(
    activeUserId || undefined,
    startDate,
    selectedDate
  );
  const streak = useMemo(
    () =>
      computeLoggingStreak(
        (data ?? []).map((day) => day.date),
        selectedDate
      ),
    [data, selectedDate]
  );

  if (isLoading || isError || streak === 0) return null;

  const capped = streak >= STREAK_WINDOW_DAYS;
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2"
      data-testid="logging-streak"
    >
      <Flame aria-hidden="true" className="h-5 w-5 text-orange-500" />
      <div className="leading-tight">
        <p className="text-lg font-semibold tabular-nums text-foreground">
          {capped ? `${STREAK_WINDOW_DAYS}+` : streak}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('diary.loggingStreak', {
            count: streak,
            defaultValue: 'day logging streak',
          })}
        </p>
      </div>
    </div>
  );
}

interface TodaysFocusCardProps extends FocusInputs {
  onEditGoals: () => void;
}

export function TodaysFocusCard({
  onEditGoals,
  ...inputs
}: TodaysFocusCardProps) {
  const { t } = useTranslation();
  const { energyUnit, convertEnergy, water_display_unit } = usePreferences();
  const items = buildTodaysFocus(inputs);

  const energy = (kcal: number) =>
    Math.round(convertEnergy(kcal, 'kcal', energyUnit)).toLocaleString();
  const water = (ml: number) =>
    convertMlToSelectedUnit(ml, water_display_unit).toFixed(
      water_display_unit === 'ml' ? 0 : 1
    );

  const describe = (item: FocusItem) => {
    switch (item.key) {
      case 'energy':
        return {
          label: t('diary.focus.energy', {
            goal: energy(item.goal),
            unit: energyUnit,
            defaultValue: 'Stay within {{goal}} {{unit}}',
          }),
          detail: t('diary.focus.progress', {
            current: energy(item.current),
            goal: energy(item.goal),
            unit: energyUnit,
            defaultValue: '{{current}} of {{goal}} {{unit}}',
          }),
        };
      case 'protein':
        return {
          label: t('diary.focus.protein', {
            goal: Math.round(item.goal),
            defaultValue: 'Reach {{goal}} g protein',
          }),
          detail: t('diary.focus.progress', {
            current: Math.round(item.current),
            goal: Math.round(item.goal),
            unit: 'g',
            defaultValue: '{{current}} of {{goal}} {{unit}}',
          }),
        };
      case 'water':
        return {
          label: t('diary.focus.water', {
            goal: water(item.goal),
            unit: water_display_unit,
            defaultValue: 'Drink {{goal}} {{unit}} of water',
          }),
          detail: t('diary.focus.progress', {
            current: water(item.current),
            goal: water(item.goal),
            unit: water_display_unit,
            defaultValue: '{{current}} of {{goal}} {{unit}}',
          }),
        };
      default:
        return {
          label: t('diary.focus.logFood', 'Log food for this day'),
          detail: t('diary.focus.entries', {
            count: item.current,
            defaultValue: '{{count}} entries',
          }),
        };
    }
  };

  return (
    <section
      aria-label={t('diary.focus.title', "Today's focus")}
      className="rounded-xl border border-border/60 bg-card p-4"
      data-testid="todays-focus"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Target aria-hidden="true" className="h-5 w-5 text-primary" />
          {t('diary.focus.title', "Today's focus")}
        </h2>
        <Button
          variant="ghost"
          className="min-h-11 gap-1 px-2 text-primary"
          onClick={onEditGoals}
        >
          {t('diary.focus.editGoals', 'Edit goals')}{' '}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
      <ul className="space-y-2">
        {items.map((item) => {
          const { label, detail } = describe(item);
          return (
            <li
              key={item.key}
              className="flex items-start gap-3"
              data-testid={`focus-${item.key}`}
            >
              {item.met ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
                />
              ) : (
                <Circle
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  {label}
                  <span className="sr-only">
                    {' '}
                    {item.met
                      ? t('diary.focus.met', 'Done')
                      : t('diary.focus.open', 'Not yet')}
                  </span>
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
