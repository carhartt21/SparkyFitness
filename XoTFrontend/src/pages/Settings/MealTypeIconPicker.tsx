import { MEAL_TYPE_ICON_KEYS, type MealTypeIcon } from '@workspace/shared';
import { useTranslation } from 'react-i18next';
import MealIcon from '@/pages/Diary/MealTypeIcon';

export default function MealTypeIconPicker({
  value,
  onChange,
}: {
  value: MealTypeIcon | null;
  onChange: (value: MealTypeIcon | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">
        {t('mealTypeManager.icon', { defaultValue: 'Icon' })}
      </legend>
      <div
        role="radiogroup"
        className="flex flex-wrap gap-2"
        aria-label={t('mealTypeManager.icon', { defaultValue: 'Icon' })}
      >
        {MEAL_TYPE_ICON_KEYS.map((key) => (
          <label
            key={key}
            className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-2"
          >
            <input
              type="radio"
              name="meal-icon"
              className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
              checked={value === key}
              onChange={() => onChange(key)}
              aria-label={t(`mealTypeManager.icons.${key}`)}
            />
            <MealIcon icon={key} className="pointer-events-none h-5 w-5" />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange(null)}
        className="mt-2 min-h-11 text-sm text-muted-foreground underline underline-offset-4"
      >
        {t('mealTypeManager.defaultIcon', { defaultValue: 'Use default icon' })}
      </button>
    </fieldset>
  );
}
