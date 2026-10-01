import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, MinusCircle, Timer } from 'lucide-react';
import type {
  DailyProgress,
  DailyProgressDomain,
  DailyProgressItem,
} from '@workspace/shared';
import ProgressTrackX from '@/components/brand/ProgressTrackX';
import { GlowCard, glowColor } from '@/components/ui/glow-card';

const MAX_ITEMS = 6;

function StateIcon({ item }: { item: DailyProgressItem }) {
  if (item.state === 'complete') {
    return (
      <CheckCircle2
        className="h-4 w-4 shrink-0"
        style={{ color: glowColor('green') }}
        aria-hidden="true"
      />
    );
  }
  if (item.state === 'started') {
    return (
      <Timer
        className="h-4 w-4 shrink-0"
        style={{ color: glowColor('yellow') }}
        aria-hidden="true"
      />
    );
  }
  if (item.state === 'excluded') {
    return (
      <MinusCircle
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    );
  }
  return (
    <Circle
      className="h-4 w-4 shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
  );
}

/**
 * Daily Progress on the web Dashboard: the canonical Progression X and the
 * day's explicit tasks. It is a completion share, not a health score.
 */
export function DailyProgressCard({
  progress,
  dayLabel,
}: {
  progress: DailyProgress;
  dayLabel: string;
}) {
  const { t } = useTranslation();

  const domainLabel: Record<DailyProgressDomain, string> = {
    checkin: t('dailyTracking.domain.checkin', 'Check-in'),
    habit: t('dailyTracking.domain.habit', 'Habit'),
    measurement: t('dailyTracking.domain.measurement', 'Measurement'),
    supplement: t('dailyTracking.domain.supplement', 'Supplement'),
    meal: t('dailyTracking.domain.meal', 'Meal'),
    goal: t('dailyTracking.domain.goal', 'Daily objectives'),
    workout: t('dailyTracking.domain.workout', 'Planned training'),
  };
  const stateLabel = (item: DailyProgressItem) =>
    item.state === 'complete'
      ? t('dailyTracking.state.complete', 'Complete')
      : item.state === 'started'
        ? t('dailyTracking.state.started', 'Started')
        : item.state === 'excluded'
          ? t('dailyTracking.state.excluded', 'Skipped, not counted')
          : t('dailyTracking.state.pending', 'Not recorded yet');
  const itemLabel = (item: DailyProgressItem) => {
    if (item.domain === 'goal') return t(`dailyTracking.goals.${item.label}`);
    if (item.domain === 'workout' && item.activity_type)
      return t(`weeklyPlan.activities.${item.activity_type}`);
    if (item.domain === 'checkin') {
      return t('dailyTracking.checkinItem', 'Daily check-in');
    }
    if (item.domain === 'measurement') {
      return item.label === 'weight'
        ? t('dailyTracking.weighIn', 'Weigh-in')
        : domainLabel.measurement;
    }
    return item.label;
  };
  const shown = progress.items.slice(0, MAX_ITEMS);

  return (
    <GlowCard
      as="section"
      tone={
        progress.percent === null || progress.percent === 0
          ? undefined
          : progress.percent >= 100
            ? 'green'
            : 'yellow'
      }
      className="p-5"
      data-testid="dash-daily-progress"
    >
      <div className="flex items-center gap-4">
        <ProgressTrackX
          progress={progress.percent}
          label={t('dailyTracking.title', 'Daily Progress')}
          unknownLabel={t('dailyTracking.nothingApplies', 'No tasks today')}
          size={88}
          showValue={false}
        />
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            {t('dailyTracking.title', 'Daily Progress')}
          </h2>
          <p
            className="text-sm text-muted-foreground"
            data-testid="dash-daily-progress-count"
          >
            {progress.applicable > 0
              ? t(
                  'dailyTracking.countLine',
                  '{{day}} · {{completed}} of {{applicable}} complete',
                  {
                    day: dayLabel,
                    completed: progress.completed,
                    applicable: progress.applicable,
                  }
                )
              : t(
                  'dailyTracking.nothingAppliesLine',
                  '{{day}} · no tracking tasks',
                  { day: dayLabel }
                )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {progress.applicable > 0
              ? t(
                  'dailyTracking.explanation',
                  'Each task counts equally; this is not a health score.'
                )
              : t(
                  'dailyTracking.emptyExplanation',
                  'Nothing is scheduled or selected for this day.'
                )}
          </p>
        </div>
      </div>
      {shown.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {shown.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 text-sm"
              data-testid={`dash-daily-progress-item-${item.domain}`}
            >
              <StateIcon item={item} />
              <span className="min-w-0 flex-1 truncate">{itemLabel(item)}</span>
              <span className="text-xs text-muted-foreground">
                {stateLabel(item)}
              </span>
            </li>
          ))}
          {progress.items.length > MAX_ITEMS ? (
            <li className="text-xs text-muted-foreground">
              {t('dailyTracking.more', '+{{count}} more', {
                count: progress.items.length - MAX_ITEMS,
              })}
            </li>
          ) : null}
        </ul>
      ) : null}
    </GlowCard>
  );
}
