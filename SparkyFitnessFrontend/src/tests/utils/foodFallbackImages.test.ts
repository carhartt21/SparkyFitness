import { foodFallbackGroup } from '@workspace/shared';
import { foodFallbackImageSrc } from '@/utils/foodFallbackImages';

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
});
