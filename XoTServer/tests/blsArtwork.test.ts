import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyBlsFoodArtwork, foodArtworkKey } from '@workspace/shared';
import manifest from '../../shared/src/foodImages/blsArtworkManifest.json' with { type: 'json' };
import foods from './fixtures/blsArtworkFoods.json' with { type: 'json' };

// Names and codes copied from the pinned official archive, not fabricated foods.
const expected = {
  M5B1600: 'group:cheese',
  X321153: 'group:condiments',
  X820753: 'group:meals',
  X4A6030: 'group:soups',
  C351082: 'group:grains',
  X880453: 'group:meals',
  X820252: 'group:meals',
  X8A1020: 'group:meals',
  X437143: 'group:meals',
  Y9A2010: 'group:ice_cream',
  Y996510: 'group:ice_cream',
  E401000: 'group:pasta',
  E111100: 'group:eggs',
  K701100: 'food:mushrooms',
  H510802: 'food:olives',
  H640100: 'group:vegetables',
  N410100: 'group:hot_drinks',
  R411000: 'group:generic',
  C352000: 'food:rice-dry',
  C359000: 'food:rice-dry',
  C351000: 'food:rice-brown-dry',
  F110100: 'food:apple-raw',
  F110400: 'off:dried-fruits',
  G561100: 'food:tomato-raw',
  R161200: 'food:tomato-sauce',
  G561132: 'food:tomato-cooked',
  C351032: 'food:rice-brown-cooked',
  C352032: 'food:rice-cooked',
  G560400: 'food:tomato-dried',
  G561500: 'group:generic',
  X820162: 'food:rice-cooked',
  X321263: 'food:tomato-sauce',
  H310100: 'food:seeds',
  H480100: 'food:seeds',
  H450400: 'food:seeds',
  H320100: 'food:seeds',
  C214100: 'food:flour',
  C211000: 'food:flour',
  C217000: 'food:bran',
  C446000: 'food:starch',
  K230000: 'food:starch',
  K512000: 'food:starch',
  M882000: 'food:milk-powder',
  M713100: 'food:quark',
  M710100: 'food:quark',
  M711100: 'off:fresh-cheese',
  M148300: 'off:plain-milk-and-yogurt',
  M831100: 'food:quark',
  M772800: 'group:cheese',
  H861000: 'food:tofu',
  H861132: 'food:tofu',
  H861082: 'group:legumes',
  H910300: 'group:meals',
  H110800: 'off:nut-butter',
  H841100: 'off:plant-based-milk-substitutes',
  H154000: 'off:plant-based-milk-substitutes',
  H764400: 'food:flour',
  V416100: 'food:poultry-raw',
  V416182: 'food:poultry-cooked',
  V634100: 'off:offals',
  V434100: 'food:poultry-raw',
  V212100: 'group:meat',
  V990182: 'group:meat',
  E401032: 'food:pasta-cooked',
  E609132: 'group:pasta',
  E606032: 'group:pasta',
  N420100: 'group:hot_drinks',
  N420900: 'food:coffee-powder',
  N412900: 'group:hot_drinks',
  N503900: 'group:generic',
  G850100: 'group:generic',
  G850132: 'group:soups',
  K850532: 'group:soups',
  R481132: 'off:dairy-desserts',
  R481100: 'group:generic',
  C650000: 'off:plant-based-milk-substitutes',
  X432142: 'food:pasta-cooked',
  X740862: 'group:meals',
  X700062: 'group:meals',
  X912033: 'off:pizza-pies-and-quiches',
};

describe('BLS representative artwork', () => {
  it.each(foods)(
    '$code preserves identity and preparation across languages',
    (food) => {
      const key = expected[food.code as keyof typeof expected];
      expect(key).toBeDefined();
      expect(classifyBlsFoodArtwork(food).key).toBe(key);
      for (const name of [food.name_de, food.name_en, 'Renamed by owner']) {
        expect(
          foodArtworkKey(name, false, null, {
            provider_type: 'bls4',
            provider_external_id: food.code,
          })
        ).toBe(key);
      }
    }
  );

  it('covers all 7,140 distinct source identities with files on both platforms', () => {
    expect(manifest.dataset_sha256).toBe(
      '12b7a6ba62807ec9b301eb276f897dc85f99b2292311618dec3749a12d984c91'
    );
    const codes = Object.values(manifest.by_artwork).flat();
    expect(codes).toHaveLength(7140);
    expect(new Set(codes).size).toBe(7140);
    for (const [key, assignedCodes] of Object.entries(manifest.by_artwork)) {
      const [kind, slug] = key.split(':');
      const directory =
        kind === 'group'
          ? 'food-fallbacks'
          : kind === 'off'
            ? 'off-food-groups'
            : 'food-artwork';
      expect(
        existsSync(resolve('../XoTMobile/assets', directory, slug + '.png'))
      ).toBe(true);
      expect(
        existsSync(
          resolve('../XoTFrontend/public/images', directory, slug + '.webp')
        )
      ).toBe(true);
      expect(assignedCodes.length).toBeGreaterThan(0);
      for (const code of assignedCodes)
        expect(
          foodArtworkKey(null, false, null, {
            provider_type: 'bls4',
            provider_external_id: code,
          })
        ).toBe(key);
    }
  });

  it('does not apply BLS identity to another provider or an unknown code', () => {
    expect(
      foodArtworkKey('Tomatensauce', false, null, {
        provider_type: 'openfoodfacts',
        provider_external_id: 'G561100',
      })
    ).toBe('group:condiments');
    expect(
      foodArtworkKey(null, false, null, {
        provider_type: 'bls4',
        provider_external_id: '../../private',
      })
    ).toBe('group:generic');
    expect(
      foodArtworkKey('Tomate roh', true, null, {
        provider_type: 'bls4',
        provider_external_id: 'G561100',
      })
    ).toBe('group:meals');
  });
});
