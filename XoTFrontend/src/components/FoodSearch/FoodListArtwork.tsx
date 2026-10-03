import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { foodFallbackImageSrc } from '@/utils/foodFallbackImages';
import type { FoodArtworkIdentity } from '@workspace/shared';

/** A real food photo remains interactive; illustrative artwork never opens a photo viewer. */
export default function FoodListArtwork({
  name,
  src,
  isMeal = false,
  foodIdentity,
  onOpen,
}: {
  name: string | null | undefined;
  src: string | null;
  isMeal?: boolean;
  foodIdentity?: FoodArtworkIdentity | null;
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || src === failedSrc) {
    return (
      <img
        src={foodFallbackImageSrc(name, isMeal, undefined, foodIdentity)}
        alt=""
        className="w-10 h-10 flex-shrink-0 object-contain rounded-md bg-muted/50"
        loading="lazy"
      />
    );
  }
  const image = (
    <img
      src={src}
      alt=""
      className="w-10 h-10 flex-shrink-0 object-cover rounded-md"
      loading="lazy"
      onError={() => setFailedSrc(src)}
    />
  );
  return onOpen ? (
    <button
      type="button"
      className="flex-shrink-0 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      onClick={onOpen}
      aria-label={t('food.viewImages', 'View images')}
    >
      {image}
    </button>
  ) : (
    image
  );
}
