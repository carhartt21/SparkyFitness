import { useTranslation } from 'react-i18next';
/** Only known coaching metadata is translated; narrative content remains agent-authored. */
export function useCoachingCopy() {
  const { t } = useTranslation();
  return (key: string, fallback: string) => {
    // i18n-audit-ignore-next-line dynamic-i18n-key -- Bounded coaching schema metadata; coachingContracts.test verifies the English and reviewed German catalogs.
    return t(key, { defaultValue: fallback });
  };
}
