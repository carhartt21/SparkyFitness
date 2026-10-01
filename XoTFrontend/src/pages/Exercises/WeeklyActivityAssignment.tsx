import { useTranslation } from 'react-i18next';
import {
  PLANNED_ACTIVITY_TYPES,
  type PlannedActivityType,
} from '@workspace/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { WorkoutPlanAssignment, WorkoutPreset } from '@/types/workout';

export default function WeeklyActivityAssignment({
  assignment,
  presets,
  onChange,
  onRemove,
}: {
  assignment: WorkoutPlanAssignment;
  presets: WorkoutPreset[];
  onChange: (patch: Partial<WorkoutPlanAssignment>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const fieldId = `weekly-${assignment.id}`;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={`${fieldId}-type`}>{t('weeklyPlan.type')}</Label>
          <select
            id={`${fieldId}-type`}
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
            value={
              assignment.workout_preset_id
                ? `preset:${assignment.workout_preset_id}`
                : (assignment.activity_type ?? '')
            }
            onChange={(event) => {
              const value = event.target.value;
              onChange(
                value.startsWith('preset:')
                  ? {
                      workout_preset_id: value.slice(7),
                      activity_type: null,
                      exercise_id: undefined,
                    }
                  : {
                      activity_type: value as PlannedActivityType,
                      workout_preset_id: undefined,
                      exercise_id: undefined,
                      ...(value === 'rest'
                        ? {
                            planned_duration_minutes: null,
                            planned_distance_km: null,
                          }
                        : {}),
                    }
              );
            }}
          >
            {PLANNED_ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`weeklyPlan.activities.${type}`)}
              </option>
            ))}
            {presets.map((preset) => (
              <option key={preset.id} value={`preset:${preset.id}`}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={onRemove}
        >
          {t('common.delete')}
        </Button>
      </div>
      <Label htmlFor={`${fieldId}-name`}>{t('weeklyPlan.labelOptional')}</Label>
      <Input
        id={`${fieldId}-name`}
        value={assignment.session_name ?? ''}
        maxLength={160}
        onChange={(event) =>
          onChange({ session_name: event.target.value || null })
        }
      />
      {assignment.activity_type !== 'rest' && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor={`${fieldId}-duration`}>
                {t('weeklyPlan.duration')}
              </Label>
              <Input
                id={`${fieldId}-duration`}
                type="number"
                min="0.01"
                max="1440"
                step="any"
                value={assignment.planned_duration_minutes ?? ''}
                onChange={(event) =>
                  onChange({
                    planned_duration_minutes: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${fieldId}-distance`}>
                {t('weeklyPlan.distance')}
              </Label>
              <Input
                id={`${fieldId}-distance`}
                type="number"
                min="0.01"
                max="1000"
                step="any"
                value={assignment.planned_distance_km ?? ''}
                onChange={(event) =>
                  onChange({
                    planned_distance_km: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${fieldId}-time`}>{t('weeklyPlan.time')}</Label>
              <Input
                id={`${fieldId}-time`}
                type="time"
                value={assignment.planned_time?.slice(0, 5) ?? ''}
                onChange={(event) =>
                  onChange({ planned_time: event.target.value || null })
                }
              />
            </div>
          </div>
          <Label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={assignment.is_optional ?? false}
              onChange={(event) =>
                onChange({ is_optional: event.target.checked })
              }
            />
            {t('weeklyPlan.optional')}
          </Label>
        </>
      )}
    </div>
  );
}
