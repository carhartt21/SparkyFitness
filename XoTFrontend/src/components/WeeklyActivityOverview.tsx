import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  activityWeekRange,
  addDays,
  todayInZone,
  linkableActivityRecords,
  type ActivityOccurrence,
  type ActivityResolutionRequest,
} from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActivityPlanning } from '@/hooks/Tracking/useActivityPlanning';
import { GlowCard } from '@/components/ui/glow-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function WeeklyActivityOverview() {
  const { t, i18n } = useTranslation();
  const { timezone, formatDate } = usePreferences();
  const today = todayInZone(timezone);
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const range = activityWeekRange(anchor);
  const { query, mutation, isActingOnBehalf } = useActivityPlanning(
    range.start_date,
    range.end_date
  );
  const [failure, setFailure] = useState(false);
  const decide = async (operation: ActivityResolutionRequest) => {
    setFailure(false);
    try {
      await mutation.mutateAsync(operation);
    } catch {
      setFailure(true);
    }
  };
  const stateLabel = (row: ActivityOccurrence) =>
    t(`activityPlanning.state.${row.state}`);
  if (isActingOnBehalf) return null;
  return (
    <GlowCard
      as="section"
      className="p-5 space-y-4"
      data-testid="weekly-activity-overview"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t('activityPlanning.title')}</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('activityPlanning.previous')}
            onClick={() => setAnchor(addDays(anchor, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={() => setAnchor(today)}>
            {t('activityPlanning.thisWeek')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('activityPlanning.next')}
            onClick={() => setAnchor(addDays(anchor, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        {formatDate(range.start_date)} – {formatDate(range.end_date)}
      </p>
      <p className="text-sm text-muted-foreground max-w-prose">
        {t('activityPlanning.explanation')}
      </p>
      {query.isPending && <p role="status">{t('activityPlanning.loading')}</p>}
      {query.isError && (
        <div role="alert">
          <p>{t('activityPlanning.loadError')}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t('activityPlanning.retry')}
          </Button>
        </div>
      )}
      {failure && (
        <p role="alert" className="text-destructive">
          {t('activityPlanning.saveError')}
        </p>
      )}
      {query.data && !query.isError && (
        <>
          <div
            className="flex flex-wrap gap-2"
            aria-label={t('activityPlanning.summary')}
          >
            {query.data.summary.map((row) => (
              <Badge
                variant="secondary"
                key={row.activity_type}
                className="whitespace-normal tabular-nums"
              >
                {t(`activityPlanning.sport.${row.activity_type}`)} ·{' '}
                {t('activityPlanning.count', {
                  completed: row.completed,
                  scheduled: row.scheduled - row.excluded - row.unknown,
                })}
              </Badge>
            ))}
          </div>
          {query.data.occurrences.length === 0 && (
            <p className="text-muted-foreground">
              {t('activityPlanning.empty')}
            </p>
          )}
          <ul className="divide-y divide-border">
            {query.data.occurrences.map((row) => {
              const records = linkableActivityRecords(row, query.data.records);
              const recordId = records.some((r) => r.id === selected[row.id])
                ? (selected[row.id] ?? '')
                : '';
              const controlsDisabled = mutation.isPending || query.isFetching;
              return (
                <li key={row.id} className="py-4 space-y-2">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">
                        {formatDate(row.date)} ·{' '}
                        {t(`activityPlanning.sport.${row.activity_type}`)}
                      </p>
                      <h3 className="font-semibold break-words">{row.label}</h3>
                      <p className="text-sm text-muted-foreground break-words">
                        {row.plan_label}
                      </p>
                    </div>
                    <Badge variant="outline">{stateLabel(row)}</Badge>
                  </div>
                  {row.reason === 'prescription_unknown' && (
                    <p className="text-sm text-muted-foreground">
                      {t('activityPlanning.unknownHint')}
                    </p>
                  )}
                  {row.reason === 'linked_record_missing' && (
                    <p className="text-sm text-muted-foreground">
                      {t('activityPlanning.missingHint')}
                    </p>
                  )}
                  {row.completed_sets > 0 && (
                    <p className="text-sm tabular-nums">
                      {t('activityPlanning.sets', {
                        completed: row.completed_sets,
                        expected:
                          row.expected_sets === null
                            ? t('activityPlanning.unknown')
                            : row.expected_sets,
                      })}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        to={
                          row.source === 'mobility'
                            ? '/mobility'
                            : `/diary?date=${row.date}`
                        }
                      >
                        {t(
                          row.source === 'mobility'
                            ? 'activityPlanning.openMobility'
                            : 'activityPlanning.openDiary'
                        )}
                      </Link>
                    </Button>
                    {row.source === 'workout' && (
                      <>
                        {row.revision > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={controlsDisabled}
                            onClick={() =>
                              void decide({
                                occurrence_id: row.id,
                                expected_revision: row.revision,
                                action: 'undo',
                              })
                            }
                          >
                            {t('activityPlanning.undo')}
                          </Button>
                        )}
                        {row.state !== 'excluded' &&
                          row.state !== 'complete' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={controlsDisabled}
                              onClick={() =>
                                void decide({
                                  occurrence_id: row.id,
                                  expected_revision: row.revision,
                                  action: 'skip',
                                })
                              }
                            >
                              {t('activityPlanning.skip')}
                            </Button>
                          )}
                        {row.state !== 'complete' &&
                          row.state !== 'excluded' &&
                          records.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 w-full">
                              <label
                                className="text-sm"
                                htmlFor={`record-${row.id}`}
                              >
                                {t('activityPlanning.recordedActivity')}
                              </label>
                              <select
                                id={`record-${row.id}`}
                                value={recordId}
                                disabled={controlsDisabled}
                                onChange={(event) =>
                                  setSelected({
                                    ...selected,
                                    [row.id]: event.target.value,
                                  })
                                }
                                className="rounded-md border border-input bg-background p-2 text-sm min-w-0 max-w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                              >
                                <option value="">
                                  {t('activityPlanning.chooseRecord')}
                                </option>
                                {records.map((record) => (
                                  <option key={record.id} value={record.id}>
                                    {record.label}
                                  </option>
                                ))}
                              </select>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={controlsDisabled || !recordId}
                                onClick={() =>
                                  void decide({
                                    occurrence_id: row.id,
                                    expected_revision: row.revision,
                                    action: 'link',
                                    record_id: recordId,
                                  })
                                }
                              >
                                {t('activityPlanning.link')}
                              </Button>
                            </div>
                          )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {query.data.workout_plans.some(
            (plan) => plan.is_active && plan.schedule_type === 'sequential'
          ) && (
            <p className="text-sm text-muted-foreground">
              {t('activityPlanning.sequential')}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {new Intl.NumberFormat(i18n.resolvedLanguage).format(
              query.data.records.filter((record) => record.confirmed).length
            )}{' '}
            {t('activityPlanning.savedRecords')}
          </p>
        </>
      )}
    </GlowCard>
  );
}
