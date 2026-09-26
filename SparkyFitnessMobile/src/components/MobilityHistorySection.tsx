import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getAppLocale } from '../localization';
import type { MobilitySession } from '../services/mobilityRoutineStore';
import Button from './ui/Button';

type Props = {
  history: MobilitySession[];
  deleting: boolean;
  onDelete: (session: MobilitySession) => void;
};

export default function MobilityHistorySection({
  history,
  deleting,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);
  const locale = getAppLocale();
  const visible = history.slice(0, visibleCount);

  return (
    <View className="gap-3 pt-3">
      <View className="gap-1">
        <Text className="text-xl font-semibold text-text-primary">
          {t('mobility.historyTitle', { defaultValue: 'Session history' })}
        </Text>
        <Text className="text-sm text-text-secondary">
          {t('mobility.historyDescription', {
            defaultValue: 'Review the steps you confirmed or skipped.',
          })}
        </Text>
      </View>
      {history.length === 0 ? (
        <Text className="rounded-2xl bg-raised p-4 text-text-secondary">
          {t('mobility.historyEmpty', {
            defaultValue: 'Your finished and ended sessions will appear here.',
          })}
        </Text>
      ) : (
        <View className="overflow-hidden rounded-2xl bg-raised">
          {visible.map((session, index) => {
            const expanded = expandedId === session.id;
            const date = new Intl.DateTimeFormat(locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(session.endedAt ?? session.startedAt));
            const completed = session.outcomes.filter(
              (outcome) => outcome.result === 'completed'
            ).length;
            const skipped = session.outcomes.length - completed;
            const unrecorded = Math.max(
              0,
              session.routine.steps.length - session.outcomes.length
            );
            return (
              <View
                key={session.id}
                className={index === 0 ? '' : 'border-t border-border-subtle'}
              >
                <Pressable
                  onPress={() => setExpandedId(expanded ? null : session.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={t('mobility.historyReviewSession', {
                    defaultValue: 'Review {{name}} on {{date}}',
                    name: session.routine.name,
                    date,
                  })}
                  className="min-h-20 justify-center gap-1 px-4 py-3"
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <Text className="flex-1 text-base font-semibold text-text-primary">
                      {session.routine.name}
                    </Text>
                    <Text className="text-sm text-text-secondary">
                      {session.state === 'finished'
                        ? t('mobility.historyFinished', {
                            defaultValue: 'Finished',
                          })
                        : t('mobility.historyEndedEarly', {
                            defaultValue: 'Ended early',
                          })}
                    </Text>
                  </View>
                  <Text className="text-sm text-text-secondary">{date}</Text>
                  <Text className="text-sm text-text-secondary">
                    {t('mobility.historyCounts', {
                      defaultValue:
                        '{{completed}} completed · {{skipped}} skipped',
                      completed,
                      skipped,
                    })}
                  </Text>
                </Pressable>
                {expanded ? (
                  <View className="gap-3 border-t border-border-subtle px-4 pb-4 pt-3">
                    {session.outcomes.length === 0 ? (
                      <Text className="text-sm text-text-secondary">
                        {t('mobility.historyNoOutcomes', {
                          defaultValue: 'No steps were recorded.',
                        })}
                      </Text>
                    ) : (
                      session.outcomes.map((outcome) => {
                        const step = session.routine.steps.find(
                          (item) => item.id === outcome.stepId
                        );
                        return (
                          <View
                            key={`${outcome.stepId}:${outcome.recordedAt}`}
                            className="flex-row items-start justify-between gap-3"
                          >
                            <Text className="flex-1 text-sm text-text-primary">
                              {step?.name ??
                                t('mobility.historyUnknownStep', {
                                  defaultValue: 'Unknown step',
                                })}
                            </Text>
                            <Text className="text-sm text-text-secondary">
                              {outcome.result === 'completed'
                                ? t('mobility.historyCompleted', {
                                    defaultValue: 'Completed',
                                  })
                                : t('mobility.historySkipped', {
                                    defaultValue: 'Skipped',
                                  })}
                            </Text>
                          </View>
                        );
                      })
                    )}
                    {unrecorded > 0 ? (
                      <Text className="text-sm text-text-secondary">
                        {t('mobility.historyUnrecorded', {
                          defaultValue: '{{count}} steps not recorded',
                          defaultValue_one: '{{count}} step not recorded',
                          defaultValue_other: '{{count}} steps not recorded',
                          count: unrecorded,
                        })}
                      </Text>
                    ) : null}
                    <Button
                      variant="destructive"
                      disabled={deleting}
                      onPress={() => onDelete(session)}
                    >
                      {t('mobility.historyDelete', {
                        defaultValue: 'Delete session',
                      })}
                    </Button>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
      {history.length > visibleCount ? (
        <Button
          variant="secondary"
          onPress={() => setVisibleCount((count) => count + 10)}
        >
          {t('mobility.historyOlder', {
            defaultValue: 'Show older sessions',
          })}
        </Button>
      ) : null}
    </View>
  );
}
