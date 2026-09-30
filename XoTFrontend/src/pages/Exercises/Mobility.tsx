import { useState, useEffect, useRef } from 'react';
import {
  useMobility,
  useMobilityExerciseSearch,
} from '@/hooks/Mobility/useMobility';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  todayInZone,
  mobilityOperationSchema,
  type MobilityRoutine,
  type MobilityStep,
  type MobilityOperation,
} from '@workspace/shared';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import type { Exercise } from '@/types/exercises';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlowCard } from '@/components/ui/glow-card';
const uuid = () => crypto.randomUUID();
const newStep = (): MobilityStep => ({
  id: uuid(),
  name: '',
  instructions: '',
  side: 'both',
  kind: 'timed',
  durationSeconds: 30,
  transitionSeconds: 0,
});
export default function Mobility() {
  const { t, i18n } = useTranslation();
  const { isActingOnBehalf } = useActiveUser();
  const { timezone } = usePreferences();
  const today = todayInZone(timezone);
  const attempt = useRef<MobilityOperation | null>(null);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 30));
  const { query, mutation } = useMobility(from, to);
  const [routine, setRoutine] = useState<MobilityRoutine | null>(null);
  const [selected, setSelected] = useState('');
  const [time, setTime] = useState('18:00');
  const [day, setDay] = useState(today);
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [endDay, setEndDay] = useState('');
  const [validation, setValidation] = useState(false);
  const [planDraftId, setPlanDraftId] = useState(uuid);
  const [scheduleDraftId, setScheduleDraftId] = useState(uuid);
  const [editingSchedule, setEditingSchedule] = useState<{
    id: string;
    revision: number;
  } | null>(null);
  const editingId = routine?.id;
  useEffect(() => {
    if (!editingId) return;
    const editor = document.getElementById('mobility-editor');
    editor?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'start',
    });
    document.getElementById('routine-name')?.focus({ preventScroll: true });
  }, [editingId]);
  const rows = query.data?.routines.filter((row) => !row.deleted) ?? [];
  const labels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(i18n.language, {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2026, 8, 27 + index)))
  );
  const submit = async (operation: MobilityOperation) => {
    const parsed = mobilityOperationSchema.safeParse(operation);
    setValidation(!parsed.success);
    if (!parsed.success) return false;
    try {
      const previous = attempt.current;
      const value =
        previous &&
        JSON.stringify(previous.mutation) ===
          JSON.stringify(parsed.data.mutation) &&
        previous.expectedRevision === parsed.data.expectedRevision
          ? previous
          : parsed.data;
      attempt.current = value;
      await mutation.mutateAsync(value);
      attempt.current = null;
      return true;
    } catch {
      return false;
    }
  };
  const patchStep = (id: string, patch: Partial<MobilityStep>) =>
    setRoutine((current) =>
      current
        ? {
            ...current,
            steps: current.steps.map((step) =>
              step.id === id ? ({ ...step, ...patch } as MobilityStep) : step
            ),
          }
        : null
    );
  if (isActingOnBehalf)
    return (
      <main className="p-6">
        <p role="status">
          {t('mobilityWeb.ownerOnly', {
            defaultValue:
              'Mobility planning is available only for your own account. Switch back to your account to continue.',
          })}
        </p>
      </main>
    );
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 [&_button]:min-h-11 [&_input]:min-h-11">
      <header>
        <h1 className="text-2xl font-semibold">
          {t('mobilityWeb.title', { defaultValue: 'Mobility' })}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {t('mobilityWeb.intro', {
            defaultValue:
              'Plan mobility here or through MCP, then run sessions on your phone. Routine edits do not alter active or historical snapshots.',
          })}
        </p>
      </header>
      {(query.isError || mutation.isError || validation) && (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-destructive p-4"
        >
          <p>{t(validation ? 'mobilityWeb.invalid' : 'mobilityWeb.failed')}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t('mobilityWeb.reload', { defaultValue: 'Reload' })}
          </Button>
        </div>
      )}
      {query.isPending && (
        <p aria-live="polite">
          {t('common.loading', { defaultValue: 'Loading...' })}
        </p>
      )}
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
        <GlowCard className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">
              {t('mobilityWeb.routines', { defaultValue: 'Routines' })}
            </h2>
            <Button
              onClick={() =>
                setRoutine({
                  id: uuid(),
                  name: '',
                  steps: [newStep()],
                  cue: 'haptic',
                  reminderTime: null,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                })
              }
            >
              <Plus size={18} />
              {t('mobilityWeb.new', { defaultValue: 'New routine' })}
            </Button>
          </div>
          {!rows.length && (
            <p className="text-muted-foreground">
              {t('mobilityWeb.empty', {
                defaultValue:
                  'No mobility routines yet. Add a custom step or reference an existing exercise.',
              })}
            </p>
          )}
          {rows.map((row) => (
            <div
              key={row.data.id}
              className="flex min-w-0 items-center justify-between gap-3 border-t pt-3"
            >
              <div className="min-w-0">
                <p className="break-words font-medium">{row.data.name}</p>
                <p className="text-sm text-muted-foreground">
                  {t('mobilityWeb.steps', {
                    defaultValue: '{{count}} steps',
                    count: row.data.steps.length,
                  })}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" onClick={() => setRoutine(row.data)}>
                  {t('mobilityWeb.edit', { defaultValue: 'Edit' })}
                </Button>
                <Button
                  variant="ghost"
                  aria-label={t('mobilityWeb.deleteNamed', {
                    defaultValue: 'Delete {{name}}',
                    name: row.data.name,
                  })}
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        t('mobilityWeb.deleteConfirm', {
                          defaultValue:
                            'Delete this routine? Historical and active session snapshots remain.',
                        })
                      )
                    )
                      void submit({
                        operationId: uuid(),
                        expectedRevision: row.revision,
                        mutation: {
                          kind: 'routine',
                          data: row.data,
                          deleted: true,
                        },
                      });
                  }}
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </div>
          ))}
        </GlowCard>
        <GlowCard className="space-y-4 p-5">
          <h2 className="text-xl font-semibold">
            {t('mobilityWeb.plan', { defaultValue: 'Plan a session' })}
          </h2>
          <Label htmlFor="mobility-routine">
            {t('mobilityWeb.routine', { defaultValue: 'Routine' })}
          </Label>
          <select
            id="mobility-routine"
            className="min-h-11 w-full rounded-lg border bg-background px-3"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">
              {t('mobilityWeb.choose', { defaultValue: 'Choose a routine' })}
            </option>
            {rows.map((row) => (
              <option key={row.data.id} value={row.data.id}>
                {row.data.name}
              </option>
            ))}
          </select>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="mobility-day">
                {t('mobilityWeb.startDay', {
                  defaultValue: 'Date / recurrence start',
                })}
              </Label>
              <Input
                id="mobility-day"
                type="date"
                value={day}
                onChange={(event) => setDay(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mobility-time">
                {t('mobilityWeb.time', { defaultValue: 'Time (24-hour)' })}
              </Label>
              <Input
                id="mobility-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>
          </div>
          <Button
            disabled={!selected || mutation.isPending}
            onClick={() => {
              const value = rows.find((row) => row.data.id === selected);
              if (value)
                void submit({
                  operationId: uuid(),
                  expectedRevision: 0,
                  mutation: {
                    kind: 'plan',
                    data: {
                      id: planDraftId,
                      routine: value.data,
                      scheduleId: null,
                      day,
                      time,
                      state: 'planned',
                      activeSessionId: null,
                    },
                    deleted: false,
                  },
                }).then((saved) => {
                  if (saved) setPlanDraftId(uuid());
                });
            }}
          >
            {t('mobilityWeb.oneOff', { defaultValue: 'Add dated plan' })}
          </Button>
          <fieldset className="space-y-3 border-t pt-4">
            <legend className="font-medium">
              {t('mobilityWeb.weekly', { defaultValue: 'Weekly recurrence' })}
            </legend>
            <div className="flex flex-wrap gap-2">
              {labels.map((label, index) => (
                <Button
                  key={index}
                  aria-pressed={days.includes(index)}
                  variant={days.includes(index) ? 'default' : 'outline'}
                  onClick={() =>
                    setDays((current) =>
                      current.includes(index)
                        ? current.filter((value) => value !== index)
                        : [...current, index]
                    )
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
            <Label htmlFor="mobility-end">
              {t('mobilityWeb.endDay', { defaultValue: 'End date (optional)' })}
            </Label>
            <Input
              id="mobility-end"
              type="date"
              value={endDay}
              onChange={(event) => setEndDay(event.target.value)}
            />
            <Button
              disabled={!selected || !days.length || mutation.isPending}
              onClick={() =>
                void submit({
                  operationId: uuid(),
                  expectedRevision: editingSchedule?.revision ?? 0,
                  mutation: {
                    kind: 'schedule',
                    data: {
                      id: editingSchedule?.id ?? scheduleDraftId,
                      routineId: selected,
                      weekdays: days,
                      time,
                      startDay: day,
                      endDay: endDay || null,
                      enabled: true,
                    },
                    deleted: false,
                  },
                }).then((saved) => {
                  if (saved) {
                    setEditingSchedule(null);
                    setScheduleDraftId(uuid());
                  }
                })
              }
            >
              {t('mobilityWeb.saveSchedule', {
                defaultValue: 'Save recurrence',
              })}
            </Button>
          </fieldset>
          {query.data?.schedules
            .filter((row) => !row.deleted)
            .map((row) => (
              <div key={row.data.id} className="space-y-2 border-t pt-3">
                <p className="break-words">
                  {
                    rows.find((item) => item.data.id === row.data.routineId)
                      ?.data.name
                  }{' '}
                  · {row.data.time} ·{' '}
                  {row.data.weekdays
                    .map((weekday) => labels[weekday])
                    .join(', ')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() => {
                      setSelected(row.data.routineId);
                      setTime(row.data.time);
                      setDay(row.data.startDay);
                      setDays(row.data.weekdays);
                      setEndDay(row.data.endDay ?? '');
                      setEditingSchedule({
                        id: row.data.id,
                        revision: row.revision,
                      });
                    }}
                  >
                    {t('mobilityWeb.replaceSchedule', {
                      defaultValue: 'Edit recurrence',
                    })}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() =>
                      void submit({
                        operationId: uuid(),
                        expectedRevision: row.revision,
                        mutation: {
                          kind: 'schedule',
                          data: row.data,
                          deleted: true,
                        },
                      })
                    }
                  >
                    {t('mobilityWeb.delete', { defaultValue: 'Delete' })}
                  </Button>
                </div>
              </div>
            ))}
        </GlowCard>
      </div>
      {routine && (
        <section
          id="mobility-editor"
          className="scroll-mt-6 space-y-5 rounded-2xl border bg-card p-5"
        >
          <h2 className="text-xl font-semibold">
            {t('mobilityWeb.editor', { defaultValue: 'Routine editor' })}
          </h2>
          <Label htmlFor="routine-name">
            {t('mobilityWeb.name', { defaultValue: 'Name' })}
          </Label>
          <Input
            id="routine-name"
            maxLength={120}
            value={routine.name}
            onChange={(event) =>
              setRoutine({ ...routine, name: event.target.value })
            }
          />
          {routine.steps.map((step, index) => (
            <fieldset
              key={step.id}
              className="grid min-w-0 gap-3 border-t pt-4 md:grid-cols-2"
            >
              <legend>
                {t('mobilityWeb.step', {
                  defaultValue: 'Step {{index}}',
                  index: index + 1,
                })}
              </legend>
              <div>
                <Label htmlFor={`step-name-${step.id}`}>
                  {t('mobilityWeb.name', { defaultValue: 'Name' })}
                </Label>
                <Input
                  id={`step-name-${step.id}`}
                  maxLength={120}
                  value={step.name}
                  onChange={(event) =>
                    patchStep(step.id, { name: event.target.value })
                  }
                />
              </div>
              <ExercisePicker
                step={step}
                onChoose={(exercise) =>
                  patchStep(step.id, {
                    exerciseId: exercise?.id ?? null,
                    ...(exercise
                      ? {
                          name: exercise.name,
                          instructions: (exercise.instructions ?? [])
                            .join(' ')
                            .slice(0, 500),
                        }
                      : {}),
                  })
                }
              />
              <div>
                <Label htmlFor={`step-instructions-${step.id}`}>
                  {t('mobilityWeb.instructions', {
                    defaultValue: 'Instructions',
                  })}
                </Label>
                <textarea
                  id={`step-instructions-${step.id}`}
                  className="min-h-24 w-full rounded-lg border bg-background p-3"
                  maxLength={500}
                  value={step.instructions}
                  onChange={(event) =>
                    patchStep(step.id, { instructions: event.target.value })
                  }
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor={`step-kind-${step.id}`}>
                  {t('mobilityWeb.type', { defaultValue: 'Step type' })}
                </Label>
                <select
                  id={`step-kind-${step.id}`}
                  className="min-h-11 w-full rounded-lg border bg-background p-2"
                  value={step.kind}
                  onChange={(event) => {
                    const common = {
                      id: step.id,
                      name: step.name,
                      instructions: step.instructions,
                      side: step.side,
                      exerciseId: step.exerciseId,
                      transitionSeconds: step.transitionSeconds,
                    };
                    setRoutine({
                      ...routine,
                      steps: routine.steps.map((item) =>
                        item.id !== step.id
                          ? item
                          : event.target.value === 'timed'
                            ? { ...common, kind: 'timed', durationSeconds: 30 }
                            : {
                                ...common,
                                kind: 'repetitions',
                                repetitions: 10,
                              }
                      ),
                    });
                  }}
                >
                  <option value="timed">
                    {t('mobilityWeb.seconds', { defaultValue: 'Seconds' })}
                  </option>
                  <option value="repetitions">
                    {t('mobilityWeb.repetitions', {
                      defaultValue: 'Repetitions',
                    })}
                  </option>
                </select>
                <Label htmlFor={`step-amount-${step.id}`}>
                  {t(
                    step.kind === 'timed'
                      ? 'mobilityWeb.seconds'
                      : 'mobilityWeb.repetitions'
                  )}
                </Label>
                <Input
                  id={`step-amount-${step.id}`}
                  type="number"
                  min={step.kind === 'timed' ? 5 : 1}
                  max={step.kind === 'timed' ? 3600 : 1000}
                  value={
                    step.kind === 'timed'
                      ? step.durationSeconds
                      : step.repetitions
                  }
                  onChange={(event) =>
                    patchStep(
                      step.id,
                      step.kind === 'timed'
                        ? { durationSeconds: Number(event.target.value) }
                        : { repetitions: Number(event.target.value) }
                    )
                  }
                />
                <Label htmlFor={`step-side-${step.id}`}>
                  {t('mobilityWeb.side', { defaultValue: 'Side' })}
                </Label>
                <select
                  id={`step-side-${step.id}`}
                  className="min-h-11 w-full rounded-lg border bg-background p-2"
                  value={step.side}
                  onChange={(event) =>
                    patchStep(step.id, {
                      side: event.target.value as MobilityStep['side'],
                    })
                  }
                >
                  {['both', 'left', 'right'].map((side) => (
                    <option key={side} value={side}>
                      {t(`mobilityWeb.${side}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor={`step-transition-${step.id}`}>
                  {t('mobilityWeb.transition', {
                    defaultValue: 'Transition (seconds)',
                  })}
                </Label>
                <Input
                  id={`step-transition-${step.id}`}
                  type="number"
                  min={0}
                  max={600}
                  value={step.transitionSeconds}
                  onChange={(event) =>
                    patchStep(step.id, {
                      transitionSeconds: Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {[-1, 1].map((direction) => (
                  <Button
                    key={direction}
                    variant="outline"
                    aria-label={t(
                      direction === -1
                        ? 'mobilityWeb.moveUp'
                        : 'mobilityWeb.moveDown'
                    )}
                    disabled={
                      index + direction < 0 ||
                      index + direction >= routine.steps.length
                    }
                    onClick={() => {
                      const steps = [...routine.steps];
                      [steps[index], steps[index + direction]] = [
                        steps[index + direction]!,
                        steps[index]!,
                      ];
                      setRoutine({ ...routine, steps });
                    }}
                  >
                    {direction === -1 ? (
                      <ArrowUp size={18} />
                    ) : (
                      <ArrowDown size={18} />
                    )}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  disabled={routine.steps.length === 1}
                  onClick={() =>
                    setRoutine({
                      ...routine,
                      steps: routine.steps.filter(
                        (item) => item.id !== step.id
                      ),
                    })
                  }
                >
                  {t('mobilityWeb.deleteStep', { defaultValue: 'Remove step' })}
                </Button>
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={routine.steps.length >= 40}
              onClick={() =>
                setRoutine({ ...routine, steps: [...routine.steps, newStep()] })
              }
            >
              {t('mobilityWeb.addStep', { defaultValue: 'Add step' })}
            </Button>
            <Button
              disabled={mutation.isPending}
              onClick={() =>
                void submit({
                  operationId: uuid(),
                  expectedRevision:
                    rows.find((row) => row.data.id === routine.id)?.revision ??
                    0,
                  mutation: {
                    kind: 'routine',
                    data: { ...routine, updatedAt: new Date().toISOString() },
                    deleted: false,
                  },
                }).then((saved) => {
                  if (saved) setRoutine(null);
                })
              }
            >
              {t('mobilityWeb.save', { defaultValue: 'Save routine' })}
            </Button>
            <Button variant="outline" onClick={() => setRoutine(null)}>
              {t('mobilityWeb.close', { defaultValue: 'Close editor' })}
            </Button>
          </div>
        </section>
      )}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">
          {t('mobilityWeb.plansHistory', { defaultValue: 'Plans and history' })}
        </h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <Label htmlFor="range-from">
              {t('mobilityWeb.from', { defaultValue: 'From' })}
            </Label>
            <Input
              id="range-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="range-to">
              {t('mobilityWeb.to', { defaultValue: 'Until' })}
            </Label>
            <Input
              id="range-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('mobilityWeb.timezone', {
            defaultValue:
              'Plan times use {{timezone}}. Maximum date range: 93 days.',
            timezone: query.data?.timezone ?? '—',
          })}
        </p>
        <ul className="divide-y rounded-xl border">
          {query.data?.plans
            .filter((row) => !row.deleted)
            .sort((a, b) =>
              (a.data.day + a.data.time).localeCompare(b.data.day + b.data.time)
            )
            .map((row) => (
              <li
                key={row.data.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    {row.data.routine.name}
                  </p>
                  <p>
                    {row.data.day} · {row.data.time} ·{' '}
                    {t(`mobilityWeb.state.${row.data.state}`)}
                  </p>
                </div>
                {row.data.state === 'planned' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() => {
                        const next = window.prompt(
                          t('mobilityWeb.newTime', {
                            defaultValue: 'New time (HH:mm)',
                          }),
                          row.data.time
                        );
                        if (next)
                          void submit({
                            operationId: uuid(),
                            expectedRevision: row.revision,
                            mutation: {
                              kind: 'plan',
                              data: { ...row.data, time: next },
                              deleted: false,
                            },
                          });
                      }}
                    >
                      {t('mobilityWeb.changeTime', {
                        defaultValue: 'Change time',
                      })}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() =>
                        void submit({
                          operationId: uuid(),
                          expectedRevision: row.revision,
                          mutation: {
                            kind: 'result',
                            planId: row.data.id,
                            data: {
                              state: 'skipped',
                              outcomes: [],
                              recordedAt: new Date().toISOString(),
                            },
                          },
                        })
                      }
                    >
                      {t('mobilityWeb.skip', { defaultValue: 'Skip session' })}
                    </Button>
                  </div>
                )}
              </li>
            ))}
        </ul>
        <details className="rounded-xl border p-4">
          <summary className="min-h-11 cursor-pointer font-medium">
            {t('mobilityWeb.sessions', { defaultValue: 'Recorded sessions' })}
          </summary>
          <ul className="divide-y">
            {query.data?.sessions
              .filter((row) => !row.deleted)
              .map((row) => (
                <li key={row.data.id} className="py-3">
                  <p className="break-words">{row.data.routine.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat(i18n.language, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      hourCycle: 'h23',
                      timeZone: query.data?.timezone,
                    }).format(new Date(row.data.startedAt))}{' '}
                    · {t(`mobilityWeb.state.${row.data.state}`)} ·{' '}
                    {t('mobilityWeb.confirmed', {
                      defaultValue:
                        '{{count}} of {{total}} steps explicitly recorded',
                      count: row.data.outcomes.length,
                      total: row.data.routine.steps.length,
                    })}
                  </p>
                </li>
              ))}
          </ul>
        </details>
      </section>
    </main>
  );
}

function ExercisePicker({
  step,
  onChoose,
}: {
  step: MobilityStep;
  onChoose: (value: Exercise | null) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const results = useMobilityExerciseSearch(query);
  return (
    <div className="space-y-2">
      <Label htmlFor={`exercise-${step.id}`}>
        {t('mobilityWeb.exerciseId', {
          defaultValue: 'Saved exercise (optional)',
        })}
      </Label>
      {step.exerciseId && (
        <Button type="button" variant="outline" onClick={() => onChoose(null)}>
          {t('mobilityWeb.unlinkExercise', { defaultValue: 'Unlink exercise' })}
        </Button>
      )}
      <Input
        id={`exercise-${step.id}`}
        value={search}
        maxLength={120}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('mobilityWeb.searchExercises', {
          defaultValue: 'Search your exercise library…',
        })}
      />
      {results.isFetching && (
        <p role="status">
          {t('common.loading', { defaultValue: 'Loading...' })}
        </p>
      )}
      {results.isError && (
        <p role="alert">
          {t('mobilityWeb.exerciseFailed', {
            defaultValue:
              'Exercise search failed. Custom steps remain available.',
          })}
        </p>
      )}
      {query.length >= 2 &&
        !results.isFetching &&
        !results.isError &&
        results.data?.length === 0 && (
          <p>
            {t('mobilityWeb.noExercises', {
              defaultValue:
                'No matching saved exercise. You can use a custom step.',
            })}
          </p>
        )}
      <ul className="space-y-1">
        {results.data?.slice(0, 8).map((exercise) => (
          <li key={exercise.id}>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 h-auto w-full justify-start whitespace-normal text-left"
              onClick={() => {
                onChoose(exercise);
                setSearch('');
                setQuery('');
              }}
            >
              {exercise.name}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
