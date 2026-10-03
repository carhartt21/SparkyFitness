import {
  foodFallbackGroup,
  openFoodFactsArtworkSlug,
  openFoodFactsFallbackGroup,
} from '@workspace/shared';
import { foodFallbackImageSrc } from '@/utils/foodFallbackImages';
import { OPEN_FOOD_FACTS_GROUP_TAGS } from '../fixtures/openFoodFactsGroupTags';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

describe('food fallback artwork', () => {
  it.each([
    ['G561100', 'Tomato raw', 'tomato-raw'],
    ['G561132', 'Tomate gekocht', 'tomato-cooked'],
    ['G560400', 'Tomato dried', 'tomato-dried'],
    ['C352000', 'White rice raw', 'rice-dry'],
    ['C352032', 'Reis poliert, gekocht', 'rice-cooked'],
    ['C351000', 'Brown rice raw', 'rice-brown-dry'],
    ['C351032', 'Brown rice boiled', 'rice-brown-cooked'],
    ['F110100', 'Apple raw', 'apple-raw'],
    ['R161200', 'Tomaten passiert/Tomatenpüree', 'tomato-sauce'],
    ['K701100', 'Champignon roh', 'mushrooms'],
    ['H310100', 'Pumpkin seeds', 'seeds'],
    ['C214100', 'Wheat flour', 'flour'],
    ['C217000', 'Wheat bran', 'bran'],
    ['K230000', 'Potato starch', 'starch'],
    ['M882000', 'Whole milk powder', 'milk-powder'],
    ['M713100', 'Magerquark', 'quark'],
    ['H861000', 'Tofu', 'tofu'],
    ['H510802', 'Green olives', 'olives'],
    ['V416100', 'Chicken breast raw', 'poultry-raw'],
    ['V416182', 'Chicken breast cooked', 'poultry-cooked'],
    ['E401032', 'Pasta cooked', 'pasta-cooked'],
    ['N420900', 'Instant coffee powder', 'coffee-powder'],
  ])(
    'resolves %s to a shipped preparation-specific asset',
    (code, name, slug) => {
      expect(
        foodFallbackImageSrc(name, false, null, {
          provider_type: 'bls4',
          provider_external_id: code,
        })
      ).toBe(`/images/food-artwork/${slug}.webp`);
      expect(
        existsSync(
          join(process.cwd(), 'public/images/food-artwork', slug + '.webp')
        )
      ).toBe(true);
    }
  );
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
      expect(openFoodFactsArtworkSlug([tag])).toBe(
        tag.startsWith('en:unknown-food-group-') ? null : tag.slice(3)
      );
      if (!tag.startsWith('en:unknown-food-group-')) {
        expect(
          existsSync(
            join(
              process.cwd(),
              'public/images/off-food-groups',
              `${tag.slice(3)}.webp`
            )
          )
        ).toBe(true);
      }
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
      `/images/off-food-groups/${tag.slice(3)}.webp`
    );
  });

  it('uses the most specific OFF group over broad ancestors and ambiguous names', () => {
    expect(
      openFoodFactsArtworkSlug([
        'en:cereals-and-potatoes',
        'en:cereals',
        'en:white-pasta',
        'en:unknown-food-group-3',
      ])
    ).toBe('white-pasta');
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
    expect(
      foodFallbackImageSrc('Rice', false, ['en:unknown-food-group-1'])
    ).toBe('/images/food-fallbacks/grains.webp');
  });
});
