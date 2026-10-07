import Button from './ui/Button';
import React from 'react';
import { View, Text } from 'react-native';

interface YesNoClearControlProps {
  /**
   * Tri-state value: '' (no entry), 'true', or 'false'. A missing entry is
   * deliberately NOT shown as "No" — all options render unselected.
   */
  value: string;
  onChange: (value: '' | 'true' | 'false') => void;
  labels: { yes: string; no: string; clear: string };
}

const YesNoClearControl: React.FC<YesNoClearControlProps> = ({
  value,
  onChange,
  labels,
}) => {
  const renderOption = (
    label: string,
    selected: boolean,
    onPress: () => void,
    disabled = false
  ) => (
    <Button
      variant={selected ? 'primary' : 'secondary'}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      className={`flex-1   px-3 py-2 items-center ${disabled ? 'opacity-40' : ''}`}
    >
      <Text
        className={`text-sm ${selected ? 'text-text-primary font-semibold' : 'text-text-secondary'}`}
      >
        {label}
      </Text>
    </Button>
  );

  return (
    <View className="flex-row gap-2">
      {renderOption(labels.yes, value === 'true', () => onChange('true'))}
      {renderOption(labels.no, value === 'false', () => onChange('false'))}
      {renderOption(labels.clear, false, () => onChange(''), value === '')}
    </View>
  );
};

export default YesNoClearControl;
