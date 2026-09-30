import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import type { ToastConfig } from 'react-native-toast-message';
import Icon from '../Icon';

type ToastVariant = 'success' | 'error' | 'info';

// The library's own onPress defaults to a noop, so actionable snackbars pass
// their callback and visible label through custom props instead.
interface ToastActionProps {
  onPress?: () => void;
  actionLabel?: string;
}

const statusIcon = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'info-circle',
} as const;

function ToastContent({
  variant,
  text1,
  text2,
  onPress,
  actionLabel,
}: {
  variant: ToastVariant;
  text1?: string;
  text2?: string;
  onPress?: () => void;
  actionLabel?: string;
}) {
  const [surface, border, primary, secondary, accent, success, danger, info] =
    useCSSVariable([
      '--color-raised',
      '--color-border',
      '--color-text-primary',
      '--color-text-secondary',
      '--color-accent-primary',
      '--color-positive',
      '--color-destructive',
      '--color-informational',
    ]) as string[];
  const statusColor =
    variant === 'success' ? success : variant === 'error' ? danger : info;
  // Existing action toasts used text2 as a tap hint. Treat it as the action
  // label until callers can supply an explicit label; never show it twice.
  const visibleAction = onPress ? actionLabel || text2 : undefined;
  const supportingText = visibleAction === text2 ? undefined : text2;

  return (
    <View style={{ width: '100%', maxWidth: 480, paddingHorizontal: 16 }}>
      <View
        testID="app-snackbar"
        accessibilityLiveRegion={variant === 'error' ? 'assertive' : 'polite'}
        style={{
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: surface,
          borderColor: border,
          borderWidth: 1,
          borderRadius: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 16,
          elevation: 8,
        }}
      >
        <View
          style={{ alignSelf: 'flex-start', marginTop: 2, marginRight: 12 }}
        >
          <Icon name={statusIcon[variant]} size={22} color={statusColor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {text1 ? (
            <Text style={{ color: primary, fontSize: 15, fontWeight: '600' }}>
              {text1}
            </Text>
          ) : null}
          {supportingText ? (
            <Text
              style={{
                color: secondary,
                fontSize: 13,
                marginTop: text1 ? 2 : 0,
              }}
            >
              {supportingText}
            </Text>
          ) : null}
        </View>
        {onPress && visibleAction ? (
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={visibleAction}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              marginLeft: 10,
              paddingHorizontal: 10,
              borderRadius: 10,
              borderColor: accent,
              borderWidth: 1,
            }}
          >
            <Text style={{ color: accent, fontSize: 14, fontWeight: '600' }}>
              {visibleAction}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  success: ({ text1, text2, props }) => (
    <ToastContent
      variant="success"
      text1={text1}
      text2={text2}
      {...(props as ToastActionProps | undefined)}
    />
  ),
  error: ({ text1, text2, props }) => (
    <ToastContent
      variant="error"
      text1={text1}
      text2={text2}
      {...(props as ToastActionProps | undefined)}
    />
  ),
  info: ({ text1, text2, props }) => (
    <ToastContent
      variant="info"
      text1={text1}
      text2={text2}
      {...(props as ToastActionProps | undefined)}
    />
  ),
};
