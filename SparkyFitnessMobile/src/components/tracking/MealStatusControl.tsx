import { Alert, Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { MealDayStatusValue, MealTrackingState } from '@workspace/shared';
import Icon, { type IconName } from '../Icon';
import { withAlpha } from '../ui/glow';
import { useNeonScale } from './useNeonScale';

interface MealStatusControlProps {
  mealLabel: string;
  state: MealTrackingState;
  onChange: (status: MealDayStatusValue | null) => void;
}

/**
 * Explicit resolution for one meal: complete, no meal, or incomplete. Logged
 * foods never set it; "Pending" means the user has not decided yet.
 */
export default function MealStatusControl({
  mealLabel,
  state,
  onChange,
}: MealStatusControlProps) {
  const { t } = useTranslation();
  const scale = useNeonScale();
  const secondary = useCSSVariable('--color-text-secondary') as string;

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

  const open = () =>
    Alert.alert(
      t('mealStatus.title', {
        defaultValue: '{{meal}} status',
        meal: mealLabel,
      }),
      t('mealStatus.message', {
        defaultValue: 'Logged foods alone do not mark a meal as complete.',
      }),
      [
        { text: look.complete.label, onPress: () => onChange('complete') },
        { text: look.skipped.label, onPress: () => onChange('skipped') },
        { text: look.incomplete.label, onPress: () => onChange('incomplete') },
        ...(state !== 'pending'
          ? [
              {
                text: t('mealStatus.clear', { defaultValue: 'Clear status' }),
                style: 'destructive' as const,
                onPress: () => onChange(null),
              },
            ]
          : []),
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel' as const,
        },
      ]
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('mealStatus.a11y', {
        defaultValue: '{{meal}}: {{status}}. Change status',
        meal: mealLabel,
        status: current.label,
      })}
      onPress={open}
      className="min-h-11 flex-row items-center gap-1 rounded-lg border px-3"
      style={{
        borderColor: withAlpha(current.color, 0.6),
        backgroundColor:
          state === 'pending' ? 'transparent' : withAlpha(current.color, 0.12),
      }}
    >
      <Icon name={current.icon} size={16} color={current.color} />
      <Text className="text-sm font-semibold" style={{ color: current.color }}>
        {current.label}
      </Text>
    </Pressable>
  );
}
