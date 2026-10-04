import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { useTranslation } from 'react-i18next';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Icon, { type IconName } from './Icon';
import { useGlowTheme, withAlpha } from './ui/glow';

export const TAB_BAR_HEIGHT = 56;

const TAB_ICONS: Record<string, IconName> = {
  Dashboard: 'tab-home',
  Diary: 'book',
  Insights: 'tab-insights',
  More: 'tab-more',
};

const CustomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const glowing = useGlowTheme();
  const [
    chrome,
    chromeBorder,
    tabActive,
    tabInactive,
    accentPrimary,
    accentText,
  ] = useCSSVariable([
    '--color-chrome',
    '--color-chrome-border',
    '--color-tab-active',
    '--color-tab-inactive',
    '--color-accent-primary',
    '--color-accent-text',
  ]) as [string, string, string, string, string, string];

  return (
    <View
      testID="app-tab-bar"
      className="flex-row items-end overflow-visible"
      style={{
        backgroundColor: chrome,
        borderTopColor: chromeBorder,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: Math.max(insets.bottom, 4),
        boxShadow: glowing ? '0px -6px 18px 0px #00000080' : undefined,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const isAddButton = route.name === 'Add';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (isAddButton) {
            return;
          }

          if (!event.defaultPrevented && !isFocused) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        if (isAddButton) {
          return (
            <View
              key={route.key}
              className="flex-1 items-center justify-end pb-1"
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  options.tabBarAccessibilityLabel ??
                  t('navigation.add', { defaultValue: 'Add' })
                }
                onPress={onPress}
                onLongPress={onLongPress}
                activeOpacity={0.8}
                className="w-16 h-16 rounded-full items-center justify-center -mt-6"
                style={{
                  backgroundColor: accentPrimary,
                  borderWidth: 3,
                  borderColor: withAlpha(accentPrimary, 0.45),
                  ...(glowing
                    ? {
                        boxShadow: `0px 0px 22px 2px ${withAlpha(accentPrimary, 0.55)}`,
                      }
                    : Platform.select({
                        ios: {
                          shadowColor: '#000',
                          shadowOffset: { width: 2, height: 4 },
                          shadowOpacity: 0.25,
                          shadowRadius: 6,
                        },
                        android: {
                          elevation: 4,
                        },
                      })),
                }}
              >
                <Icon name="add" size={28} color={accentText} weight="bold" />
              </TouchableOpacity>
            </View>
          );
        }

        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : (options.title ?? route.name);
        const iconName = TAB_ICONS[route.name];
        const tintColor = isFocused ? tabActive : tabInactive;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : undefined}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            onPress={onPress}
            onLongPress={onLongPress}
            className="flex-1 items-center justify-center pt-2 pb-1 gap-0.5"
          >
            {iconName && (
              <Icon
                name={iconName}
                size={24}
                color={tintColor}
                weight={isFocused ? 'bold' : 'regular'}
              />
            )}
            <Text
              className={`text-xs ${isFocused ? 'font-semibold' : 'font-medium'}`}
              style={{ color: tintColor }}
              maxFontSizeMultiplier={1.2}
              adjustsFontSizeToFit
              minimumFontScale={1 / 1.2}
              numberOfLines={1}
            >
              {label}
            </Text>
            <View
              className="h-0.5 w-6 rounded-full mt-0.5"
              style={{ backgroundColor: isFocused ? tintColor : 'transparent' }}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default CustomTabBar;
