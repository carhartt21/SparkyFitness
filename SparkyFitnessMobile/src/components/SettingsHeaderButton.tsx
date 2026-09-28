import { Pressable } from 'react-native';
import type { NativeStackHeaderItem } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import { createNativeHeaderIconButtonItem } from '../utils/nativeHeaderItems';

export function settingsButtonLabel(t: TFunction): string {
  return t('navigation.openSettings', { defaultValue: 'Open settings' });
}

/**
 * Settings lives in the root stack and is opened from the upper-left corner of
 * every content tab. This builds the native iOS header item for that action.
 */
export function createSettingsNativeHeaderItem({
  onPress,
  tintColor,
  t,
}: {
  onPress: () => void;
  tintColor: string;
  t: TFunction;
}): NativeStackHeaderItem {
  return createNativeHeaderIconButtonItem({
    sfSymbol: 'gearshape',
    onPress,
    tintColor,
    accessibilityLabel: settingsButtonLabel(t),
    identifier: 'open-settings',
  });
}

/** Screen-owned (custom header path) Settings button. */
export default function SettingsHeaderButton({
  onPress,
  className = '',
}: {
  onPress: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const color = useCSSVariable('--color-text-primary') as string;

  return (
    <Pressable
      testID="open-settings"
      accessibilityRole="button"
      accessibilityLabel={settingsButtonLabel(t)}
      onPress={onPress}
      className={`w-11 h-11 items-center justify-center rounded-full border border-border-subtle bg-surface active:opacity-70 ${className}`}
    >
      <Icon name="settings" size={20} color={color} />
    </Pressable>
  );
}
