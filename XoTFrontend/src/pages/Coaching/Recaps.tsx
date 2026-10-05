import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCoachingActions,
  useCoachingRecaps,
  useCoachingRecap,
  useCoachingRefresh,
} from '@/hooks/Coaching/useCoaching';
import { Button } from '@/components/ui/button';
import { GlowCard } from '@/components/ui/glow-card';
import { ActionFields } from './ActionFields';

export function Recaps({
  onRecommendations,
}: {
  onRecommendations: () => void;
}) {
  const { t, i18n } = useTranslation(),
    api = useCoachingActions(),
    refresh = useCoachingRefresh();
  const [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const query = useCoachingRecaps();
  const detail = useCoachingRecap(selected);
  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(false);
    try {
      await work();
      await refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const date = (day: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${day}T12:00:00Z`));
  const recap = detail.data;
  return (
    <section className="space-y-4">
      <p className="text-muted-foreground">
        {t('coachingLoop.recapHint', {
          defaultValue:
            'Your reviews stay here until you delete them. Suggestions always need your approval.',
        })}
      </p>
      {(query.isError || detail.isError || error) && (
        <p role="alert">
          {t('coaching.error', {
            defaultValue: 'Could not save. Refresh and try again.',
          })}
        </p>
      )}
      {(query.isPending || (selected && detail.isPending)) && (
        <p role="status">
          {t('coaching.loading', { defaultValue: 'Loading…' })}
        </p>
      )}
      {recap && (
        <GlowCard as="article" className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            {t(`coaching.options.${recap.kind}`, { defaultValue: recap.kind })}{' '}
            · {date(recap.from)} – {date(recap.to)}
          </p>
          <h2 className="text-2xl font-semibold">{recap.title}</h2>
          <p className="whitespace-pre-wrap break-words">{recap.summary}</p>
          <ul className="list-disc space-y-2 pl-5">
            {recap.observations.map((item, index) => (
              <li key={index}>{item.text}</li>
            ))}
          </ul>
          {recap.limitations.length > 0 && (
            <h3 className="font-semibold">
              {t('coachingLoop.limitations', {
                defaultValue: 'What this review cannot establish',
              })}
            </h3>
          )}
          {recap.limitations.map((text, index) => (
            <p key={index} className="text-sm text-muted-foreground">
              {text}
            </p>
          ))}
          <details>
            <summary className="min-h-11 cursor-pointer">
              {t('coaching.evidence', {
                defaultValue: 'Evidence and limitations',
              })}
            </summary>
            <div className="space-y-3">
              {recap.evidence.map((row) => (
                <details key={row.id} className="rounded-xl border p-3">
                  <summary className="break-words">
                    {row.source} · {row.day ?? '—'}
                  </summary>
                  <ActionFields value={row.value} readOnly />
                </details>
              ))}
            </div>
          </details>
          <div className="flex flex-wrap gap-2">
            {recap.proposalIds.length > 0 && (
              <Button onClick={onRecommendations}>
                {t('coachingLoop.seeSuggestions', {
                  defaultValue: 'Review suggestions',
                })}
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelected(null)}>
              {t('coaching.close', { defaultValue: 'Close' })}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    t('coachingLoop.deleteHint', {
                      defaultValue:
                        'This deletes only the recap. Your logged data and recommendations remain.',
                    })
                  )
                )
                  void act(async () => {
                    await api.deleteCoachingRecap(recap.id);
                    setSelected(null);
                  });
              }}
            >
              {t('coachingLoop.deleteRecap', { defaultValue: 'Delete recap' })}
            </Button>
          </div>
        </GlowCard>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {query.data?.pages
          .flatMap((page) => page.recaps)
          .map((item) => (
            <GlowCard key={item.id} as="article" className="space-y-3 p-5">
              <p className="text-sm text-muted-foreground">
                {t(`coaching.options.${item.kind}`, {
                  defaultValue: item.kind,
                })}{' '}
                · {date(item.from)} – {date(item.to)}
                {!item.readAt
                  ? ` · ${t('coachingLoop.unread', { defaultValue: 'Unread' })}`
                  : ''}
              </p>
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="line-clamp-3 break-words text-muted-foreground">
                {item.summary}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSelected(item.id);
                  if (!item.readAt)
                    void act(() => api.readCoachingRecap(item.id));
                }}
              >
                {t('coachingLoop.openRecap', { defaultValue: 'Open recap' })}
              </Button>
            </GlowCard>
          ))}
      </div>
      {query.data && !query.data.pages[0]?.recaps.length && (
        <p>
          {t('coachingLoop.noRecaps', {
            defaultValue:
              'No recaps yet. Connect ChatGPT and test a review. A successful review appears here even when no change is suggested.',
          })}
        </p>
      )}
      {query.hasNextPage && (
        <Button
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          {t('coaching.more', { defaultValue: 'Load more' })}
        </Button>
      )}
    </section>
  );
}
