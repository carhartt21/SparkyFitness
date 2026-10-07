import Button from './ui/Button';
import { View, Text } from 'react-native';

export type Segment<T extends string> = {
  key: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  segments: Segment<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
};

/**
 * Equal-width filters use the shared action material; selection keeps its accent.
 */
const SegmentedControl = <T extends string>({
  segments,
  activeKey,
  onSelect,
}: SegmentedControlProps<T>) => {
  return (
    <View>
      <View className="flex-row gap-2">
        {segments.map((segment) => {
          const selected = activeKey === segment.key;
          return (
            <Button
              variant={selected ? 'primary' : 'secondary'}
              key={segment.key}
              onPress={() => onSelect(segment.key)}
              className="flex-1 min-h-11 py-2"
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text
                className={`text-sm font-medium ${
                  selected ? 'text-text-primary' : 'text-text-muted'
                }`}
                numberOfLines={1}
              >
                {segment.label}
              </Text>
            </Button>
          );
        })}
      </View>
    </View>
  );
};

export default SegmentedControl;
