import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useCSSVariable } from 'uniwind';
import AnchoredMenu, {
  measureAnchoredMenuTrigger,
  type AnchorRect,
} from './AnchoredMenu';
import Icon from './Icon';

export interface UnitDropdownOption {
  value: string;
  label: string;
}

/**
 * A dropdown field: the options open in a popover right under the field
 * (not a bottom sheet), with the current one checked.
 */
const UnitDropdown: React.FC<{
  value: string;
  label: string;
  options: UnitDropdownOption[];
  onSelect: (value: string) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}> = ({
  value,
  label,
  options,
  onSelect,
  accessibilityLabel,
  disabled = false,
  busy = false,
  testID,
  className,
  style,
}) => {
  const [accent, textPrimary] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-primary',
  ]) as [string, string];
  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [open, setOpen] = useState(false);
  const interactive = options.length > 1 && !disabled;

  return (
    <>
      <TouchableOpacity
        ref={triggerRef}
        testID={testID}
        onPress={() =>
          measureAnchoredMenuTrigger(triggerRef.current, (rect) => {
            setAnchor(rect);
            setOpen(true);
          })
        }
        disabled={!interactive}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open, disabled: !interactive }}
        className={className}
        style={style}
      >
        <Text
          className="min-w-0 flex-1 text-base font-medium text-text-primary"
          numberOfLines={1}
        >
          {label}
        </Text>
        {busy ? (
          <ActivityIndicator size="small" color={accent} />
        ) : interactive ? (
          <Icon
            name={open ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={textPrimary}
          />
        ) : null}
      </TouchableOpacity>
      <AnchoredMenu
        visible={open}
        anchor={anchor}
        onClose={() => setOpen(false)}
        minWidth={anchor?.width}
        items={options.map((option) => ({
          key: option.value,
          label: option.label,
          selected: option.value === value,
          onPress: () => {
            setOpen(false);
            onSelect(option.value);
          },
        }))}
      />
    </>
  );
};

export default UnitDropdown;
