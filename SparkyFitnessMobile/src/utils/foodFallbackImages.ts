import { foodFallbackGroup, type FoodFallbackGroup } from '@workspace/shared';

const images: Record<FoodFallbackGroup, number> = {
  vegetables: require('../../assets/food-fallbacks/vegetables.png'),
  fruit: require('../../assets/food-fallbacks/fruit.png'),
  bread: require('../../assets/food-fallbacks/bread.png'),
  grains: require('../../assets/food-fallbacks/grains.png'),
  dairy: require('../../assets/food-fallbacks/dairy.png'),
  eggs: require('../../assets/food-fallbacks/eggs.png'),
  meat: require('../../assets/food-fallbacks/meat.png'),
  seafood: require('../../assets/food-fallbacks/seafood.png'),
  legumes: require('../../assets/food-fallbacks/legumes.png'),
  nuts: require('../../assets/food-fallbacks/nuts.png'),
  drinks: require('../../assets/food-fallbacks/drinks.png'),
  sweets: require('../../assets/food-fallbacks/sweets.png'),
  condiments: require('../../assets/food-fallbacks/condiments.png'),
  meals: require('../../assets/food-fallbacks/meals.png'),
  generic: require('../../assets/food-fallbacks/generic.png'),
};

export function foodFallbackImage(
  name: string | null | undefined,
  isMeal = false
): number {
  return images[foodFallbackGroup(name, isMeal)];
}
