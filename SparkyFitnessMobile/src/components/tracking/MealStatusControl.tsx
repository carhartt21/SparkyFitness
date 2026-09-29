import { useRef } from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { MealDayStatusValue, MealTrackingState } from '@workspace/shared';
import Icon, { type IconName } from '../Icon';
import ActionSheet, { type ActionSheetRef } from '../ActionSheet';
import { withAlpha } from '../ui/glow';
import { useNeonScale } from './useNeonScale';

interface MealStatusControlProps {
  mealLabel: string;
  state: MealTrackingState;
  onChange: (status: MealDayStatusValue | null) => void;
  busy?: boolean;
}

const nextStatus: Record<MealTrackingState, MealDayStatusValue | null> = {
  pending: 'complete',
  complete: 'incomplete',
  incomplete: 'skipped',
  skipped: null,
};

/**
 * Explicit resolution for one meal: complete, no meal, or incomplete. Logged
 * foods never set it; "Pending" means the user has not decided yet.
 */
export default function MealStatusControl({
  mealLabel,
  state,
  onChange,
  busy = false,
}: MealStatusControlProps) {
  const { t } = useTranslation();
  const scale = useNeonScale();
  const secondary = useCSSVariable('--color-text-secondary') as string;
  const sheetRef = useRef<ActionSheetRef>(null);

  const look: Record<
    MealTrackingState,
    { icon: IconName; color: string; label: string }
  > = {
    complete: {
      icon: 'checkmark-circle',
      color: scale.green,
      label: t('mealStatus.complete', { defaultValue: 'Complete' }),
    },
    skipped: {
      icon: 'skip-forward',
      color: scale.cyan,
      label: t('mealStatus.skipped', { defaultValue: 'No meal' }),
    },
    incomplete: {
      icon: 'timer',
      color: scale.yellow,
      label: t('mealStatus.incomplete', { defaultValue: 'Incomplete' }),
    },
    pending: {
      icon: 'radio-button-off',
      color: secondary,
      label: t('mealStatus.pending', { defaultValue: 'Mark status' }),
    },
  };
  const current = look[state];

  const open = () => sheetRef.current?.present();

  return (
    <>
      <Pressable
        testID="meal-status-control"
        accessibilityRole="button"
        accessibilityLabel={t('mealStatus.a11y', {
          defaultValue: '{{meal}}: {{status}}. Tap to cycle status',
          meal: mealLabel,
          status: current.label,
        })}
        accessibilityHint={t('mealStatus.hint', {
          defaultValue: 'Touch and hold to choose a specific status.',
        })}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => onChange(nextStatus[state])}
        onLongPress={open}
        delayLongPress={350}
        className="h-11 w-11 items-center justify-center rounded-lg border active:opacity-70"
        style={{
          borderColor: withAlpha(current.color, 0.6),
          backgroundColor:
            state === 'pending'
              ? 'transparent'
              : withAlpha(current.color, 0.12),
        }}
      >
        <Icon name={current.icon} size={22} color={current.color} />
      </Pressable>
      <ActionSheet
        ref={sheetRef}
        title={t('mealStatus.title', {
          defaultValue: '{{meal}} status',
          meal: mealLabel,
        })}
        items={[
          {
            key: 'complete',
            label: look.complete.label,
            onPress: () => onChange('complete'),
          },
          {
            key: 'incomplete',
            label: look.incomplete.label,
            onPress: () => onChange('incomplete'),
          },
          {
            key: 'skipped',
            label: look.skipped.label,
            onPress: () => onChange('skipped'),
          },
          ...(state !== 'pending'
            ? [
                {
                  key: 'clear',
                  label: t('mealStatus.clear', {
                    defaultValue: 'Clear status',
                  }),
                  onPress: () => onChange(null),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
