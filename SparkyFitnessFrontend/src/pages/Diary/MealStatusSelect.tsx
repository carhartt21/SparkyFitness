import { useTranslation } from 'react-i18next';
import type { MealDayStatusValue, MealTrackingState } from '@workspace/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Explicit meal resolution. Logged foods never set it; "Not resolved" means
 * the user has not decided yet.
 */
export function MealStatusSelect({
  mealName,
  state,
  onChange,
  disabled,
}: {
  mealName: string;
  state: MealTrackingState;
  onChange: (status: MealDayStatusValue | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Select
      value={state}
      disabled={disabled}
      onValueChange={(value) =>
        onChange(value === 'pending' ? null : (value as MealDayStatusValue))
      }
    >
      <SelectTrigger
        className="h-8 w-auto min-w-[8.5rem] text-xs"
        aria-label={t('mealStatus.label', '{{meal}} status', {
          meal: mealName,
        })}
        data-testid={`meal-status-${mealName}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">
          {t('mealStatus.pending', 'Not resolved')}
        </SelectItem>
        <SelectItem value="complete">
          {t('mealStatus.complete', 'Complete')}
        </SelectItem>
        <SelectItem value="skipped">
          {t('mealStatus.skipped', 'No meal')}
        </SelectItem>
        <SelectItem value="incomplete">
          {t('mealStatus.incomplete', 'Incomplete')}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
