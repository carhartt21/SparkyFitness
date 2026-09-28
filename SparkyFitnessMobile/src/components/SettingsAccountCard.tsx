import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon from './Icon';
import { glowSurfaceStyle, useGlowTheme } from './ui/glow';

interface Props {
  name: string | null;
  serverUrl: string;
  isLoading: boolean;
  onPress: () => void;
}

function getInitials(name: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

function hostOf(url: string): string {
  const match = url.match(/^[a-z]+:\/\/([^/?#]+)/i);
  return match?.[1] ?? url;
}

/**
 * Account summary at the top of Settings. Shows the profile name when the
 * server returned one and the connected server host; it never invents an
 * email or plan the backend did not provide.
 */
export default function SettingsAccountCard({
  name,
  serverUrl,
  isLoading,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const [secondary, accent] = useCSSVariable([
    '--color-text-secondary',
    '--color-accent-primary',
  ]) as [string, string];
  const glowing = useGlowTheme();
  const initials = getInitials(name);
  const displayName = isLoading
    ? t('settings.account.loading', { defaultValue: 'Loading profile' })
    : (name ??
      t('settings.account.fallbackName', { defaultValue: 'Your account' }));
  const host = hostOf(serverUrl);

  return (
    <Pressable
      testID="settings-account-card"
      accessibilityRole="button"
      accessibilityLabel={t('settings.account.accessibilityLabel', {
        defaultValue: '{{name}}. Connected to {{host}}. Opens server settings.',
        name: displayName,
        host,
      })}
      onPress={onPress}
      className="mb-7 flex-row items-center rounded-2xl border border-border-subtle bg-surface p-4 active:opacity-70"
      style={glowSurfaceStyle(accent, glowing, 'soft')}
    >
      <View
        className="mr-4 h-14 w-14 items-center justify-center overflow-hidden rounded-full border bg-raised"
        style={{ borderColor: accent }}
      >
        {initials ? (
          <Text className="text-lg font-bold text-text-primary">
            {initials}
          </Text>
        ) : (
          <Icon name="person" size={26} color={secondary} />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-text-primary">
          {displayName}
        </Text>
        <Text
          className="mt-0.5 text-sm text-text-secondary"
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {host}
        </Text>
      </View>
      <Icon name="chevron-forward" size={16} color={secondary} />
    </Pressable>
  );
}
