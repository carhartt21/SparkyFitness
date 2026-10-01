import { createInstance } from 'i18next';
import en from '../../../public/locales/en/translation.json';
import de from '../../../public/locales/de/translation.json';
import {
  medicationKindLabel,
  medicationEntryKindLabel,
} from '@/utils/medicationKindLabel';

const i18n = createInstance();
beforeAll(async () => {
  await i18n.init({
    resources: { en: { translation: en }, de: { translation: de } },
    lng: 'en',
    fallbackLng: 'en',
  });
});

describe('intake category presentation', () => {
  it.each([
    ['en', 'Medication', 'Supplement', 'Category unavailable'],
    ['de', 'Medikament', 'Ergänzungsmittel', 'Kategorie nicht verfügbar'],
  ])(
    'distinguishes explicit categories and unavailable definitions in %s',
    (language, medication, supplement, unknown) => {
      const t = i18n.getFixedT(language);
      expect(medicationKindLabel({ is_supplement: false }, t)).toBe(medication);
      expect(medicationKindLabel({ is_supplement: true }, t)).toBe(supplement);
      expect(medicationKindLabel(undefined, t)).toBe(unknown);
      expect(
        medicationEntryKindLabel(
          { nutrients_snapshot: { protein: 3 } },
          { is_supplement: false },
          t
        )
      ).toBe(supplement);
      expect(
        medicationEntryKindLabel({ nutrients_snapshot: {} }, undefined, t)
      ).toBe(supplement);
      expect(
        medicationEntryKindLabel({ nutrients_snapshot: null }, undefined, t)
      ).toBe(unknown);
      expect(medicationEntryKindLabel({}, { is_supplement: false }, t)).toBe(
        medication
      );
    }
  );
});
