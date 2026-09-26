import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';
import { getSupportedLanguages } from './utils/languageUtils';

// Translated catalogs remain Weblate-owned. Replace the former product name in
// rendered translation values while leaving stable translation keys untouched.
const xOnTrackBrand = {
  type: 'postProcessor' as const,
  name: 'xOnTrackBrand',
  process(value: string): string {
    return value
      .replaceAll('PersonalBest', 'X on Track')
      .replaceAll('HealthIntel', 'X on Track')
      .replaceAll('SparkyFitnessMobile', 'X on Track')
      .replaceAll('SparkyFitness', 'X on Track')
      .replaceAll('Sparky Fitness', 'X on Track');
  },
};

i18n
  .use(HttpApi)
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(xOnTrackBrand)
  .init({
    supportedLngs: getSupportedLanguages(),
    fallbackLng: 'en',
    detection: {
      order: [
        'localStorage',
        'querystring',
        'cookie',
        'sessionStorage',
        'navigator',
        'htmlTag',
      ],
      caches: ['localStorage', 'cookie'],
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    interpolation: {
      escapeValue: false,
    },
    postProcess: ['xOnTrackBrand'],
    react: {
      useSuspense: false,
    },
  });

export default i18n;
