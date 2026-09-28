import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import SafeImage from './SafeImage';
import type { GetFoodImageSource } from '../hooks/useFoodImageSource';
import { foodFallbackImage } from '../utils/foodFallbackImages';

interface FoodThumbnailProps {
  /** Stored image path, or null when the entity has no picture. */
  image: string | null;
  /** Display name used only to choose non-persistent fallback artwork. */
  name?: string | null;
  foodGroupTags?: readonly string[] | null;
  /** From `useFoodImageSource()`; hoisted so one cache serves a whole list. */
  getImageSource: GetFoodImageSource;
  size?: number;
  /** Meals use a dish illustration rather than a guessed ingredient. */
  variant?: 'food' | 'meal';
  /**
   * When false, an entity with no image renders nothing at all rather than a
   * placeholder box. Dense rows (the diary) use this so a photo-free day keeps
   * exactly the layout it had before images existed.
   */
  showFallback?: boolean;
  /** Opens the lightbox. Omit to leave the thumbnail non-interactive. */
  onPress?: () => void;
  /**
   * Applied to the outer container. Callers pass spacing here rather than
   * wrapping the thumbnail, so a collapsed thumbnail leaves no stray margin.
   */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The one food/meal image slot, shared by search, library, and diary rows so
 * sizing and the empty state stay identical across them.
 */
const FoodThumbnail: React.FC<FoodThumbnailProps> = ({
  image,
  name,
  foodGroupTags,
  getImageSource,
  size = 44,
  variant = 'food',
  showFallback = true,
  onPress,
  style,
  testID = 'food-thumbnail',
}) => {
  const { t } = useTranslation();
  const source = image ? getImageSource(image) : null;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const onImageError = useCallback(() => {
    setFailedSource(source?.uri ?? null);
  }, [source?.uri]);

  if (!source && !showFallback) {
    return null;
  }

  const box = { width: size, height: size, borderRadius: 8 };

  const canOpenPhoto = !!onPress && !!source && failedSource !== source.uri;
  const Container = onPress ? Pressable : View;

  return (
    <Container
      testID={testID}
      style={style}
      {...(onPress
        ? {
            onPress: canOpenPhoto ? onPress : undefined,
            disabled: !canOpenPhoto,
            accessibilityRole: canOpenPhoto
              ? ('imagebutton' as const)
              : undefined,
            accessibilityLabel: canOpenPhoto
              ? t('foodSearch.accessibility.viewPhoto', {
                  defaultValue: 'View photo',
                })
              : undefined,
            // Sibling pressable, never nested inside the row's own — nesting
            // leaves the inner one live while the parent is disabled. Matches
            // the exercise thumbnail pattern.
            hitSlop: 4,
          }
        : {})}
    >
      <SafeImage
        source={source}
        onTerminalError={onImageError}
        style={box}
        contentFit="cover"
        fallback={
          <View
            className="bg-raised items-center justify-center overflow-hidden"
            style={box}
          >
            <Image
              source={foodFallbackImage(
                name,
                variant === 'meal',
                foodGroupTags
              )}
              style={box}
              contentFit="contain"
              accessibilityLabel={undefined}
            />
          </View>
        }
      />
    </Container>
  );
};

export default FoodThumbnail;
