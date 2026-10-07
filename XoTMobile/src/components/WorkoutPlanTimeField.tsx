import Button from './ui/Button';
import { useRef } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import TimeSheet, { type TimeSheetRef } from './TimeSheet';

interface WorkoutPlanTimeFieldProps {
  value: string | null | undefined;
  onChange: (time: string | null) => void;
}

/** Optional wall-clock time, selected as HH:mm without a free-text keyboard. */
export default function WorkoutPlanTimeField({
  value,
  onChange,
}: WorkoutPlanTimeFieldProps) {
  const { t } = useTranslation();
  const picker = useRef<TimeSheetRef>(null);
  const iconColor = useCSSVariable('--color-text-secondary') as string;
  const time = value?.slice(0, 5) ?? '';
  const label = t('weeklyPlan.time', {
    defaultValue: 'Time (24-hour, optional)',
  });
  return (
    <>
      <Text className="text-text-secondary">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Button
          variant="secondary"
          testID="weekly-plan-time"
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: time }}
          onPress={() => {
            Keyboard.dismiss();
            picker.current?.present();
          }}
          className="min-h-12 flex-1 flex-row items-center justify-between px-3 py-3"
        >
          <Text className="text-base text-text-primary">
            {time || t('weeklyPlan.timeFormat', { defaultValue: 'HH:mm' })}
          </Text>
          <Icon name="clock" size={20} color={iconColor} />
        </Button>
        {time ? (
          <Pressable
            testID="weekly-plan-clear-time"
            accessibilityRole="button"
            accessibilityLabel={t('weeklyPlan.clearTime', {
              defaultValue: 'Remove session time',
            })}
            onPress={() => onChange(null)}
            className="min-h-11 min-w-11 items-center justify-center"
          >
            <Icon name="close" size={20} color={iconColor} />
          </Pressable>
        ) : null}
      </View>
      <TimeSheet
        ref={picker}
        value={time}
        timeFormat="HH:mm"
        commitOn="done"
        onSelectTime={onChange}
      />
    </>
  );
}
