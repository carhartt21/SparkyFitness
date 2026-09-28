import { View, Text, TouchableOpacity } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { useGlowTheme, withAlpha } from './ui/glow';

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
 * Pill-shaped filter/range control from the references: equal-width pills
 * with the selected one outlined and, in dark themes, glowing in the accent.
 */
const SegmentedControl = <T extends string>({
  segments,
  activeKey,
  onSelect,
}: SegmentedControlProps<T>) => {
  const glowing = useGlowTheme();
  const accent = useCSSVariable('--color-accent-primary') as string;
  return (
    <View>
      <View className="flex-row gap-2">
        {segments.map((segment) => {
          const selected = activeKey === segment.key;
          return (
            <TouchableOpacity
              key={segment.key}
              onPress={() => onSelect(segment.key)}
              className={`flex-1 min-h-11 py-2 rounded-full border items-center justify-center ${
                selected ? '' : 'border-border-subtle bg-surface'
              }`}
              style={
                selected
                  ? {
                      borderColor: accent,
                      backgroundColor: withAlpha(accent, 0.14),
                      boxShadow: glowing
                        ? `0px 0px 12px 0px ${withAlpha(accent, 0.45)}`
                        : undefined,
                    }
                  : undefined
              }
              activeOpacity={0.7}
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
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default SegmentedControl;
