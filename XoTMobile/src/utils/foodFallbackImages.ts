import {
  foodArtworkKey,
  type FoodArtworkIdentity,
  type SpecificFoodArtwork,
  type FoodFallbackGroup,
} from '@workspace/shared';
import { OFF_FOOD_GROUP_IMAGES } from './offFoodGroupImages';

const specificImages: Record<SpecificFoodArtwork, number> = {
  'tomato-raw': require('../../assets/food-artwork/tomato-raw.png'),
  'tomato-sauce': require('../../assets/food-artwork/tomato-sauce.png'),
  'apple-raw': require('../../assets/food-artwork/apple-raw.png'),
  'rice-dry': require('../../assets/food-artwork/rice-dry.png'),
  'rice-cooked': require('../../assets/food-artwork/rice-cooked.png'),
  'rice-brown-dry': require('../../assets/food-artwork/rice-brown-dry.png'),
  'rice-brown-cooked': require('../../assets/food-artwork/rice-brown-cooked.png'),
  'tomato-cooked': require('../../assets/food-artwork/tomato-cooked.png'),
  'tomato-dried': require('../../assets/food-artwork/tomato-dried.png'),
  mushrooms: require('../../assets/food-artwork/mushrooms.png'),
};

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
  potatoes: require('../../assets/food-fallbacks/potatoes.png'),
  cereals: require('../../assets/food-fallbacks/cereals.png'),
  oils: require('../../assets/food-fallbacks/oils.png'),
  salty_snacks: require('../../assets/food-fallbacks/salty_snacks.png'),
  soups: require('../../assets/food-fallbacks/soups.png'),
  cheese: require('../../assets/food-fallbacks/cheese.png'),
  ice_cream: require('../../assets/food-fallbacks/ice_cream.png'),
  pastries: require('../../assets/food-fallbacks/pastries.png'),
  sandwiches: require('../../assets/food-fallbacks/sandwiches.png'),
  hot_drinks: require('../../assets/food-fallbacks/hot_drinks.png'),
  plant_drinks: require('../../assets/food-fallbacks/plant_drinks.png'),
  pasta: require('../../assets/food-fallbacks/pasta.png'),
  processed_meat: require('../../assets/food-fallbacks/processed_meat.png'),
  baby_food: require('../../assets/food-fallbacks/baby_food.png'),
  alcohol: require('../../assets/food-fallbacks/alcohol.png'),
  honey: require('../../assets/food-fallbacks/honey.png'),
  generic: require('../../assets/food-fallbacks/generic.png'),
};

export function foodFallbackImage(
  name: string | null | undefined,
  isMeal = false,
  foodGroupTags?: readonly string[] | null,
  identity?: FoodArtworkIdentity | null
): number {
  const key = foodArtworkKey(name, isMeal, foodGroupTags, identity);
  if (key.startsWith('food:'))
    return specificImages[key.slice(5) as SpecificFoodArtwork];
  if (key.startsWith('off:'))
    return OFF_FOOD_GROUP_IMAGES[key.slice(4)] ?? images.generic;
  return images[key.slice(6) as FoodFallbackGroup];
}
