import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { CoachingFeedback } from '@workspace/shared';
import { Input } from '@/components/ui/input';
export function CommitmentFeedback({
  value,
  onChange,
}: {
  value: CoachingFeedback;
  onChange: (value: CoachingFeedback) => void;
}) {
  const { t } = useTranslation(),
    id = useId();
  return (
    <details className="space-y-3">
      <summary className="min-h-11 cursor-pointer py-3">
        {t('coaching.feedback', { defaultValue: 'Optional feedback' })}
      </summary>
      <Input
        aria-label={t('coaching.reason', {
          defaultValue: 'Your feedback (optional)',
        })}
        maxLength={1000}
        value={value.reason ?? ''}
        onChange={(event) => onChange({ ...value, reason: event.target.value })}
      />
      <label className="block space-y-2">
        {t('coaching.effortLabel', { defaultValue: 'Actual effort' })}
        <select
          className="block min-h-11 w-full rounded-md border bg-background px-3"
          id={`${id}-effort`}
          value={value.effort ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              effort:
                (event.target.value as CoachingFeedback['effort']) || undefined,
            })
          }
        >
          <option value="">
            {t('coaching.none', { defaultValue: 'Not set' })}
          </option>
          {(['low', 'medium', 'high'] as const).map((option) => (
            <option key={option} value={option}>
              {t(`coaching.options.${option}`, { defaultValue: option })}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2">
        {t('coaching.feasibility', {
          defaultValue: 'How manageable was this?',
        })}
        <select
          className="block min-h-11 w-full rounded-md border bg-background px-3"
          value={value.feasibility ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              feasibility:
                (event.target.value as CoachingFeedback['feasibility']) ||
                undefined,
            })
          }
        >
          <option value="">
            {t('coaching.none', { defaultValue: 'Not set' })}
          </option>
          {(['easy', 'manageable', 'difficult'] as const).map((option) => (
            <option key={option} value={option}>
              {t(`coaching.options.${option}`, { defaultValue: option })}
            </option>
          ))}
        </select>
      </label>
    </details>
  );
}
