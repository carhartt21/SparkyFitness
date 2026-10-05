import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useCoaching } from '../../hooks/useCoaching';
import { useCoachingCopy } from '../../hooks/useCoachingCopy';
import GlowCard from '../ui/GlowCard';
import NeonButton from '../ui/NeonButton';
import CoachingFields from './CoachingFields';

type Api = ReturnType<typeof useCoaching>['api'];
export default function Recaps({
  api,
  scope,
  onRecommendations,
}: {
  api: Api;
  scope: string;
  onRecommendations: () => void;
}) {
  const { t, i18n } = useTranslation(),
    copy = useCoachingCopy(),
    client = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [showEvidence, setShowEvidence] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ['coaching', scope, 'recaps'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.loadCoachingRecaps(pageParam),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  });
  const detail = useQuery({
    queryKey: ['coaching', scope, 'recap', selected],
    queryFn: () => api.loadCoachingRecap(selected!),
    enabled: !!selected,
  });
  const mutate = (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(false);
    void work()
      .then(() => client.invalidateQueries({ queryKey: ['coaching', scope] }))
      .catch(() => setError(true))
      .finally(() => setBusy(false));
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
    <View className="gap-4">
      <Text className="text-base text-text-secondary">
        {t('coachingLoop.recapHint', {
          defaultValue:
            'Your reviews stay here until you delete them. Suggestions always need your approval.',
        })}
      </Text>
      {(query.isError || detail.isError || error) && (
        <Text accessibilityRole="alert" className="text-text-primary">
          {t('coaching.error', {
            defaultValue: 'Could not save. Refresh and try again.',
          })}
        </Text>
      )}
      {query.isPending && (
        <Text className="text-text-secondary">
          {t('coaching.loading', { defaultValue: 'Loading…' })}
        </Text>
      )}
      {selected && detail.isPending && (
        <Text className="text-text-secondary">
          {t('coaching.loading', { defaultValue: 'Loading…' })}
        </Text>
      )}
      {recap && (
        <GlowCard className="gap-4 p-4">
          <Text
            accessibilityRole="header"
            className="text-xl font-semibold text-text-primary"
          >
            {recap.title}
          </Text>
          <Text className="text-sm text-text-secondary">
            {copy(`coaching.options.${recap.kind}`, recap.kind)} ·{' '}
            {date(recap.from)} – {date(recap.to)}
          </Text>
          <Text className="text-base text-text-primary">{recap.summary}</Text>
          {recap.observations.map((item, index) => (
            <Text key={index} className="text-base text-text-primary">
              {item.text}
            </Text>
          ))}
          {recap.limitations.length > 0 && (
            <Text className="font-semibold text-text-primary">
              {t('coachingLoop.limitations', {
                defaultValue: 'What this review cannot establish',
              })}
            </Text>
          )}
          {recap.limitations.map((text, index) => (
            <Text key={index} className="text-sm text-text-secondary">
              {text}
            </Text>
          ))}
          <NeonButton
            variant="outline"
            label={t('coaching.evidence', {
              defaultValue: 'Evidence and limitations',
            })}
            onPress={() => setShowEvidence(!showEvidence)}
          />
          {showEvidence &&
            recap.evidence.map((row) => (
              <View
                key={row.id}
                className="gap-2 rounded-xl border border-border-subtle p-3"
              >
                <Text className="text-sm text-text-secondary">
                  {row.source} · {row.day ?? '—'}
                </Text>
                <CoachingFields
                  value={row.value}
                  readOnly
                  api={api}
                  scope={scope}
                />
              </View>
            ))}
          {recap.proposalIds.length > 0 && (
            <NeonButton
              label={t('coachingLoop.seeSuggestions', {
                defaultValue: 'Review suggestions',
              })}
              onPress={onRecommendations}
            />
          )}
          <NeonButton
            variant="outline"
            label={t('coaching.close', { defaultValue: 'Close' })}
            onPress={() => setSelected(null)}
          />
          <NeonButton
            variant="outline"
            disabled={busy}
            label={t('coachingLoop.deleteRecap', {
              defaultValue: 'Delete recap',
            })}
            onPress={() =>
              Alert.alert(
                t('coachingLoop.deleteRecap', { defaultValue: 'Delete recap' }),
                t('coachingLoop.deleteHint', {
                  defaultValue:
                    'This deletes only the recap. Your logged data and recommendations remain.',
                }),
                [
                  {
                    text: t('common.cancel', { defaultValue: 'Cancel' }),
                    style: 'cancel',
                  },
                  {
                    text: t('common.delete', { defaultValue: 'Delete' }),
                    style: 'destructive',
                    onPress: () =>
                      mutate(async () => {
                        await api.deleteCoachingRecap(recap.id);
                        setSelected(null);
                      }),
                  },
                ]
              )
            }
          />
        </GlowCard>
      )}
      {query.data?.pages
        .flatMap((page) => page.recaps)
        .map((item) => (
          <GlowCard
            key={item.id}
            className="gap-3 p-4"
            onPress={() => {
              setSelected(item.id);
              setShowEvidence(false);
              if (!item.readAt) mutate(() => api.readCoachingRecap(item.id));
            }}
            accessibilityLabel={item.title}
          >
            <Text className="text-sm text-text-secondary">
              {copy(`coaching.options.${item.kind}`, item.kind)} ·{' '}
              {date(item.from)} – {date(item.to)}
              {!item.readAt
                ? ` · ${t('coachingLoop.unread', { defaultValue: 'Unread' })}`
                : ''}
            </Text>
            <Text
              accessibilityRole="header"
              className="text-lg font-semibold text-text-primary"
            >
              {item.title}
            </Text>
            <Text numberOfLines={3} className="text-base text-text-secondary">
              {item.summary}
            </Text>
          </GlowCard>
        ))}
      {query.data && !query.data.pages[0]?.recaps.length && (
        <Text className="text-text-secondary">
          {t('coachingLoop.noRecaps', {
            defaultValue:
              'No recaps yet. Connect ChatGPT and test a review. A successful review appears here even when no change is suggested.',
          })}
        </Text>
      )}
      {query.hasNextPage && (
        <NeonButton
          variant="outline"
          label={t('coaching.more', { defaultValue: 'Load more' })}
          disabled={query.isFetchingNextPage}
          onPress={() => {
            void query.fetchNextPage();
          }}
        />
      )}
    </View>
  );
}
