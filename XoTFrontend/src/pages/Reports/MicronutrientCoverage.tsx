import { useNutrientCoverage } from '@/hooks/Reports/useReports';
import { useTranslation } from 'react-i18next';
import {
  HEALTH_MICRONUTRIENT_IDS,
  getMicronutrientById,
  averageRecordedNutrient,
} from '@workspace/shared';

export default function MicronutrientCoverage({
  startDate,
  endDate,
  userId,
}: {
  startDate: string;
  endDate: string;
  userId: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { data, isPending, isError } = useNutrientCoverage(
    startDate,
    endDate,
    userId
  );
  return (
    <section
      className="rounded-xl border border-border bg-card p-5"
      aria-label={t('micronutrients.title')}
    >
      <h2 className="text-lg font-semibold">{t('micronutrients.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('micronutrients.explanation')}
      </p>
      {isPending ? (
        <p className="mt-3 text-sm" role="status">
          {t('micronutrients.loading')}
        </p>
      ) : isError ? (
        <p className="mt-3 text-sm" role="alert">
          {t('micronutrients.error')}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            { title: 'vitamins', ids: HEALTH_MICRONUTRIENT_IDS.slice(0, 13) },
            { title: 'minerals', ids: HEALTH_MICRONUTRIENT_IDS.slice(13) },
          ].map((group) => (
            <details key={group.title} open>
              <summary className="cursor-pointer py-2 font-medium focus-visible:outline focus-visible:outline-2">
                {t(`micronutrients.${group.title}`)}
              </summary>
              <dl className="divide-y divide-border">
                {group.ids.map((id) => {
                  const catalog = getMicronutrientById(id)!;
                  const observations = Object.values(data ?? {}).flatMap(
                    (day) => (day[id] ? [day[id]!] : [])
                  );
                  const known = observations.reduce(
                    (sum, value) => sum + value.knownEntryCount,
                    0
                  );
                  const eligible = observations.reduce(
                    (sum, value) => sum + value.eligibleEntryCount,
                    0
                  );
                  const average = averageRecordedNutrient(data ?? {}, id);
                  return (
                    <div
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm"
                      key={id}
                    >
                      <dt>
                        {t(`micronutrients.names.${id}`, catalog.displayName)}
                      </dt>
                      <dd className="text-right tabular-nums">
                        <span>
                          {average === null
                            ? t('micronutrients.unknown')
                            : `${new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language, { maximumSignificantDigits: 4 }).format(average)} ${observations[0]?.unit ?? catalog.unit}`}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {t('micronutrients.coverage', { known, eligible })}
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
