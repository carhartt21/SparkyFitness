import { useId, useState } from 'react';
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
} from '@workspace/shared';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useCoachingPlanning } from '@/hooks/Coaching/useCoaching';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Json = z.infer<ReturnType<typeof z.json>>;
const numericFields = new Set([
  'baseline',
  'target',
  'minimumCoverage',
  'before',
  'after',
  'quantity',
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
  'target_value',
  'step',
  'daily_limit',
  'hydration_interval_hours',
]);
function ReferencePicker({
  kind,
  value,
  onChange,
}: {
  kind: CoachingReferenceKind;
  value: Json;
  onChange: (value: Json, reference?: Json) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const query = useCoachingPlanning(kind, search);
  const choices = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="space-y-2">
      <Input
        aria-label={t('coaching.search', {
          defaultValue: 'Search available items',
        })}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <select
        className="min-h-11 w-full rounded-md border bg-background px-3"
        value={value === null ? '' : String(value)}
        onChange={(event) =>
          onChange(
            event.target.value
              ? kind === 'workout_plan' || kind === 'workout_preset'
                ? Number(event.target.value)
                : event.target.value
              : null,
            choices.find((item) => item.id === event.target.value)?.data
          )
        }
      >
        <option value="">
          {t('coaching.newItem', {
            defaultValue: 'Choose an item, or leave blank to create new',
          })}
        </option>
        {value !== null &&
          !choices.some((item) => item.id === String(value)) && (
            <option value={String(value)}>
              {t('coaching.selectedItem', {
                defaultValue: 'Current selected item',
              })}
            </option>
          )}
        {choices.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      {query.isError && (
        <p role="alert">
          {t('coaching.choicesError', {
            defaultValue: 'Could not load available items. Try again.',
          })}
        </p>
      )}
      {query.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {t('coaching.more', { defaultValue: 'Load more' })}
        </Button>
      )}
    </div>
  );
}
export function ActionFields({
  value,
  onChange,
  action,
  field = '',
  readOnly = false,
}: {
  value: Json;
  onChange?: (value: Json, reference?: Json) => void;
  action?: CoachingAction;
  field?: string;
  readOnly?: boolean;
}) {
  const { t, i18n } = useTranslation(),
    id = useId();
  const { timezone } = usePreferences();
  if (field === 'habit_type' && action?.kind === 'habit' && action.habitId)
    readOnly = true;
  const label = coachingFieldLabels[field] ?? field.replaceAll('_', ' ');
  const title = t(`coaching.fields.${field}`, { defaultValue: label });
  if (
    coachingHiddenFields.has(field) &&
    !(field === 'kind' && (value === 'timed' || value === 'repetitions'))
  )
    return null;
  if (!readOnly && field === 'schedule' && value === null)
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange?.({
            weekdays: [1, 3, 5],
            time: '18:00',
            startDay: todayInZone(timezone),
            endDay: null,
            enabled: true,
          })
        }
      >
        {t('coaching.enableSchedule', { defaultValue: 'Add schedule' })}
      </Button>
    );
  if (coachingWeekdayFields.has(field)) {
    const selected = coachingSelectedWeekdays(value);
    return (
      <fieldset className="space-y-2">
        <legend className="font-medium">{title}</legend>
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 7 }, (_, day) => (
            <label key={day} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={selected.includes(day)}
                onChange={() => onChange?.(coachingToggleWeekday(value, day))}
              />
              {new Intl.DateTimeFormat(i18n.language, {
                weekday: 'short',
                timeZone: 'UTC',
              }).format(new Date(Date.UTC(2026, 8, 27 + day)))}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  if (Array.isArray(value)) {
    return (
      <fieldset className="space-y-3">
        <legend className="mb-2 font-medium">{title}</legend>
        {value.map((item, index) => (
          <div key={index} className="rounded-xl border p-3">
            <ActionFields
              value={item}
              field=""
              action={action}
              readOnly={readOnly}
              onChange={(next) =>
                onChange?.(value.map((row, i) => (i === index ? next : row)))
              }
            />
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onChange?.(value.filter((_, i) => i !== index))}
              >
                {t('coaching.remove', { defaultValue: 'Remove item' })}
              </Button>
            )}
          </div>
        ))}
        {!readOnly &&
          (value.length > 0 ||
            coachingNewArrayItem(field, action, () => '')) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const clone = value.length
                  ? structuredClone(value.at(-1))
                  : coachingNewArrayItem(field, action, () =>
                      crypto.randomUUID()
                    );
                if (
                  clone &&
                  typeof clone === 'object' &&
                  !Array.isArray(clone) &&
                  'id' in clone
                )
                  clone['id'] = crypto.randomUUID();
                onChange?.([...value, clone ?? null]);
              }}
            >
              {t('coaching.add', { defaultValue: 'Add item' })}
            </Button>
          )}
      </fieldset>
    );
  }
  if (value !== null && typeof value === 'object')
    return (
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {Object.entries(value).map(([key, item]) => (
          <div
            key={key}
            className={
              item !== null && typeof item === 'object'
                ? 'min-w-0 sm:col-span-2'
                : 'min-w-0'
            }
          >
            <ActionFields
              value={item}
              field={key}
              action={action}
              readOnly={readOnly}
              onChange={(next, reference) =>
                onChange?.(coachingChangeField(value, key, next, reference))
              }
            />
          </div>
        ))}
      </div>
    );
  if (readOnly)
    return (
      <dl className="min-w-0">
        <dt className="text-sm text-muted-foreground">{title}</dt>
        <dd className="break-words">
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
        </dd>
      </dl>
    );
  const reference =
    coachingReferenceFields[field] ??
    (field === 'templateId' && action
      ? coachingTemplateReference(action)
      : null);
  const options =
    field === 'field'
      ? coachingGoalFieldSchema.options
      : field === 'metric'
        ? coachingMetricSchema.options
        : coachingFieldOptions[field];
  const type = /date|Day$/.test(field)
    ? 'date'
    : /time|Time$|quiet_|_start$|_end$/.test(field) && !field.includes('date')
      ? 'time'
      : typeof value === 'number' || numericFields.has(field)
        ? 'number'
        : 'text';
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{title}</Label>
      {reference ? (
        <ReferencePicker
          kind={reference}
          value={value}
          onChange={(next, reference) => onChange?.(next, reference)}
        />
      ) : typeof value === 'boolean' ? (
        <input
          id={id}
          type="checkbox"
          className="h-5 w-5"
          checked={value}
          onChange={(event) => onChange?.(event.target.checked)}
        />
      ) : options ? (
        <select
          id={id}
          className="min-h-11 w-full rounded-md border bg-background px-3"
          value={value === null ? '' : String(value)}
          onChange={(event) => onChange?.(event.target.value || null)}
        >
          <option value="">
            {t('coaching.none', { defaultValue: 'Not set' })}
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {t(`coaching.options.${option}`, {
                defaultValue:
                  coachingFieldLabels[option] ?? option.replaceAll('_', ' '),
              })}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={id}
          type={type}
          step={type === 'number' ? 'any' : undefined}
          value={value === null ? '' : String(value)}
          onChange={(event) =>
            onChange?.(
              type === 'number'
                ? event.target.value === ''
                  ? null
                  : Number(event.target.value)
                : event.target.value === '' && value === null
                  ? null
                  : event.target.value
            )
          }
        />
      )}
    </div>
  );
}
