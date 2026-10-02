import {
  Clock,
  GlassWater,
  Layers,
  Moon,
  Sun,
  Sunrise,
  Utensils,
} from 'lucide-react';
import type { MealTypeIcon as MealIconKey } from '@workspace/shared';

const icons = {
  'meal-breakfast': Sunrise,
  'meal-lunch': Sun,
  'meal-dinner': Moon,
  'meal-snack': Clock,
  food: Utensils,
  water: GlassWater,
  meal: Layers,
};

export default function MealTypeIcon({
  icon,
  className,
}: {
  icon: MealIconKey;
  className?: string;
}) {
  const Glyph = icons[icon];
  return <Glyph className={className} aria-hidden="true" />;
}
