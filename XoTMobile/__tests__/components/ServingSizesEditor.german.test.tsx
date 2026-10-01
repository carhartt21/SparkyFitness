import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ServingSizesEditor from '../../src/components/foodForm/ServingSizesEditor';
import i18n, { initializeI18n } from '../../src/localization/i18n';
import type { ServingBasis, ServingDraft } from '../../src/utils/servingDrafts';

const basis: ServingBasis = {
  serving_size: 100,
  serving_unit: 'g',
  calories: 120,
  protein: 4,
  carbs: 20,
  fat: 2,
};

describe('German serving editor', () => {
  beforeEach(async () => {
    await initializeI18n('de');
    await i18n.changeLanguage('de');
  });

  it('names the icon action and keeps preview nutrients tied to the selected portion', () => {
    const onChange = jest.fn();
    const drafts: ServingDraft[] = [
      {
        key: 'review-half',
        label: 'Halbe Portion',
        amountText: '50',
        unit: 'g',
        weightText: '',
        ownNutrition: false,
        reweighed: false,
      },
    ];
    const view = render(
      <ServingSizesEditor
        basis={basis}
        drafts={drafts}
        onChange={onChange}
        storedVariants={undefined}
        basisWeightText=""
        basisWeightUnit="g"
        onBasisWeightChange={jest.fn()}
        errors={{}}
      />
    );
    expect(view.getByText('Portionsgrößen')).toBeTruthy();
    expect(
      view.getByText('Portionsgrößen für dieses Lebensmittel festlegen.')
    ).toBeTruthy();
    const add = view.getByRole('button', { name: 'Portionsgröße hinzufügen' });
    fireEvent.press(add);
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ key: 'review-half' })])
    );
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
    expect(view.getByLabelText('Kohlenhydrate: 20 g')).toBeTruthy();
    expect(view.getByLabelText('Protein: 4 g')).toBeTruthy();
    fireEvent.press(view.getByTestId('serving-preview-picker'));
    fireEvent.press(view.getByRole('radio', { name: 'Halbe Portion' }));
    expect(view.getByLabelText('Kohlenhydrate: 10 g')).toBeTruthy();
    expect(view.getByLabelText('Protein: 2 g')).toBeTruthy();
  });
});
