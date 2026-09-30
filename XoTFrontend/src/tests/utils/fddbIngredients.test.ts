import {
  getFddbIngredients,
  resolveFddbIngredient,
} from '@/utils/fddbIngredients';

const marker = `FDDB import fddb:${'a'.repeat(64)}`;
const notes = `${marker}\nUnlinked ingredients: 200 g Apple, Example Brand, 250 g Quark, Low fat, 150 g Yogurt, 1.8%\nPreparation: 0 min; cooking: 0 min.`;

describe('FDDB ingredient review', () => {
  it('keeps commas inside names and percentages while separating portions', () => {
    expect(getFddbIngredients(notes)).toEqual([
      {
        label: '200 g Apple, Example Brand',
        name: 'Apple, Example Brand',
        quantity: 200,
        unit: 'g',
      },
      {
        label: '250 g Quark, Low fat',
        name: 'Quark, Low fat',
        quantity: 250,
        unit: 'g',
      },
      {
        label: '150 g Yogurt, 1.8%',
        name: 'Yogurt, 1.8%',
        quantity: 150,
        unit: 'g',
      },
    ]);
  });

  it('converts kilograms/liters and keeps decimal-comma amounts and pieces', () => {
    expect(
      getFddbIngredients(
        `${marker}\nUnlinked ingredients: 0,5 kg Rice, 1,25 l Milk, 2 Stück Eggs`
      ).map(({ quantity, unit }) => ({ quantity, unit }))
    ).toEqual([
      { quantity: 500, unit: 'g' },
      { quantity: 1250, unit: 'ml' },
      { quantity: 2, unit: 'piece' },
    ]);
  });

  it('requires manual amounts for unsupported or zero portions', () => {
    expect(
      getFddbIngredients(
        `${marker}\nUnlinked ingredients: 0 g Rice, 2 tbsp Oil`
      ).map(({ quantity }) => quantity)
    ).toEqual([undefined, undefined]);
  });

  it('retains duplicate ingredients until each occurrence is reviewed', () => {
    const duplicate = `${marker}\nUnlinked ingredients: 20 g Rice, 20 g Rice\nPreparation: 0 min; cooking: 0 min.`;
    const partial = resolveFddbIngredient(duplicate, 0);
    expect(getFddbIngredients(partial)).toHaveLength(1);
    expect(partial).toContain('Original ingredients: 20 g Rice, 20 g Rice');
    const complete = resolveFddbIngredient(partial, 0);
    expect(getFddbIngredients(complete)).toEqual([]);
    expect(complete).toContain(marker);
    expect(complete).toContain('Preparation: 0 min; cooking: 0 min.');
    expect(complete.match(/Original ingredients:/g)).toHaveLength(1);
  });

  it('does not interpret ordinary meal notes as an FDDB draft', () => {
    expect(getFddbIngredients('Unlinked ingredients: 20 g Rice')).toEqual([]);
    expect(resolveFddbIngredient(notes, 99)).toBe(notes);
  });
});
