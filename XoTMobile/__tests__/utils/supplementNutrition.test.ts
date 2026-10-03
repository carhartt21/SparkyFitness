import {
  NATIVE_MICRONUTRIENT_MAPPINGS,
  getMicronutrientById,
} from '@workspace/shared';
import {
  SUPPLEMENT_FIXED_FIELDS,
  SUPPLEMENT_NATIVE_FIELDS,
  supplementNutritionDraft,
  parseSupplementNutritionDraft,
  applySupplementNutritionDraft,
} from '../../src/utils/supplementNutrition';

describe('supplement nutrition editor', () => {
  const definitions = [
    { id: 'mg', name: 'Magnesium', unit: 'g', catalog_id: 'magnesium' },
  ];
  it('offers every native vitamin/mineral and fiber without duplicate fixed fields', () => {
    for (const mapping of NATIVE_MICRONUTRIENT_MAPPINGS) {
      const catalog = getMicronutrientById(mapping.catalogId)!;
      expect(
        [...SUPPLEMENT_FIXED_FIELDS, ...SUPPLEMENT_NATIVE_FIELDS].some(
          (field) =>
            field.key === (catalog.fixedField ?? `catalog:${catalog.id}`)
        )
      ).toBe(true);
    }
    expect(
      SUPPLEMENT_FIXED_FIELDS.some((field) => field.key === 'dietary_fiber')
    ).toBe(true);
    const keys = [...SUPPLEMENT_FIXED_FIELDS, ...SUPPLEMENT_NATIVE_FIELDS].map(
      (field) => field.key
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('preserves saved units and unrecognized custom nutrient metadata', () => {
    const previous = {
      dietary_fiber: 2,
      custom_nutrients: { Magnesium: 0.05, Creatine: 3 },
    };
    const draft = supplementNutritionDraft(previous, definitions);
    expect(draft).toMatchObject({
      dietary_fiber: '2',
      'catalog:magnesium': '0.05',
    });
    draft['catalog:magnesium'] = '0,1';
    const saved = applySupplementNutritionDraft(
      parseSupplementNutritionDraft(draft),
      previous,
      definitions,
      [{ catalogId: 'magnesium', name: 'Magnesium' }]
    );
    expect(saved).toEqual({
      dietary_fiber: 2,
      custom_nutrients: { Magnesium: 0.1, Creatine: 3 },
    });
  });
  it('converts a new catalog value into an already-existing storage unit', () => {
    expect(
      applySupplementNutritionDraft(
        { 'catalog:magnesium': 100 },
        {},
        [],
        [{ catalogId: 'magnesium', name: 'Magnesium' }],
        definitions
      )
    ).toEqual({ custom_nutrients: { Magnesium: 0.1 } });
  });
  it('keeps blanks unknown, explicit zero known, and clears only edited native rows', () => {
    expect(
      parseSupplementNutritionDraft({
        dietary_fiber: '',
        'catalog:magnesium': '0',
      })
    ).toEqual({ 'catalog:magnesium': 0 });
    expect(
      applySupplementNutritionDraft(
        {},
        { custom_nutrients: { Magnesium: 3, Creatine: 5 } },
        definitions,
        []
      )
    ).toEqual({ custom_nutrients: { Creatine: 5 } });
  });
  it.each(['-1', 'Infinity', 'NaN', '1,2,3', '3 mg'])(
    'rejects %s before provisioning',
    (value) => {
      expect(() =>
        parseSupplementNutritionDraft({ 'catalog:magnesium': value })
      ).toThrow();
    }
  );
  it('refuses unbound or incompatible native units instead of guessing', () => {
    expect(() =>
      applySupplementNutritionDraft(
        { 'catalog:magnesium': 100 },
        {},
        [],
        [],
        definitions
      )
    ).toThrow();
    expect(() =>
      applySupplementNutritionDraft(
        { 'catalog:magnesium': 100 },
        {},
        [],
        [{ catalogId: 'magnesium', name: 'Magnesium' }],
        [{ ...definitions[0], unit: 'IU' }]
      )
    ).toThrow();
  });
});
