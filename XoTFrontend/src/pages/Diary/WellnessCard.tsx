import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Leaf, Undo2 } from 'lucide-react';
import { isWellnessActivity, wellnessEntries } from '@workspace/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWellness } from '@/hooks/Tracking/useWellness';

export default function WellnessCard({ date }: { date: string }) {
  const { t, i18n } = useTranslation();
  const { habits, logs, save, remove, enabled, canWrite } = useWellness(date);
  const [name, setName] = useState('');
  const inFlight = useRef(false);
  const entries = wellnessEntries(habits.data ?? [], logs.data ?? []);
  const today = entries.filter((entry) => entry.date === date);
  const presets = [
    t('wellness.sauna', 'Sauna'),
    t('wellness.massage', 'Massage'),
    t('wellness.meditation', 'Meditation'),
  ];
  const choices = [
    ...new Set([
      ...presets,
      ...(habits.data ?? [])
        .filter((habit) => isWellnessActivity(habit) && habit.active)
        .map((habit) => habit.name),
    ]),
  ];
  const loading = habits.isPending || logs.isPending;
  const failed = habits.isError || logs.isError;
  const busy = save.isPending || remove.isPending;
  const blocked = busy || loading || failed || !canWrite;

  const record = async (activity: string, custom = false) => {
    if (inFlight.current || blocked || !activity.trim()) return;
    inFlight.current = true;
    try {
      await save.mutateAsync(activity);
      if (custom) setName('');
    } catch {
      /* Mutation metadata reports the failure; keep the input for retry. */
    } finally {
      inFlight.current = false;
    }
  };
  const undo = async (id: string) => {
    if (inFlight.current || blocked) return;
    inFlight.current = true;
    try {
      await remove.mutateAsync(id);
    } catch {
      /* Mutation metadata reports the failure. */
    } finally {
      inFlight.current = false;
    }
  };

  if (!enabled) return null;

  return (
    <Card
      role="region"
      aria-labelledby="wellness-heading"
      data-testid="wellness-card"
    >
      <CardHeader>
        <CardTitle
          id="wellness-heading"
          className="flex items-center gap-2 text-lg"
        >
          <Leaf className="h-5 w-5" aria-hidden="true" />
          {t('wellness.title', 'Wellness')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('wellness.subtitle', 'Log an activity for this day.')}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p role="status">
            {t('wellness.loading', 'Loading wellness activities…')}
          </p>
        ) : failed ? (
          <div role="alert" className="space-y-2">
            <p>
              {t(
                'wellness.loadFailed',
                'Could not load wellness activities. Please try again.'
              )}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void habits.refetch();
                void logs.refetch();
              }}
            >
              {t('common.retry', 'Try again')}
            </Button>
          </div>
        ) : (
          <>
            {today.length > 0 ? (
              <ul
                className="divide-y divide-border"
                aria-label={t('wellness.logged', 'Logged activities')}
              >
                {today.map((entry) => (
                  <li
                    key={entry.activityId}
                    className="flex min-h-12 flex-wrap items-center gap-3 py-1"
                  >
                    <span className="min-w-0 flex-1 basis-40 break-words">
                      {entry.name}
                    </span>
                    {canWrite && (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        className="ml-auto min-h-11 shrink-0"
                        onClick={() => void undo(entry.activityId)}
                        aria-label={t(
                          'wellness.removeActivity',
                          'Remove {{name}} from this day',
                          { name: entry.name }
                        )}
                      >
                        <Undo2 className="h-4 w-4" aria-hidden="true" />
                        {t('wellness.undo', 'Undo')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t(
                  'wellness.empty',
                  'No wellness activities logged for this day.'
                )}
              </p>
            )}
            {canWrite && (
              <>
                <div className="flex flex-wrap gap-2">
                  {choices.map((choice) => {
                    const recorded = today.some(
                      (entry) =>
                        entry.name.toLowerCase() === choice.toLowerCase()
                    );
                    return (
                      <Button
                        key={choice}
                        variant="outline"
                        className="h-auto min-h-11 max-w-full whitespace-normal break-words"
                        disabled={blocked || recorded}
                        onClick={() => void record(choice)}
                        aria-label={t('wellness.logActivity', 'Log {{name}}', {
                          name: choice,
                        })}
                      >
                        {choice}
                        {recorded
                          ? ` · ${t('wellness.recorded', 'Logged')}`
                          : ''}
                      </Button>
                    );
                  })}
                </div>
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void record(name, true);
                  }}
                >
                  <Label htmlFor="wellness-name">
                    {t('wellness.custom', 'Custom activity')}
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="wellness-name"
                      maxLength={50}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={t('wellness.placeholder', 'Activity name')}
                      disabled={busy}
                      className="min-h-11"
                    />
                    <Button
                      type="submit"
                      className="min-h-11"
                      disabled={blocked || !name.trim()}
                    >
                      {t('wellness.log', 'Log activity')}
                    </Button>
                  </div>
                </form>
              </>
            )}
            <details className="border-t border-border pt-3">
              <summary className="min-h-11 cursor-pointer py-2 font-medium">
                {t('wellness.history', 'History · last 30 days')}
              </summary>
              {entries.length > 0 ? (
                <ul className="space-y-2 pt-2">
                  {entries.map((entry) => (
                    <li
                      key={`${entry.activityId}:${entry.date}`}
                      className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm"
                    >
                      <span className="min-w-0 break-words">{entry.name}</span>
                      <time
                        dateTime={entry.date}
                        className="text-muted-foreground"
                      >
                        {new Date(`${entry.date}T12:00:00`).toLocaleDateString(
                          i18n.language
                        )}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pt-2 text-sm text-muted-foreground">
                  {t(
                    'wellness.historyEmpty',
                    'No wellness activities recorded in this period.'
                  )}
                </p>
              )}
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}
