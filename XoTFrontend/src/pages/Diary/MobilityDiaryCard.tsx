import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Activity, ChevronRight } from 'lucide-react';
import { recordedMobilitySessionsOn } from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { useMobility } from '@/hooks/Mobility/useMobility';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function MobilityDiaryCard({ date }: { date: string }) {
  const { t, i18n } = useTranslation();
  const { timezone } = usePreferences();
  const { isActingOnBehalf } = useActiveUser();
  const { query } = useMobility(date, date);
  const sessions = recordedMobilitySessionsOn(
    (query.data?.sessions ?? [])
      .filter((row) => !row.deleted)
      .map((row) => row.data),
    date,
    query.data?.timezone ?? timezone
  );
  if (isActingOnBehalf || (sessions.length === 0 && !query.isError))
    return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" aria-hidden="true" />
          {t('mobilityDiary.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                to="/mobility"
                className="flex min-h-16 items-center gap-3 rounded-lg py-3 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold">
                    {session.routine.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat(i18n.language, {
                      hour: '2-digit',
                      minute: '2-digit',
                      hourCycle: 'h23',
                      timeZone: query.data?.timezone ?? timezone,
                    }).format(new Date(session.startedAt))}{' '}
                    ·{' '}
                    {t('mobilityDiary.counts', {
                      completed: session.outcomes.filter(
                        (outcome) => outcome.result === 'completed'
                      ).length,
                      skipped: session.outcomes.filter(
                        (outcome) => outcome.result === 'skipped'
                      ).length,
                    })}
                  </p>
                  {session.state === 'cancelled' ? (
                    <p className="text-sm text-muted-foreground">
                      {t('mobilityDiary.endedEarly')}
                    </p>
                  ) : null}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        {query.isError ? (
          <div role="alert" className="space-y-2">
            <p>{t('mobilityDiary.loadError')}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
