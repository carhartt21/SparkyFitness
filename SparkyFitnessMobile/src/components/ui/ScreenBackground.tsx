import { StyleSheet, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { useGlowTheme, withAlpha } from './glow';

/**
 * Quiet neutral edge light behind dark screens. The colored progress mark and
 * metric accents stay legible without casting a red/green rating onto cards.
 */
export default function ScreenBackground() {
  const glowing = useGlowTheme();
  const neutral = useCSSVariable('--color-card-glow') as string;
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
            `radial-gradient(circle at 0% 22%, ${withAlpha(neutral, 0.1)} 0%, ${withAlpha(neutral, 0)} 38%)`,
            `radial-gradient(circle at 100% 18%, ${withAlpha(neutral, 0.08)} 0%, ${withAlpha(neutral, 0)} 36%)`,
          ].join(', '),
        },
      ]}
    />
  );
}
