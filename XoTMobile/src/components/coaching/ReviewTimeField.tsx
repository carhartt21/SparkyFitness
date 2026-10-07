import Button from '../ui/Button';
import { useRef } from 'react';
import { Keyboard, Text } from 'react-native';
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
      <Button
        variant="secondary"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value }}
        className="min-h-12 px-4 py-3"
        onPress={() => {
          Keyboard.dismiss();
          picker.current?.present();
        }}
      >
        <Text className="text-base text-text-primary">{value}</Text>
      </Button>
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
