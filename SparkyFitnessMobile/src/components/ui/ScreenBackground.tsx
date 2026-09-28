import { StyleSheet, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { useGlowTheme, withAlpha } from './glow';

/**
 * Ambient edge glow behind a screen's content in dark themes, echoing the
 * reference's red and green light spill. Decorative only; render it as the
 * first child of a full-screen container.
 */
export default function ScreenBackground() {
  const glowing = useGlowTheme();
  const [red, green] = useCSSVariable([
    '--color-neon-red',
    '--color-neon-green',
  ]) as [string, string];
  if (!glowing) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        {
          experimental_backgroundImage: [
            `radial-gradient(circle at 0% 22%, ${withAlpha(red, 0.16)} 0%, ${withAlpha(red, 0)} 38%)`,
            `radial-gradient(circle at 100% 18%, ${withAlpha(green, 0.14)} 0%, ${withAlpha(green, 0)} 36%)`,
            `radial-gradient(circle at 100% 62%, ${withAlpha(green, 0.1)} 0%, ${withAlpha(green, 0)} 34%)`,
            `radial-gradient(circle at 0% 78%, ${withAlpha(red, 0.1)} 0%, ${withAlpha(red, 0)} 32%)`,
          ].join(', '),
        },
      ]}
    />
  );
}
