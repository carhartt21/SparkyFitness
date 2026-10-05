import { useRef } from 'react';
import { Keyboard, Pressable, Text } from 'react-native';
import TimeSheet, { type TimeSheetRef } from '../TimeSheet';
export default function ReviewTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (time: string) => void;
}) {
  const picker = useRef<TimeSheetRef>(null);
  return (
    <>
      <Text className="text-base text-text-primary">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value }}
        className="min-h-12 rounded-xl border border-border-subtle bg-surface px-4 py-3"
        onPress={() => {
          Keyboard.dismiss();
          picker.current?.present();
        }}
      >
        <Text className="text-base text-text-primary">{value}</Text>
      </Pressable>
      <TimeSheet
        ref={picker}
        value={value}
        timeFormat="HH:mm"
        commitOn="done"
        onSelectTime={onChange}
      />
    </>
  );
}
