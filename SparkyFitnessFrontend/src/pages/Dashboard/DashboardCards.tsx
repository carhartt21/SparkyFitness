import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowRight,
  BarChart3,
  ChevronRight,
  Clock,
  Droplet,
  Dumbbell,
  Flame,
  Minus,
  Plus,
  PlusCircle,
  Target,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlowCard, glowColor, type GlowTone } from '@/components/ui/glow-card';
import { cn } from '@/lib/utils';
import type { ActivityItem, DashboardMeal } from '@/utils/dashboardSummary';

/* ------------------------------------------------------------------ */
/* Shared pieces                                                        */
/* ------------------------------------------------------------------ */

export function CardTitle({
  icon,
  tone,
  title,
  action,
}: {
  icon: ReactNode;
  tone: GlowTone;
  title: string;
  action?: { label: string; onClick: () => void; iconOnly?: boolean };
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span style={{ color: glowColor(tone) }} aria-hidden="true">
        {icon}
      </span>
      <h2 className="flex-1 text-base font-semibold text-foreground">
        {title}
      </h2>
      {action ? (
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 gap-1 px-2 text-primary"
          onClick={action.onClick}
          aria-label={action.iconOnly ? action.label : undefined}
        >
          {action.iconOnly ? null : action.label}
          {action.iconOnly ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      ) : null}
    </div>
  );
}

/** Circular neon progress ring; the value is stated in text next to it. */
export function NeonRing({
  progress,
  size = 168,
  stroke = 12,
  tone = 'mint',
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  tone?: GlowTone;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fill = Math.min(
    Math.max(Number.isFinite(progress) ? progress : 0, 0),
    1
  );
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={glowColor(tone)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fill)}
          className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none dark:[filter:drop-shadow(0_0_6px_var(--glow-color))]"
          style={{ '--glow-color': glowColor(tone) } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

function StatLine({
  icon,
  tone,
  value,
  label,
}: {
  icon: ReactNode;
  tone: GlowTone;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span style={{ color: glowColor(tone) }} aria-hidden="true">
        {icon}
      </span>
      <div>
        <div className="text-base font-semibold tabular-nums text-foreground">
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function Bar({
  value,
  tone,
  color,
  label,
}: {
  value: number;
  tone?: GlowTone;
  color?: string;
  label: string;
}) {
  const pct = Math.min(Math.max(value, 0), 1) * 100;
  const barColor = color ?? glowColor(tone ?? 'neutral');
  return (
    <div
      className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div
        className="h-full rounded-full dark:shadow-[0_0_8px_var(--bar-color)]"
        style={
          {
            width: `${pct}%`,
            backgroundColor: barColor,
            '--bar-color': barColor,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Daily energy                                                         */
/* ------------------------------------------------------------------ */

export interface EnergyCardProps {
  unit: string;
  goal: number;
  eaten: number;
  burned: number;
  remaining: number;
  /** 0–100 as delivered by the daily summary. */
  progress: number;
  format: (kcal: number) => string;
  onDetails: () => void;
}

export function EnergyCard({
  unit,
  goal,
  eaten,
  burned,
  remaining,
  progress,
  format,
  onDetails,
}: EnergyCardProps) {
  const { t } = useTranslation();
  const hasGoal = goal > 0;
  const over = hasGoal && remaining < 0;
  return (
    <GlowCard
      tone="neutral"
      as="section"
      className="p-5"
      aria-labelledby="dash-energy"
    >
      <CardTitle
        icon={<Flame className="h-5 w-5" />}
        tone="orange"
        title={t('dashboardWeb.energy.title', 'Daily energy')}
        action={{
          label: t('dashboardWeb.viewDetails', 'View details'),
          onClick: onDetails,
        }}
      />
      <div className="flex items-center gap-4">
        <NeonRing
          progress={hasGoal ? progress / 100 : 0}
          tone="neutral"
          size={136}
          stroke={11}
        >
          <Flame
            className="mb-1 h-5 w-5"
            style={{ color: glowColor('neutral') }}
            aria-hidden="true"
          />
          <div className="text-2xl font-bold tabular-nums text-foreground">
            {format(hasGoal ? Math.abs(remaining) : eaten)}
          </div>
          <div className="text-xs text-muted-foreground">
            {hasGoal
              ? over
                ? t('dashboardWeb.energy.over', '{{unit}} over target', {
                    unit,
                  })
                : t('dashboardWeb.energy.remaining', '{{unit}} remaining', {
                    unit,
                  })
              : t('dashboardWeb.energy.eatenNoGoal', '{{unit}} eaten', {
                  unit,
                })}
          </div>
        </NeonRing>
        <div className="grid min-w-0 flex-1 gap-3">
          <StatLine
            icon={<Utensils className="h-5 w-5" />}
            tone="neutral"
            value={`${format(eaten)} ${unit}`}
            label={t('dashboardWeb.energy.consumed', 'Consumed')}
          />
          <StatLine
            icon={<Flame className="h-5 w-5" />}
            tone="orange"
            value={`${format(burned)} ${unit}`}
            label={t('dashboardWeb.energy.burned', 'Burned')}
          />
          <StatLine
            icon={<Target className="h-5 w-5" />}
            tone="cyan"
            value={hasGoal ? `${format(goal)} ${unit}` : '—'}
            label={t('dashboardWeb.energy.goal', 'Daily goal')}
          />
        </div>
      </div>
      {hasGoal ? (
        <div className="mt-5">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{t('dashboardWeb.energy.progress', 'Daily progress')}</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          <Bar
            value={progress / 100}
            tone="mint"
            label={t('dashboardWeb.energy.progress', 'Daily progress')}
          />
        </div>
      ) : null}
    </GlowCard>
  );
}

/* ------------------------------------------------------------------ */
/* Macronutrients                                                       */
/* ------------------------------------------------------------------ */

export interface MacroRow {
  key: 'protein' | 'carbs' | 'fat' | 'fiber';
  label: string;
  consumed: number;
  goal: number;
}

export function MacrosCard({
  rows,
  onDetails,
}: {
  rows: MacroRow[];
  onDetails: () => void;
}) {
  const { t } = useTranslation();
  return (
    <GlowCard tone="neutral" as="section" className="p-5">
      <CardTitle
        icon={<BarChart3 className="h-5 w-5" />}
        tone="neutral"
        title={t('dashboardWeb.macros.title', 'Macronutrients')}
        action={{
          label: t('dashboardWeb.viewDetails', 'View details'),
          onClick: onDetails,
          iconOnly: true,
        }}
      />
      <ul className="space-y-4">
        {rows.map((row) => {
          const hasGoal = row.goal > 0;
          const pct = hasGoal ? row.consumed / row.goal : 0;
          const color = `hsl(var(--metric-${row.key}))`;
          return (
            <li key={row.key} data-testid={`dash-macro-${row.key}`}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">{row.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {Math.round(row.consumed)}
                  {hasGoal ? ` / ${Math.round(row.goal)}` : ''} g
                </span>
              </div>
              {hasGoal ? (
                <div className="flex items-center gap-3">
                  <Bar value={pct} color={color} label={row.label} />
                  <span
                    className="w-10 text-right text-xs font-semibold tabular-nums"
                    style={{ color }}
                  >
                    {Math.round(pct * 100)}%
                  </span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </GlowCard>
  );
}

/* ------------------------------------------------------------------ */
/* Hydration                                                            */
/* ------------------------------------------------------------------ */

export function HydrationCard({
  valueLabel,
  goalLabel,
  fillPercentage,
  hasGoal,
  perDrinkLabel,
  canRemove,
  busy,
  onAdd,
  onRemove,
  onDetails,
}: {
  valueLabel: string;
  goalLabel: string | null;
  fillPercentage: number;
  hasGoal: boolean;
  perDrinkLabel: string;
  canRemove: boolean;
  busy: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onDetails: () => void;
}) {
  const { t } = useTranslation();
  return (
    <GlowCard tone="cyan" as="section" className="flex flex-col p-5">
      <CardTitle
        icon={<Droplet className="h-5 w-5" />}
        tone="cyan"
        title={t('dashboardWeb.hydration.title', 'Hydration')}
        action={{
          label: t('dashboardWeb.viewDetails', 'View details'),
          onClick: onDetails,
          iconOnly: true,
        }}
      />
      <div className="flex items-center gap-4">
        <div
          className="relative h-28 w-14 shrink-0 overflow-hidden rounded-2xl border-2"
          style={{ borderColor: glowColor('cyan') }}
          aria-hidden="true"
        >
          <div
            className="absolute bottom-0 w-full transition-[height] duration-700 motion-reduce:transition-none"
            style={{
              height: `${fillPercentage}%`,
              background: `linear-gradient(to top, ${glowColor('cyan')}, color-mix(in srgb, ${glowColor('cyan')} 55%, white))`,
            }}
          />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold tabular-nums text-foreground">
            {valueLabel}
          </div>
          <div className="text-sm text-muted-foreground">
            {goalLabel ??
              t('foodDiary.waterIntake.noGoal', 'No hydration goal set')}
          </div>
          {hasGoal ? (
            <div
              className="mt-1 text-sm font-semibold"
              style={{ color: glowColor('cyan') }}
            >
              {Math.round(fillPercentage)}%
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-full"
          onClick={onRemove}
          disabled={!canRemove || busy}
          aria-label={t('foodDiary.waterIntake.removeWater', 'Remove water')}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">
          {perDrinkLabel}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-full"
          onClick={onAdd}
          disabled={busy}
          aria-label={t('foodDiary.waterIntake.addWater', 'Add water')}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <Button
        className="mt-4 min-h-11 w-full gap-2 rounded-full dark:shadow-[0_0_18px_-4px_var(--neon-mint)]"
        onClick={onAdd}
        disabled={busy}
      >
        <Plus className="h-4 w-4" />
        {t('dashboardWeb.hydration.log', 'Log water')}
      </Button>
    </GlowCard>
  );
}

/* ------------------------------------------------------------------ */
/* Activity                                                             */
/* ------------------------------------------------------------------ */

export function ActivityCard({
  minutes,
  calories,
  recent,
  unit,
  format,
  onLog,
  onDetails,
}: {
  minutes: number;
  calories: number;
  recent: ActivityItem[];
  unit: string;
  format: (kcal: number) => string;
  onLog: () => void;
  onDetails: () => void;
}) {
  const { t } = useTranslation();
  return (
    <GlowCard tone="yellow" as="section" className="flex flex-col p-5">
      <CardTitle
        icon={<Activity className="h-5 w-5" />}
        tone="yellow"
        title={t('dashboardWeb.activity.title', "Today's activity")}
        action={{
          label: t('dashboardWeb.viewDetails', 'View details'),
          onClick: onDetails,
          iconOnly: true,
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/40 p-3">
          <Clock
            className="h-6 w-6"
            style={{ color: glowColor('mint') }}
            aria-hidden="true"
          />
          <div>
            <div className="text-xl font-bold tabular-nums">
              {Math.round(minutes)}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('dashboardWeb.activity.minutes', 'Minutes')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/40 p-3">
          <Flame
            className="h-6 w-6"
            style={{ color: glowColor('orange') }}
            aria-hidden="true"
          />
          <div>
            <div className="text-xl font-bold tabular-nums">
              {format(calories)}
            </div>
            <div className="text-xs text-muted-foreground">{unit}</div>
          </div>
        </div>
      </div>
      <Button
        className="mt-4 min-h-11 w-full gap-2 rounded-full dark:shadow-[0_0_18px_-4px_var(--neon-mint)]"
        onClick={onLog}
      >
        <Plus className="h-4 w-4" />
        {t('dashboardWeb.activity.log', 'Log exercise')}
      </Button>
      <h3 className="mb-2 mt-5 text-sm font-medium text-muted-foreground">
        {t('dashboardWeb.activity.recent', 'Recent activity')}
      </h3>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('dashboardWeb.activity.none', 'No exercise logged for this day.')}
        </p>
      ) : (
        <ul className="space-y-2">
          {recent.slice(0, 3).map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/40 px-3 py-2"
            >
              <Dumbbell
                className="h-5 w-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {item.name || t('dashboardWeb.activity.unnamed', 'Exercise')}
                </div>
                <div className="text-xs tabular-nums text-muted-foreground">
                  {t(
                    'dashboardWeb.activity.itemDetail',
                    '{{minutes}} min · {{calories}} {{unit}}',
                    {
                      minutes: Math.round(item.minutes),
                      calories: format(item.calories),
                      unit,
                    }
                  )}
                </div>
              </div>
              {item.time ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {item.time.slice(0, 5)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </GlowCard>
  );
}

/* ------------------------------------------------------------------ */
/* Meals and quick add                                                  */
/* ------------------------------------------------------------------ */

export function MealsCard({
  meals,
  labelFor,
  unit,
  format,
  onOpenMeal,
  onAddMeal,
  onViewAll,
}: {
  meals: DashboardMeal[];
  labelFor: (name: string) => string;
  unit: string;
  format: (kcal: number) => string;
  onOpenMeal: (name: string) => void;
  onAddMeal: () => void;
  onViewAll: () => void;
}) {
  const { t } = useTranslation();
  return (
    <GlowCard tone="orange" as="section" className="p-5">
      <CardTitle
        icon={<UtensilsCrossed className="h-5 w-5" />}
        tone="orange"
        title={t('dashboardWeb.meals.title', "Today's meals")}
        action={{
          label: t('dashboardWeb.meals.viewAll', 'View all meals'),
          onClick: onViewAll,
        }}
      />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
        {meals.map((meal) => (
          <button
            key={meal.name}
            type="button"
            onClick={() => onOpenMeal(meal.name)}
            className="flex min-h-[4.5rem] items-center gap-3 rounded-xl border border-border/70 bg-background/40 p-2 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {meal.image ? (
              <img
                src={meal.image}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Utensils
                  className="h-6 w-6 text-muted-foreground"
                  aria-hidden="true"
                />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">
                {labelFor(meal.name)}
              </span>
              <span className="block text-xs tabular-nums text-muted-foreground">
                {format(meal.calories)} {unit}
              </span>
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={onAddMeal}
          className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border p-2 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PlusCircle className="h-5 w-5" aria-hidden="true" />
          {t('dashboardWeb.meals.add', 'Add food')}
        </button>
      </div>
      {meals.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t('dashboardWeb.meals.none', 'No food logged for this day yet.')}
        </p>
      ) : null}
    </GlowCard>
  );
}

export interface QuickAction {
  key: string;
  label: string;
  icon: ReactNode;
  tone: GlowTone;
  onClick: () => void;
  disabled?: boolean;
}

export function QuickAddCard({ actions }: { actions: QuickAction[] }) {
  const { t } = useTranslation();
  return (
    <GlowCard tone="mint" as="section" className="p-5">
      <CardTitle
        icon={<PlusCircle className="h-5 w-5" />}
        tone="mint"
        title={t('dashboardWeb.quickAdd.title', 'Quick add')}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            data-testid={`dash-quick-${action.key}`}
            className="glow-surface flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl p-3 text-sm font-medium text-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-none"
            style={{ '--glow': glowColor(action.tone) } as React.CSSProperties}
          >
            <span style={{ color: glowColor(action.tone) }} aria-hidden="true">
              {action.icon}
            </span>
            {action.label}
          </button>
        ))}
      </div>
    </GlowCard>
  );
}

/* ------------------------------------------------------------------ */
/* At a glance                                                          */
/* ------------------------------------------------------------------ */

export interface GlanceStat {
  key: string;
  value: string;
  label: string;
  icon: ReactNode;
  tone: GlowTone;
}

export function GlanceCard({
  title,
  stats,
}: {
  title: string;
  stats: GlanceStat[];
}) {
  return (
    <GlowCard tone="green" as="section" className="p-5">
      <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
        {stats.map((stat) => (
          <li
            key={stat.key}
            className={cn(
              'flex items-center gap-3 rounded-xl border border-border/70 bg-background/40 px-3 py-3'
            )}
            data-testid={`dash-glance-${stat.key}`}
          >
            <span style={{ color: glowColor(stat.tone) }} aria-hidden="true">
              {stat.icon}
            </span>
            <div>
              <div className="text-lg font-bold tabular-nums">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          </li>
        ))}
      </ul>
    </GlowCard>
  );
}
