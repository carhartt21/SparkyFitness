import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useUniwind } from 'uniwind';

interface BrandMarkProps {
  size?: number;
  light?: boolean;
  style?: StyleProp<ImageStyle>;
}

/** Static identity only. It does not imply an aggregate health score. */
export default function BrandMark({ size = 36, light, style }: BrandMarkProps) {
  const { t } = useTranslation();
  const { theme } = useUniwind();
  const useLightAsset = light ?? theme === 'light';
  return (
    <Image
      source={
        useLightAsset
          ? require('../../../assets/brand/progression-x-light.png')
          : require('../../../assets/brand/progression-x.png')
      }
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel={t('brand.name', { defaultValue: 'X on Track' })}
      accessibilityRole="image"
    />
  );
}
