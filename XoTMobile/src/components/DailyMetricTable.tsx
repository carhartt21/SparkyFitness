import { Text, View, useWindowDimensions } from 'react-native';
import Icon, { type IconName } from './Icon';
import { useCSSVariable } from 'uniwind';

interface DailyMetric {
  key: string;
  label: string;
  value: string;
  unit?: string;
  color?: string;
  icon?: IconName;
  dot?: boolean;
}

/** Compact, separated values shared by the dated meal and training summaries. */
export default function DailyMetricTable({
  metrics,
  large = false,
  labelFirst = false,
}: {
  metrics: DailyMetric[];
  large?: boolean;
  labelFirst?: boolean;
}) {
  const foreground = useCSSVariable('--color-text-primary') as string;
  const expanded = useWindowDimensions().fontScale > 1.3;
  return (
    <View className={expanded ? 'gap-3' : 'flex-row'}>
      {metrics.map((metric, index) => {
        const label = (
          <View className="flex-row items-center gap-1.5">
            {metric.dot && (
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: metric.color }}
              />
            )}
            <Text className="min-w-0 shrink text-xs text-text-secondary">
              {metric.label}
            </Text>
          </View>
        );
        return (
          <View
            key={metric.key}
            accessible
            accessibilityLabel={`${metric.value}${metric.unit ? ` ${metric.unit}` : ''}, ${metric.label}`}
            className={`${expanded ? 'flex-row items-center gap-3' : 'min-w-0 flex-1 flex-row items-center gap-2'} ${index > 0 ? (expanded ? 'border-t border-border-subtle pt-3' : 'border-l border-border-subtle pl-3 ml-3') : ''}`}
          >
            {metric.icon && (
              <Icon
                name={metric.icon}
                size={large ? 28 : 16}
                color={metric.color}
              />
            )}
            <View className="min-w-0 flex-1 gap-0.5">
              {labelFirst && label}
              <Text
                className={`${large ? 'text-[28px] leading-8' : 'text-xl leading-6'} font-bold text-text-primary`}
                style={{
                  color: labelFirst ? (metric.color ?? foreground) : foreground,
                  fontVariant: ['tabular-nums'],
                }}
                numberOfLines={expanded ? undefined : 1}
                adjustsFontSizeToFit={!expanded}
              >
                {metric.value}
                {metric.unit && (
                  <Text className="text-xs font-normal"> {metric.unit}</Text>
                )}
              </Text>
              {!labelFirst && label}
            </View>
          </View>
        );
      })}
    </View>
  );
}
