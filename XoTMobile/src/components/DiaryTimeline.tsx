import { Fragment, useState, type ReactNode } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon, { type IconName } from './Icon';
import {
  sortDiaryTimeline,
  type DiaryTimelineItem,
} from '../utils/diaryTimeline';

export interface DiaryTimelineEntry extends DiaryTimelineItem {
  clock: string | null;
  label: string;
  content: ReactNode;
  /** The same localized value is rendered and announced; do not hide data in a JSX label. */
  summary?: string;
  accessory?: ReactNode;
  collapsible?: boolean;
  section?: 'recorded' | 'planned';
  icon?: IconName;
  onPress?: () => void;
}

export default function DiaryTimeline({
  entries,
  onEditFoods,
}: {
  entries: DiaryTimelineEntry[];
  onEditFoods?: () => void;
}) {
  const { t } = useTranslation();
  const accentColor = useCSSVariable('--color-accent-primary') as string;
  if (!entries.length) return null;
  return (
    <View className="mb-4" testID="diary-timeline">
      <View className="mb-3 flex-row items-center gap-2">
        <Text
          accessibilityRole="header"
          className="min-w-0 flex-1 text-lg font-bold text-text-primary"
        >
          {t('diary.timeline.recorded', { defaultValue: 'Recorded' })}
        </Text>
        {onEditFoods && (
          <Pressable
            testID="diary-edit-foods"
            accessibilityRole="button"
            accessibilityLabel={t('diary.bulk.edit', { defaultValue: 'Edit' })}
            onPress={onEditFoods}
            className="min-h-11 min-w-11 items-center justify-center"
          >
            <Icon name="pencil" size={20} color={accentColor} />
          </Pressable>
        )}
      </View>
      {(['recorded', 'planned'] as const).map((section) => {
        const sorted = sortDiaryTimeline(
          entries.filter((entry) => (entry.section ?? 'recorded') === section)
        );
        if (!sorted.length) return null;
        return (
          <Fragment key={section}>
            {section === 'planned' && (
              <Text
                accessibilityRole="header"
                className="mt-5 mb-3 text-lg font-bold text-text-primary"
              >
                {t('diary.timeline.plannedSection', {
                  defaultValue: 'Planned',
                })}
              </Text>
            )}
            <View
              testID={`diary-${section}`}
              className="rounded-2xl border border-border-subtle bg-surface px-3"
            >
              {sorted.map((entry, index) => (
                <Fragment key={entry.id}>
                  {entry.timestamp === null &&
                    (index === 0 || sorted[index - 1].timestamp !== null) && (
                      <Text
                        accessibilityRole="header"
                        className="pt-4 pb-2 text-sm font-semibold text-text-secondary"
                      >
                        {section === 'planned'
                          ? t('diary.timeline.withoutPlannedTime', {
                              defaultValue: 'Without a scheduled time',
                            })
                          : t('diary.timeline.withoutTime', {
                              defaultValue: 'Without a recorded time',
                            })}
                      </Text>
                    )}
                  <TimelineRow entry={entry} separated={index > 0} />
                </Fragment>
              ))}
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

function TimelineRow({
  entry,
  separated,
}: {
  entry: DiaryTimelineEntry;
  separated: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const accent = useCSSVariable('--color-accent-primary') as string;
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;
  return (
    <View
      testID={`diary-event-${entry.id}`}
      className={`py-3 ${separated ? 'border-t border-border-subtle' : ''}`}
    >
      <View className="flex-row items-center gap-2">
        <Pressable
          disabled={!entry.collapsible && !entry.onPress}
          accessibilityRole={
            entry.collapsible || entry.onPress ? 'button' : undefined
          }
          accessibilityLabel={[entry.clock, entry.label, entry.summary]
            .filter(Boolean)
            .join(', ')}
          accessibilityState={entry.collapsible ? { expanded } : undefined}
          testID={`diary-expand-${entry.id}`}
          onPress={() =>
            entry.onPress ? entry.onPress() : setExpanded(!expanded)
          }
          className="min-h-11 min-w-0 flex-1 flex-row items-center gap-3"
        >
          {!stacked && (
            <View style={{ width: 44 }}>
              {entry.clock && (
                <Text
                  className="text-sm font-semibold text-text-secondary"
                  numberOfLines={1}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {entry.clock}
                </Text>
              )}
            </View>
          )}
          <Icon name={entry.icon ?? 'list'} size={20} color={accent} />
          <View className="min-w-0 flex-1 gap-1">
            {stacked && entry.clock && (
              <Text
                className="text-sm font-semibold text-text-secondary"
                numberOfLines={1}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {entry.clock}
              </Text>
            )}
            <Text className="text-base font-semibold text-text-primary">
              {entry.label}
            </Text>
            {entry.summary && (
              <Text className="text-sm text-text-secondary">
                {entry.summary}
              </Text>
            )}
          </View>
          {(entry.collapsible || entry.onPress) && (
            <Icon
              name={
                entry.onPress
                  ? 'chevron-forward'
                  : expanded
                    ? 'chevron-up'
                    : 'chevron-down'
              }
              size={18}
              color={accent}
            />
          )}
        </Pressable>
        {entry.accessory}
      </View>
      {!entry.onPress && (!entry.collapsible || expanded) && (
        <View className="pt-2">{entry.content}</View>
      )}
    </View>
  );
}
