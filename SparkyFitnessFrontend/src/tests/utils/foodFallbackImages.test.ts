import {
  foodFallbackGroup,
  openFoodFactsFallbackGroup,
} from '@workspace/shared';
import { foodFallbackImageSrc } from '@/utils/foodFallbackImages';
import { OPEN_FOOD_FACTS_GROUP_TAGS } from '../fixtures/openFoodFactsGroupTags';

describe('food fallback artwork', () => {
  it.each([
    ['Tomate roh', 'vegetables'],
    ['Tomatensoße', 'condiments'],
    ['Salatblatt', 'vegetables'],
    ['Tomate frito Freshona', 'condiments'],
    ['Äpfel', 'fruit'],
    ['Apfelkuchen', 'sweets'],
    ['Reis gekocht', 'grains'],
    ['Milchreis', 'meals'],
    ['Rührei', 'eggs'],
    ['Vollkornbrot', 'bread'],
    ['Milch', 'dairy'],
    ['Hähnchenbrust', 'meat'],
    ['Lachs', 'seafood'],
    ['Kichererbsen', 'legumes'],
    ['Mandeln', 'nuts'],
    ['Mineralwasser', 'drinks'],
    ['Gemüsecurry', 'meals'],
    ['Unknown branded product', 'generic'],
    ['', 'generic'],
  ] as const)('%s uses %s artwork', (name, group) => {
    expect(foodFallbackGroup(name)).toBe(group);
    expect(foodFallbackImageSrc(name)).toBe(
      `/images/food-fallbacks/${group}.webp`
    );
  });

  it('uses dish artwork for a saved meal regardless of its name', () => {
    expect(foodFallbackGroup('Tomate roh', true)).toBe('meals');
  });

  it('covers every food group in the published OFF taxonomy snapshot', () => {
    expect(OPEN_FOOD_FACTS_GROUP_TAGS).toHaveLength(91);
    for (const tag of OPEN_FOOD_FACTS_GROUP_TAGS) {
      expect(openFoodFactsFallbackGroup([tag])).not.toBeNull();
    }
  });

  it.each([
    ['Tomatensuppe', 'en:fresh-soups', 'soups'],
    ['Schokoladeneis', 'en:ice-cream', 'ice_cream'],
    ['Haferdrink', 'en:plant-based-milk-substitutes', 'plant_drinks'],
    ['Penne', 'en:white-pasta', 'pasta'],
    ['Schinken', 'en:processed-meat', 'processed_meat'],
    ['Babynahrung', 'en:baby-foods', 'baby_food'],
    ['Vollkornbrot', 'en:whole-grain-bread', 'bread'],
    ['Tomatensoße', 'en:sauces', 'condiments'],
    ['Mineralwasser', 'en:waters-and-flavored-waters', 'drinks'],
  ] as const)('uses OFF group %s for %s', (name, tag, group) => {
    expect(
      foodFallbackGroup(name, false, ['en:unknown-food-group-1', tag])
    ).toBe(group);
    expect(foodFallbackImageSrc(name, false, [tag])).toBe(
      `/images/food-fallbacks/${group}.webp`
    );
  });

  it('uses the most specific OFF group over broad ancestors and ambiguous names', () => {
    expect(
      foodFallbackGroup('Chocolate Pasta', false, [
        'en:cereals-and-potatoes',
        'en:cereals',
        'en:white-pasta',
      ])
    ).toBe('pasta');
    expect(foodFallbackGroup('Rice', false, ['en:unknown-food-group-1'])).toBe(
      'grains'
    );
    expect(foodFallbackGroup('Rice', false, ['fr:riz'])).toBe('grains');
  });
});
