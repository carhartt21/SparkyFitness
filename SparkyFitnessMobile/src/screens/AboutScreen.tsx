import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Application from 'expo-application';
import { useCSSVariable, useUniwind } from 'uniwind';

import Icon from '../components/Icon';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import type { RootStackScreenProps } from '../types/navigation';

type AboutScreenProps = RootStackScreenProps<'About'>;

const PROJECT_URL = 'https://github.com/CodeWithCJ/SparkyFitness';
const PRIVACY_POLICY_URL =
  'https://codewithcj.github.io/SparkyFitness/privacy_policy';
const DOCUMENTATION_URL = 'https://codewithcj.github.io/SparkyFitness/';

const AboutScreen: React.FC<AboutScreenProps> = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const usesNativeHeader = useNativeIOSHeadersActive();
  const { theme } = useUniwind();
  const iconColor = useCSSVariable('--color-icon-decorative') as string;
  const logoSource =
    theme === 'dark' || theme === 'amoled'
      ? require('../../assets/brand/x-on-track-dark.png')
      : require('../../assets/brand/x-on-track-light.png');

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      // Silently ignore — user can copy URL from elsewhere if needed.
    });
  };

  const header = useScreenHeader({
    title: t('about.title', { defaultValue: 'About' }),
    left: { kind: 'back' },
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 80 + activeWorkoutBarPadding,
        }}
        contentInsetAdjustmentBehavior={
          usesNativeHeader ? 'automatic' : 'never'
        }
      >
        <View className="bg-surface rounded-xl p-5 mb-4 items-center shadow-sm">
          <Image
            source={logoSource}
            className="w-20 h-20 mb-4"
            resizeMode="contain"
          />
          <Text className="text-xl font-bold text-text-primary mb-1">
            {t('brand.name', { defaultValue: 'X on Track' })}
          </Text>
          <Text className="text-text-secondary text-sm mb-2">
            {t('brand.tagline', { defaultValue: 'Keep getting better.' })}
          </Text>
          <Text className="text-text-secondary text-sm">
            {t('about.version', {
              defaultValue: 'Version {{version}} ({{build}})',
              version: Application.nativeApplicationVersion ?? '—',
              build: Application.nativeBuildVersion ?? '—',
            })}
          </Text>
        </View>

        <View className="bg-surface rounded-xl p-4 mb-4 shadow-sm">
          <Text className="text-base font-semibold text-text-primary mb-2">
            {t('about.descriptionTitle', { defaultValue: 'About this app' })}
          </Text>
          <Text className="text-text-secondary text-sm leading-5">
            {t('about.personalBestDescription', {
              defaultValue:
                'Log nutrition, training, and health data. Understand your patterns and improve relative to your own baseline.',
            })}
          </Text>
        </View>

        <View className="bg-surface rounded-xl mb-4 shadow-sm">
          <TouchableOpacity
            className="p-4 flex-row items-center justify-between border-b border-border-subtle"
            onPress={() => openUrl(PROJECT_URL)}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel={t('about.github', {
              defaultValue: 'Upstream source and licenses',
            })}
            accessibilityHint={t('about.openExternalLink', {
              defaultValue: 'Opens in your browser',
            })}
          >
            <Text className="text-base font-semibold text-text-primary">
              {t('about.github', {
                defaultValue: 'Upstream source and licenses',
              })}
            </Text>
            <Icon name="chevron-forward" size={20} color={iconColor} />
          </TouchableOpacity>

          <TouchableOpacity
            className="p-4 flex-row items-center justify-between border-b border-border-subtle"
            onPress={() => openUrl(DOCUMENTATION_URL)}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel={t('about.documentation', {
              defaultValue: 'Upstream documentation',
            })}
            accessibilityHint={t('about.openExternalLink', {
              defaultValue: 'Opens in your browser',
            })}
          >
            <Text className="text-base font-semibold text-text-primary">
              {t('about.documentation', {
                defaultValue: 'Upstream documentation',
              })}
            </Text>
            <Icon name="chevron-forward" size={20} color={iconColor} />
          </TouchableOpacity>

          <TouchableOpacity
            className="p-4 flex-row items-center justify-between"
            onPress={() => openUrl(PRIVACY_POLICY_URL)}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel={t('about.privacyPolicy', {
              defaultValue: 'Upstream privacy policy',
            })}
            accessibilityHint={t('about.openExternalLink', {
              defaultValue: 'Opens in your browser',
            })}
          >
            <Text className="text-base font-semibold text-text-primary">
              {t('about.privacyPolicy', {
                defaultValue: 'Upstream privacy policy',
              })}
            </Text>
            <Icon name="chevron-forward" size={20} color={iconColor} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default AboutScreen;
