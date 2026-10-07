import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { preview } from 'radon-ide';
import Icon, { type IconName } from '../Icon';
import { useButtonAppearance, type ButtonVariant } from './buttonTheme';
type ButtonTone = 'accent' | 'neutral';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: ButtonVariant;
  /**
   * Only affects the accent-text variants (`header`/`ghost`). `neutral` swaps
   * the accent text for the primary text color so a header-like button can act
   * as a secondary/navigation action. Note: this recolors the button's own text
   * child only — an `Icon` child takes its own `color` prop, so pass that
   * explicitly when the child is an icon.
   */
  tone?: ButtonTone;
  /**
   * Swaps the button's children for a spinner and blocks presses. The spinner
   * replaces the label rather than overlaying it, so the button keeps whatever
   * width its container gives it.
   */
  loading?: boolean;
  icon?: IconName;
  /** Optional semantic tint; geometry and material remain shared. */
  color?: string;
  children: React.ReactNode;
  className?: string;
  textClassName?: string;
}

// Neutral-tone text overrides, per variant. Only the accent-text variants have
// an entry; other variants ignore `tone`.
const neutralToneText: Partial<Record<ButtonVariant, string>> = {
  header: 'text-text-primary font-semibold',
  ghost: 'text-text-primary font-semibold',
};

const variantClasses: Record<
  ButtonVariant,
  { container: string; text: string; pressed: string }
> = {
  primary: {
    container: '',
    text: 'text-text-primary font-semibold',
    pressed: 'opacity-80',
  },
  secondary: {
    container: '',
    text: 'text-text-primary font-semibold',
    pressed: 'opacity-80',
  },
  outline: {
    container: '',
    text: 'text-text-primary font-semibold',
    pressed: 'opacity-70',
  },
  ghost: {
    container: '',
    text: 'text-accent-primary font-semibold',
    pressed: 'opacity-70',
  },
  header: {
    container: '',
    text: 'text-accent-primary font-semibold',
    pressed: 'opacity-70',
  },
  link: {
    container: '',
    text: 'text-text-link font-semibold',
    pressed: 'opacity-70',
  },
  // Red text on a transparent container, for the delete/remove action at the
  // bottom of a detail screen. `icon-danger` is a saturated red that stays
  // readable on the app background in every theme, unlike `bg-danger`, which
  // is a fill color and goes near-illegible maroon in dark/AMOLED.
  destructive: {
    container: '',
    text: 'text-icon-danger font-medium',
    pressed: 'opacity-70',
  },
};

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  tone = 'accent',
  loading = false,
  icon,
  color,
  children,
  className = '',
  textClassName = '',
  disabled,
  ...rest
}) => {
  const isDisabled = Boolean(disabled) || loading;
  const appearance = useButtonAppearance(
    variant,
    isDisabled,
    color,
    tone === 'neutral'
  );
  const styles = variantClasses[variant];
  const textClass =
    tone === 'neutral' && neutralToneText[variant]
      ? neutralToneText[variant]!
      : styles.text;

  const basePadding = variant === 'header' ? '' : 'py-3.5 px-4';

  return (
    <Pressable
      className={`${basePadding} items-center justify-center ${styles.container} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={typeof children === 'string' ? children : undefined}
      {...(variant === 'header' && !rest.hitSlop
        ? { hitSlop: { top: 10, bottom: 10, left: 10, right: 10 } }
        : {})}
      {...rest}
      accessibilityState={{
        ...rest.accessibilityState,
        disabled: isDisabled,
        busy: loading,
      }}
      style={({ pressed }) => [
        { maxWidth: '100%', minWidth: 0, minHeight: 44 },
        typeof rest.style === 'function'
          ? rest.style({ pressed })
          : (rest.style as ViewStyle),
        appearance.surface,
        pressed && !isDisabled ? { opacity: 0.8 } : {},
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={appearance.foreground} />
      ) : typeof children === 'string' ? (
        <View className="min-w-0 shrink flex-row items-center justify-center gap-2">
          {icon && <Icon name={icon} size={18} color={appearance.foreground} />}
          <Text
            className={`min-w-0 shrink text-center text-base ${textClass} ${textClassName}`}
            style={{ color: appearance.foreground }}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {children}
          </Text>
        </View>
      ) : (
        children
      )}
    </Pressable>
  );
};

// i18n-audit-ignore-next-line hardcoded-ui-text -- Storybook preview label, not shipped UI
preview(<Button variant="primary">Primary Button</Button>);

// i18n-audit-ignore-next-line hardcoded-ui-text -- Storybook preview label, not shipped UI
preview(<Button variant="secondary">Secondary Button</Button>);

// i18n-audit-ignore-next-line hardcoded-ui-text -- Storybook preview label, not shipped UI
preview(<Button variant="outline">Outline Button</Button>);

// i18n-audit-ignore-next-line hardcoded-ui-text -- Storybook preview label, not shipped UI
preview(<Button variant="ghost">Ghost Button</Button>);

// i18n-audit-ignore-next-line hardcoded-ui-text -- Storybook preview label, not shipped UI
preview(<Button variant="link">Link Button</Button>);

// i18n-audit-ignore-next-line hardcoded-ui-text -- Storybook preview label, not shipped UI
preview(<Button variant="destructive">Destructive Button</Button>);

// i18n-audit-ignore-next-line hardcoded-ui-text -- Storybook preview label, not shipped UI
const loadingPreviewLabel = 'Loading Button';
preview(
  <Button variant="primary" loading>
    {loadingPreviewLabel}
  </Button>
);

export default Button;
