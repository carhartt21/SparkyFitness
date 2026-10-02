import { usePreferences } from '../../hooks/usePreferences';
import { useCoachingCopy } from '../../hooks/useCoachingCopy';
import { useState } from 'react';
import { Text, View, Switch } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  todayInZone,
  coachingFieldLabels,
  coachingChangeField,
  coachingWeekdayFields,
  coachingSelectedWeekdays,
  coachingToggleWeekday,
  coachingNewArrayItem,
  coachingFieldOptions,
  coachingHiddenFields,
  coachingReferenceFields,
  coachingTemplateReference,
  coachingGoalFieldSchema,
  coachingMetricSchema,
  type CoachingAction,
  type CoachingReferenceKind,
  createCoachingClient,
} from '@workspace/shared';
import FormInput from '../FormInput';
import BottomSheetPicker from '../BottomSheetPicker';
import NeonButton from '../ui/NeonButton';
import { newUuid } from '../../utils/ids';

type Json = z.infer<ReturnType<typeof z.json>>;
type Api = ReturnType<typeof createCoachingClient>;
function Reference({
  kind,
  value,
  onChange,
  api,
  scope,
  title,
}: {
  kind: CoachingReferenceKind;
  value: Json;
  onChange: (value: Json, reference?: Json) => void;
  api: Api;
  scope: string;
  title: string;
}) {
  const { t } = useTranslation(),
    [search, setSearch] = useState('');
  const query = useInfiniteQuery({
    queryKey: ['coaching', scope, 'choices', kind, search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.loadCoachingPlanning(kind, search, pageParam),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  });
  const choices = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <View className="gap-2">
      <FormInput
        accessibilityLabel={t('coaching.search', {
          defaultValue: 'Search available items',
        })}
        value={search}
        onChangeText={setSearch}
      />
      <BottomSheetPicker
        title={title}
        value={value === null ? '' : String(value)}
        options={[
          {
            label: t('coaching.newItem', {
              defaultValue: 'Choose an item, or leave blank to create new',
            }),
            value: '',
          },
          ...choices.map((item) => ({ label: item.label, value: item.id })),
        ]}
        onSelect={(next) =>
          onChange(
            next
              ? kind === 'workout_plan' || kind === 'workout_preset'
                ? Number(next)
                : next
              : null,
            choices.find((item) => item.id === next)?.data
          )
        }
      />
      {query.isError && (
        <Text accessibilityRole="alert" className="text-text-primary">
          {t('coaching.choicesError', {
            defaultValue: 'Could not load available items. Try again.',
          })}
        </Text>
      )}
      {query.hasNextPage && (
        <NeonButton
          label={t('coaching.more', { defaultValue: 'Load more' })}
          variant="outline"
          onPress={() => {
            void query.fetchNextPage();
          }}
        />
      )}
    </View>
  );
}
const numericFields = new Set([
  'baseline',
  'target',
  'minimumCoverage',
  'before',
  'after',
  'quantity',
  'planned_duration_minutes',
  'planned_distance_km',
  'day_of_week',
  'session_index',
  'sort_order',
  'set_number',
  'reps',
  'weight',
  'duration',
  'rest_time',
  'durationSeconds',
  'transitionSeconds',
  'step',
  'daily_limit',
  'hydration_interval_hours',
]);
export default function CoachingFields({
  value,
  onChange,
  action,
  field = '',
  readOnly = false,
  api,
  scope,
}: {
  value: Json;
  onChange?: (value: Json, reference?: Json) => void;
  action?: CoachingAction;
  field?: string;
  readOnly?: boolean;
  api: Api;
  scope: string;
}) {
  const { t, i18n } = useTranslation();
  const copy = useCoachingCopy();
  const { preferences } = usePreferences();
  if (field === 'habit_type' && action?.kind === 'habit' && action.habitId)
    readOnly = true;
  if (
    coachingHiddenFields.has(field) &&
    !(field === 'kind' && (value === 'timed' || value === 'repetitions'))
  )
    return null;
  const title = copy(
    `coaching.fields.${field}`,
    coachingFieldLabels[field] ?? field.replaceAll('_', ' ')
  );
  if (!readOnly && field === 'schedule' && value === null)
    return (
      <NeonButton
        variant="outline"
        label={t('coaching.enableSchedule', { defaultValue: 'Add schedule' })}
        onPress={() =>
          onChange?.({
            weekdays: [1, 3, 5],
            time: '18:00',
            startDay: todayInZone(preferences?.timezone ?? 'UTC'),
            endDay: null,
            enabled: true,
          })
        }
      />
    );
  if (coachingWeekdayFields.has(field)) {
    const selected = coachingSelectedWeekdays(value);
    return (
      <View className="gap-2">
        <Text className="text-base font-medium text-text-primary">{title}</Text>
        <View className="gap-2">
          {Array.from({ length: 7 }, (_, day) => {
            const label = new Intl.DateTimeFormat(i18n.language, {
              weekday: 'long',
              timeZone: 'UTC',
            }).format(new Date(Date.UTC(2026, 8, 27 + day)));
            return (
              <View
                key={day}
                className="min-h-11 flex-row items-center justify-between gap-3"
              >
                <Text className="flex-1 text-base text-text-primary">
                  {label}
                </Text>
                <Switch
                  accessibilityLabel={`${title}: ${label}`}
                  value={selected.includes(day)}
                  disabled={readOnly}
                  onValueChange={() =>
                    onChange?.(coachingToggleWeekday(value, day))
                  }
                />
              </View>
            );
          })}
        </View>
      </View>
    );
  }
  if (Array.isArray(value))
    return (
      <View className="gap-3">
        {field && (
          <Text className="text-base font-semibold text-text-primary">
            {title}
          </Text>
        )}
        {value.map((item, index) => (
          <View
            key={index}
            className="gap-3 rounded-xl border border-border-subtle p-3"
          >
            <CoachingFields
              value={item}
              field=""
              action={action}
              readOnly={readOnly}
              api={api}
              scope={scope}
              onChange={(next) =>
                onChange?.(value.map((row, i) => (i === index ? next : row)))
              }
            />
            {!readOnly && (
              <NeonButton
                variant="subtle"
                label={t('coaching.remove', { defaultValue: 'Remove item' })}
                onPress={() => onChange?.(value.filter((_, i) => i !== index))}
              />
            )}
          </View>
        ))}
        {!readOnly &&
          (value.length > 0 ||
            coachingNewArrayItem(field, action, () => '')) && (
            <NeonButton
              variant="outline"
              label={t('coaching.add', { defaultValue: 'Add item' })}
              onPress={() => {
                const clone = value.length
                  ? (JSON.parse(JSON.stringify(value.at(-1))) as Json)
                  : coachingNewArrayItem(field, action, newUuid);
                if (
                  clone &&
                  typeof clone === 'object' &&
                  !Array.isArray(clone) &&
                  'id' in clone
                )
                  clone['id'] = newUuid();
                onChange?.([...value, clone]);
              }}
            />
          )}
      </View>
    );
  if (value !== null && typeof value === 'object')
    return (
      <View className="gap-4">
        {Object.entries(value).map(([key, item]) => (
          <CoachingFields
            key={key}
            value={item}
            field={key}
            action={action}
            readOnly={readOnly}
            api={api}
            scope={scope}
            onChange={(next, reference) =>
              onChange?.(coachingChangeField(value, key, next, reference))
            }
          />
        ))}
      </View>
    );
  if (readOnly)
    return (
      <View className="gap-1">
        <Text className="text-sm text-text-secondary">{title}</Text>
        <Text selectable className="text-base text-text-primary">
          {value === null
            ? t('coaching.none', { defaultValue: 'Not set' })
            : typeof value === 'number'
              ? new Intl.NumberFormat(i18n.language, {
                  maximumFractionDigits: 3,
                }).format(value)
              : typeof value === 'boolean'
                ? value
                  ? t('coaching.yes', { defaultValue: 'Yes' })
                  : t('coaching.no', { defaultValue: 'No' })
                : String(value)}
        </Text>
      </View>
    );
  const reference =
      coachingReferenceFields[field] ??
      (field === 'templateId' && action
        ? coachingTemplateReference(action)
        : null),
    options =
      field === 'field'
        ? coachingGoalFieldSchema.options
        : field === 'metric'
          ? coachingMetricSchema.options
          : coachingFieldOptions[field];
  return (
    <View className="gap-2">
      <Text className="text-base font-medium text-text-primary">{title}</Text>
      {reference ? (
        <Reference
          kind={reference}
          value={value}
          onChange={(next, reference) => onChange?.(next, reference)}
          api={api}
          scope={scope}
          title={title}
        />
      ) : typeof value === 'boolean' ? (
        <Switch
          accessibilityLabel={title}
          value={value}
          onValueChange={(next) => onChange?.(next)}
        />
      ) : options ? (
        <BottomSheetPicker
          title={title}
          value={value === null ? '' : String(value)}
          options={options.map((option) => ({
            label: copy(
              `coaching.options.${option}`,
              coachingFieldLabels[option] ?? option.replaceAll('_', ' ')
            ),
            value: option,
          }))}
          onSelect={(next) => onChange?.(next)}
        />
      ) : (
        <FormInput
          accessibilityLabel={title}
          value={value === null ? '' : String(value)}
          keyboardType={
            typeof value === 'number' || numericFields.has(field)
              ? 'decimal-pad'
              : 'default'
          }
          onChangeText={(next) =>
            onChange?.(
              typeof value === 'number' || numericFields.has(field)
                ? next === ''
                  ? null
                  : Number(next.replace(',', '.'))
                : next === '' && value === null
                  ? null
                  : next
            )
          }
        />
      )}
    </View>
  );
}
