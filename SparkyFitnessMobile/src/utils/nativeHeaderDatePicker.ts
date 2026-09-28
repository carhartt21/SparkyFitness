import type { NativeStackHeaderItem } from '@react-navigation/native-stack';
import { formatDateLabel } from './dateUtils';
import { createNativeHeaderIconButtonItem } from './nativeHeaderItems';

export type NativeHeaderDatePickerOptions = {
  selectedDate: string;
  onPreviousDate: () => void;
  onDatePress: () => void;
  onNextDate: () => void;
  tintColor: string;
  accessibilityLabel: string;
  previousDayLabel?: string;
  nextDayLabel?: string;
  dateLabel?: string;
  t: import('i18next').TFunction;
  locale: string;
  leadingAction?: {
    sfSymbol: string;
    onPress: () => void;
    accessibilityLabel: string;
    identifier: string;
  };
  /** Settings entry pinned to the upper-left corner of content tabs. */
  settingsAction?: {
    onPress: () => void;
    accessibilityLabel: string;
    /** Dashboard pins Settings to the upper-right; other tabs use the left. */
    placement?: 'left' | 'right';
  };
};

export type NativeHeaderDatePickerNavigation = {
  setOptions: (options: {
    unstable_headerRightItems: () => NativeStackHeaderItem[];
    unstable_headerLeftItems?: () => NativeStackHeaderItem[];
  }) => void;
};

export function setNativeHeaderDatePickerOptions(
  navigation: NativeHeaderDatePickerNavigation,
  options: NativeHeaderDatePickerOptions
) {
  const { leadingAction, settingsAction } = options;
  const leftItems: NativeStackHeaderItem[] = [];
  const settingsItem = settingsAction
    ? createNativeHeaderIconButtonItem({
        sfSymbol: 'gearshape',
        onPress: settingsAction.onPress,
        tintColor: options.tintColor,
        accessibilityLabel: settingsAction.accessibilityLabel,
        identifier: 'open-settings',
      })
    : null;
  const settingsOnRight = settingsAction?.placement === 'right';
  if (settingsItem && !settingsOnRight) leftItems.push(settingsItem);
  if (leadingAction) {
    leftItems.push(
      createNativeHeaderIconButtonItem({
        sfSymbol: leadingAction.sfSymbol,
        onPress: leadingAction.onPress,
        tintColor: options.tintColor,
        accessibilityLabel: leadingAction.accessibilityLabel,
        identifier: leadingAction.identifier,
      })
    );
  }

  navigation.setOptions({
    unstable_headerRightItems: () => [
      ...createNativeHeaderDatePickerItems(options),
      ...(settingsItem && settingsOnRight ? [settingsItem] : []),
    ],
    unstable_headerLeftItems:
      leftItems.length > 0 ? () => leftItems : undefined,
  });
}

export function createNativeHeaderDatePickerItems({
  selectedDate,
  onPreviousDate,
  onDatePress,
  onNextDate,
  tintColor,
  accessibilityLabel,
  previousDayLabel,
  nextDayLabel,
  dateLabel,
  t,
  locale,
}: NativeHeaderDatePickerOptions): NativeStackHeaderItem[] {
  const selectedDateLabel =
    dateLabel ?? `${formatDateLabel(selectedDate, t, locale)} ▾`;
  return [
    {
      type: 'button',
      label: '',
      icon: { type: 'sfSymbol', name: 'chevron.left' },
      onPress: onPreviousDate,
      tintColor,
      // i18n-audit-ignore-next-line hardcoded-ui-text -- legacy API fallback; production callers pass localized previousDayLabel.
      accessibilityLabel: `${accessibilityLabel}${previousDayLabel ?? ': previous day'}`,
      identifier: 'date-picker-previous',
      sharesBackground: true,
      disabled: false,
    },
    {
      type: 'button',
      label: selectedDateLabel,
      onPress: onDatePress,
      tintColor,
      labelStyle: { fontSize: 15, fontWeight: '600', color: tintColor },
      accessibilityLabel: `${accessibilityLabel}: ${selectedDateLabel}`,
      identifier: 'date-picker',
      sharesBackground: true,
    },
    {
      type: 'button',
      label: '',
      icon: { type: 'sfSymbol', name: 'chevron.right' },
      onPress: onNextDate,
      tintColor,
      // i18n-audit-ignore-next-line hardcoded-ui-text -- legacy API fallback; production callers pass localized nextDayLabel.
      accessibilityLabel: `${accessibilityLabel}${nextDayLabel ?? ': next day'}`,
      identifier: 'date-picker-next',
      sharesBackground: true,
      disabled: false,
    },
  ];
}
