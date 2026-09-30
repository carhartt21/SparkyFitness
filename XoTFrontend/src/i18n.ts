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
      .replaceAll('XoTMobile', 'X on Track')
      .replaceAll('SparkyFitness', 'X on Track')
      .replaceAll('Sparky Fitness', 'X on Track')
      .replaceAll('SPARKY', 'TRACKBOT')
      .replaceAll('Sparky', 'Trackbot');
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
      // Browser locales commonly include regions (for example de-DE), while
      // most shipped catalogs use their base language. Normalize before the
      // detector caches a fallback, but preserve exact catalogs such as pt-BR.
      convertDetectedLanguage: (code: string) => {
        const normalized = code.replace('_', '-');
        const supported = getSupportedLanguages();
        const exact = supported.find(
          (language) => language.toLowerCase() === normalized.toLowerCase()
        );
        if (exact) return exact;
        const base = normalized.split('-')[0]?.toLowerCase();
        const baseMatch = supported.find(
          (language) => language.toLowerCase() === base
        );
        if (baseMatch) return baseMatch;
        const onlyRegionalMatch = supported.filter((language) =>
          language.toLowerCase().startsWith(`${base}-`)
        );
        return onlyRegionalMatch.length === 1
          ? (onlyRegionalMatch[0] ?? normalized)
          : normalized;
      },
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
