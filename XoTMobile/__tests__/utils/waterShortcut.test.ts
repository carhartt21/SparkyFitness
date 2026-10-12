import i18n, { initializeI18n } from '../../src/localization/i18n';
import type { WaterContainer } from '../../src/types/measurements';
import { waterShortcut } from '../../src/utils/waterShortcut';

const container: WaterContainer = {
  id: 1,
  name: 'Große Flasche',
  volume: 1000,
  unit: 'ml',
  servings_per_container: 4,
  is_primary: true,
};
beforeAll(async () => {
  await initializeI18n('de');
});
afterEach(async () => {
  await i18n.changeLanguage('en');
});

test('describes the amount per tap rather than the full container capacity', () => {
  const tile = waterShortcut(container, 'ml', i18n.t);
  expect(tile).toMatchObject({ label: 'Große Flasche', sublabel: '250 ml' });
  expect(tile?.accessibilityLabel).toContain('250 ml');
  expect(tile?.accessibilityLabel).not.toContain('1000');
});
test('uses the active container and localized display unit', async () => {
  await i18n.changeLanguage('de');
  expect(
    waterShortcut(
      { ...container, name: 'Glas', volume: 500, servings_per_container: 2 },
      'liter',
      i18n.t
    )
  ).toMatchObject({ label: 'Glas', sublabel: '0,25 L' });
  expect(waterShortcut(container, 'oz', i18n.t)?.sublabel).toBe('8,5 oz');
});
test('shows a linked drink in its actual portion unit without inventing water volume', async () => {
  await i18n.changeLanguage('de');
  const linked = {
    ...container,
    volume: 0,
    linked_food_id: 'food',
    linked_quantity: 1.5,
    linked_variant_serving_unit: 'serving',
  };
  expect(waterShortcut(linked, 'ml', i18n.t)?.sublabel).toBe('1,5 Portionen');
  expect(
    waterShortcut(
      { ...linked, linked_variant_serving_unit: null },
      'ml',
      i18n.t
    )?.sublabel
  ).toBe('Verknüpftes Getränk');
});
test('does not manufacture a loading container', () => {
  expect(waterShortcut(undefined, 'ml', i18n.t)).toBeUndefined();
});
