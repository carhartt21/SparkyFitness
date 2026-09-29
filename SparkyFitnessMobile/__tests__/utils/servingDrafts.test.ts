import {
  buildSaveServingsBody,
  draftPreviewNutrition,
  draftsDiffer,
  draftsFromVariants,
  validateServingDrafts,
  type ServingBasis,
} from '../../src/utils/servingDrafts';
import type { FoodVariantDetail } from '../../src/types/foods';

const basisRow: FoodVariantDetail = {
  id: 'basis',
  food_id: 'food-1',
  serving_size: 100,
  serving_unit: 'g',
  metric_amount: 100,
  metric_unit: 'g',
  calories: 50,
  protein: 1,
  carbs: 12,
  fat: 0.2,
  is_default: true,
  sort_order: 0,
};
const medium: FoodVariantDetail = {
  ...basisRow,
  id: 'medium',
  serving_label: 'Medium',
  serving_size: 1,
  serving_unit: 'piece',
  metric_amount: 130,
  calories: 65,
  protein: 1.3,
  carbs: 15.6,
  fat: 0.26,
  is_default: false,
  sort_order: 2,
};
const slice: FoodVariantDetail = {
  ...basisRow,
  id: 'slice',
  serving_size: 1,
  serving_unit: 'slice',
  metric_amount: null,
  metric_unit: null,
  calories: 20,
  protein: 1,
  carbs: 3,
  fat: 0.5,
  is_default: false,
  sort_order: 1,
};
const basis: ServingBasis = {
  serving_size: 100,
  serving_unit: 'g',
  calories: 50,
  protein: 1,
  carbs: 12,
  fat: 0.2,
};

describe('servingDrafts', () => {
  const drafts = draftsFromVariants([medium, basisRow, slice], 'basis');

  it('loads portions in order and marks rows with their own nutrition', () => {
    expect(
      drafts.map((d) => [
        d.id,
        d.label,
        d.amountText,
        d.weightText,
        d.ownNutrition,
      ])
    ).toEqual([
      ['slice', '', '1', '', true],
      ['medium', 'Medium', '1', '130', false],
    ]);
    expect(draftsDiffer(drafts, drafts)).toBe(false);
    expect(draftsDiffer([drafts[1], drafts[0]], drafts)).toBe(true);
  });

  it('keeps own nutrition unless the row is re-weighed', () => {
    expect(validateServingDrafts(drafts, basis)).toEqual({});
    const reweighed = { ...drafts[0], reweighed: true };
    expect(validateServingDrafts([reweighed], basis)).toEqual({
      slice: 'weight',
    });
    const weighed = { ...reweighed, weightText: '30' };
    expect(validateServingDrafts([weighed], basis)).toEqual({});
    expect(draftPreviewNutrition(weighed, basis, slice)?.calories).toBeCloseTo(
      15
    );
    expect(draftPreviewNutrition(drafts[0], basis, slice)?.calories).toBe(20);
  });

  it('flags invalid, duplicate and unweighed rows', () => {
    const blank = { ...drafts[1], key: 'a', id: undefined, amountText: '' };
    const dup = { ...drafts[1], key: 'b', id: undefined };
    const noWeight = {
      ...drafts[1],
      key: 'c',
      id: undefined,
      label: 'Bowl',
      unit: 'bowl',
      weightText: '',
    };
    const sameUnitAsBasis = {
      ...noWeight,
      key: 'd',
      label: 'Handful',
      unit: 'g',
      amountText: '30',
    };
    expect(
      validateServingDrafts(
        [drafts[1], blank, dup, noWeight, sameUnitAsBasis],
        basis
      )
    ).toEqual({ a: 'amount', b: 'duplicate', c: 'weight' });
  });

  it('builds one save request with order, weights and deletions', () => {
    const body = buildSaveServingsBody({
      drafts: [drafts[1]],
      baseline: drafts,
      basis,
      basisWeightText: '',
      basisWeightUnit: 'g',
      basisWeightChanged: false,
    });
    expect(body).toEqual({
      servings: [
        {
          id: 'medium',
          serving_label: 'Medium',
          serving_size: 1,
          serving_unit: 'piece',
          metric_amount: 130,
          sort_order: 0,
          derive: true,
        },
      ],
      deleted_ids: ['slice'],
    });
    expect(
      buildSaveServingsBody({
        drafts: [],
        baseline: [],
        basis,
        basisWeightText: '45',
        basisWeightUnit: 'g',
        basisWeightChanged: true,
        confirmCascade: true,
      })
    ).toEqual({
      servings: [],
      deleted_ids: [],
      basis_metric_amount: 45,
      basis_metric_unit: 'g',
      confirm_cascade: true,
    });
  });
});
