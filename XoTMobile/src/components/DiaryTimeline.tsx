import { Fragment, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import {
  sortDiaryTimeline,
  type DiaryTimelineItem,
} from '../utils/diaryTimeline';

export interface DiaryTimelineEntry extends DiaryTimelineItem {
  clock: string | null;
  label: string;
  content: ReactNode;
  summary?: ReactNode;
  accessory?: ReactNode;
  collapsible?: boolean;
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
  const sorted = sortDiaryTimeline(entries);
  if (!sorted.length) return null;
  return (
    <View className="mb-4" testID="diary-timeline">
      <View className="mb-3 flex-row items-center gap-2">
        <Text
          accessibilityRole="header"
          className="min-w-0 flex-1 text-lg font-bold text-text-primary"
        >
          {t('diary.timeline.title', { defaultValue: 'Your day' })}
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
      <View className="rounded-2xl border border-border-subtle bg-surface px-3">
        {sorted.map((entry, index) => (
          <Fragment key={entry.id}>
            {entry.timestamp === null &&
              (index === 0 || sorted[index - 1].timestamp !== null) && (
                <Text
                  accessibilityRole="header"
                  className="pt-4 pb-2 text-sm font-semibold text-text-secondary"
                >
                  {t('diary.timeline.withoutTime', {
                    defaultValue: 'Without a recorded time',
                  })}
                </Text>
              )}
            <TimelineRow entry={entry} separated={index > 0} />
          </Fragment>
        ))}
      </View>
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
  return (
    <View
      testID={`diary-event-${entry.id}`}
      className={`py-3 ${separated ? 'border-t border-border-subtle' : ''}`}
    >
      <View className="flex-row items-center gap-2">
        <Pressable
          disabled={!entry.collapsible}
          accessibilityRole={entry.collapsible ? 'button' : undefined}
          accessibilityLabel={entry.label}
          accessibilityState={entry.collapsible ? { expanded } : undefined}
          testID={`diary-expand-${entry.id}`}
          onPress={() => setExpanded(!expanded)}
          className="min-h-11 min-w-0 flex-1 flex-row items-center gap-3"
        >
          {entry.clock && (
            <Text
              className="text-sm font-semibold text-text-secondary"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {entry.clock}
            </Text>
          )}
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-base font-semibold text-text-primary">
              {entry.label}
            </Text>
            {entry.summary}
          </View>
          {entry.collapsible && (
            <Icon
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={accent}
            />
          )}
        </Pressable>
        {entry.accessory}
      </View>
      {(!entry.collapsible || expanded) && (
        <View className="pt-2">{entry.content}</View>
      )}
    </View>
  );
}
