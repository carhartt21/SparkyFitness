import { createInstance } from 'i18next';
import en from '../../src/localization/locales/en/translation.json';
import de from '../../src/localization/locales/de/translation.json';
import {
  medicationKindLabel,
  medicationTypeLabel,
} from '../../src/utils/medicationLocalization';
import { SUPPLEMENT_FORMS } from '@workspace/shared';

const i18n = createInstance();
beforeAll(async () => {
  await i18n.init({
    resources: { en: { translation: en }, de: { translation: de } },
    lng: 'en',
    fallbackLng: 'en',
  });
});

describe('medication and supplement labels', () => {
  it.each([
    ['en', 'Medication', 'Supplement'],
    ['de', 'Medikament', 'Ergänzungsmittel'],
  ])(
    'uses saved classification in %s, including legacy cached medications',
    (language, medication, supplement) => {
      const t = i18n.getFixedT(language);
      expect(medicationKindLabel({ is_supplement: false }, t)).toBe(medication);
      expect(medicationKindLabel({}, t)).toBe(medication);
      expect(medicationKindLabel({ is_supplement: true }, t)).toBe(supplement);
    }
  );

  it('provides German labels for every supported supplement form', () => {
    const t = i18n.getFixedT('de');
    expect(
      SUPPLEMENT_FORMS.map((form) => medicationTypeLabel(form, t))
    ).toEqual([
      'Tablette',
      'Kapsel',
      'Weichkapsel',
      'Gummiform',
      'Pulver',
      'Flüssigkeit',
    ]);
  });
});
