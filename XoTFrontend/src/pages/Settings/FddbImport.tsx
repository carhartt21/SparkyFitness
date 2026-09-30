import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useFddbImport,
  type FddbExtraResults,
} from '@/hooks/Settings/useFddbImport';
import { parseFddbExport, type FddbExport } from '@/utils/fddbExport';
import { importFddbDiaryBatches } from '@/utils/fddbImportBatches';
import type { FddbExtras } from '@workspace/shared';

type ExtraSection = keyof FddbExtras;
const sections: ExtraSection[] = [
  'customFoods',
  'recipes',
  'favorites',
  'measurements',
  'activities',
];
const emptySelection = (): Record<ExtraSection, boolean> => ({
  customFoods: false,
  recipes: false,
  favorites: false,
  measurements: false,
  activities: false,
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** FDDB account exports are parsed on-device; only selected structured rows reach the API. */
export default function FddbImport() {
  const { t } = useTranslation();
  const {
    importDiaryBatch,
    importExtras: sendExtras,
    invalidate,
  } = useFddbImport();
  const [exportData, setExportData] = useState<FddbExport | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [diaryProgress, setDiaryProgress] = useState(0);
  const [diaryResult, setDiaryResult] = useState({
    imported: 0,
    alreadyPresent: 0,
  });
  const [extraResults, setExtraResults] = useState<FddbExtraResults | null>(
    null
  );
  const [selected, setSelected] =
    useState<Record<ExtraSection, boolean>>(emptySelection);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [selectedFoodKeys, setSelectedFoodKeys] = useState<Set<string>>(
    new Set()
  );
  const [selectedRecipeKeys, setSelectedRecipeKeys] = useState<Set<string>>(
    new Set()
  );
  const [selectedFavoriteNames, setSelectedFavoriteNames] = useState<
    Set<string>
  >(new Set());
  const [selectedWeightDates, setSelectedWeightDates] = useState<Set<string>>(
    new Set()
  );
  const [selectedActivityKeys, setSelectedActivityKeys] = useState<Set<string>>(
    new Set()
  );

  const diaryCount = exportData?.diary.length ?? 0;
  const selectedExtras = useMemo<FddbExtras | null>(() => {
    if (!exportData) return null;
    return {
      customFoods: selected.customFoods
        ? exportData.customFoods.filter((food) =>
            selectedFoodKeys.has(food.sourceKey)
          )
        : [],
      recipes: selected.recipes
        ? exportData.recipes.filter((recipe) =>
            selectedRecipeKeys.has(recipe.sourceKey)
          )
        : [],
      favorites: selected.favorites
        ? exportData.favorites.filter((name) => selectedFavoriteNames.has(name))
        : [],
      measurements: selected.measurements
        ? exportData.measurements.filter((item) =>
            selectedWeightDates.has(item.date)
          )
        : [],
      activities: selected.activities
        ? exportData.activities.filter((item) =>
            selectedActivityKeys.has(item.sourceKey)
          )
        : [],
    };
  }, [
    exportData,
    selected,
    selectedFoodKeys,
    selectedRecipeKeys,
    selectedFavoriteNames,
    selectedWeightDates,
    selectedActivityKeys,
  ]);
  const extraCount = selectedExtras
    ? sections.reduce(
        (total, section) => total + selectedExtras[section].length,
        0
      )
    : 0;

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setError('');
    setExportData(null);
    setFileName('');
    setDiaryProgress(0);
    setDiaryResult({ imported: 0, alreadyPresent: 0 });
    setExtraResults(null);
    setSelected(emptySelection());
    if (file.size > 10 * 1024 * 1024) {
      setError(
        t(
          'settings.dataImport.fddb.tooLarge',
          'Choose an export smaller than 10 MB.'
        )
      );
      return;
    }
    try {
      const parsed = parseFddbExport(await file.text());
      setExportData(parsed);
      setFileName(file.name);
      setSelectedFoodKeys(
        new Set(parsed.customFoods.map((food) => food.sourceKey))
      );
      setSelectedRecipeKeys(
        new Set(parsed.recipes.map((recipe) => recipe.sourceKey))
      );
      setSelectedFavoriteNames(new Set(parsed.favorites));
      setSelectedWeightDates(
        new Set(parsed.measurements.map((item) => item.date))
      );
      setSelectedActivityKeys(
        new Set(parsed.activities.map((item) => item.sourceKey))
      );
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const importDiary = async () => {
    if (!exportData || busy) return;
    setBusy(true);
    setError('');
    try {
      await importFddbDiaryBatches(
        exportData.diary,
        diaryProgress,
        importDiaryBatch,
        (processed, result) => {
          setDiaryResult((previous) => ({
            imported: previous.imported + result.imported,
            alreadyPresent: previous.alreadyPresent + result.alreadyPresent,
          }));
          setDiaryProgress(processed);
        },
        () => mounted.current
      );
      invalidate();
    } catch (cause) {
      setError(
        t(
          'settings.dataImport.fddb.batchError',
          'Import stopped. The completed batches are safe; retry to continue. {{error}}',
          { error: errorMessage(cause) }
        )
      );
      invalidate();
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const importExtras = async () => {
    if (!selectedExtras || !extraCount || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await sendExtras(selectedExtras);
      if (mounted.current) setExtraResults(result);
      invalidate();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const toggleItem = (
    key: string,
    checked: boolean,
    current: Set<string>,
    setter: (value: Set<string>) => void
  ) => {
    const next = new Set(current);
    if (checked) next.add(key);
    else next.delete(key);
    setter(next);
  };

  return (
    <div className="space-y-6 text-sm">
      <section className="space-y-2">
        <h3 className="font-semibold">
          {t('settings.dataImport.fddb.previewTitle', '1. Preview privately')}
        </h3>
        <p className="text-muted-foreground">
          {t(
            'settings.dataImport.fddb.previewDescription',
            'Choose a complete FDDB account CSV. Parsing happens in this browser. Profile, transactions, and images are not uploaded.'
          )}
        </p>
        <input
          aria-label={t(
            'settings.dataImport.fddb.chooseFile',
            'Choose FDDB export CSV'
          )}
          type="file"
          disabled={busy}
          accept=".csv,text/csv"
          onChange={readFile}
          className="block w-full max-w-md rounded-md border p-2"
        />
        {exportData && (
          <div className="rounded-md border bg-muted/30 p-4 space-y-2">
            <p className="font-medium">{fileName}</p>
            <p>
              {exportData.dateRange
                ? `${exportData.dateRange.first} – ${exportData.dateRange.last}`
                : t('settings.dataImport.fddb.noDates', 'No diary dates found')}
            </p>
            <p>
              {t(
                'settings.dataImport.fddb.previewCounts',
                '{{diary}} food entries · {{foods}} custom foods · {{recipes}} saved lists · {{favorites}} favorites · {{measurements}} weights · {{activities}} activities',
                {
                  diary: diaryCount,
                  foods: exportData.customFoods.length,
                  recipes: exportData.recipes.length,
                  favorites: exportData.favorites.length,
                  measurements: exportData.measurements.length,
                  activities: exportData.activities.length,
                }
              )}
            </p>
            <p className="text-muted-foreground">
              {t(
                'settings.dataImport.fddb.excluded',
                'Excluded: {{profiles}} profile rows, {{transactions}} transaction rows, {{images}} image references.',
                {
                  profiles: exportData.ignoredProfileCount,
                  transactions: exportData.ignoredTransactionCount,
                  images: exportData.imageCount,
                }
              )}
            </p>
            {exportData.warnings.length > 0 && (
              <details>
                <summary className="cursor-pointer">
                  {t(
                    'settings.dataImport.fddb.warnings',
                    '{{count}} rows need attention',
                    { count: exportData.warnings.length }
                  )}
                </summary>
                <ul className="max-h-40 overflow-y-auto list-disc pl-5 text-muted-foreground">
                  {exportData.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      {exportData && (
        <>
          <section className="space-y-3 border-t pt-5">
            <h3 className="font-semibold">
              {t(
                'settings.dataImport.fddb.diaryTitle',
                '2. Restore diary history'
              )}
            </h3>
            <p className="text-muted-foreground">
              {t(
                'settings.dataImport.fddb.diaryDescription',
                'Each logged item becomes a separate historical entry with its original date, time, energy, and macros. Existing entries stay unchanged. Re-running this export skips its imported rows, but entries from other sources are not merged automatically.'
              )}
            </p>
            <p role="status">
              {t(
                'settings.dataImport.fddb.progress',
                '{{done}} / {{total}} processed · {{imported}} imported · {{existing}} already present',
                {
                  done: diaryProgress,
                  total: diaryCount,
                  imported: diaryResult.imported,
                  existing: diaryResult.alreadyPresent,
                }
              )}
            </p>
            <Button
              onClick={importDiary}
              disabled={busy || !diaryCount || diaryProgress === diaryCount}
            >
              {busy
                ? t('common.working', 'Working…')
                : diaryProgress > 0
                  ? t(
                      'settings.dataImport.fddb.continue',
                      'Continue diary import'
                    )
                  : t(
                      'settings.dataImport.fddb.importDiary',
                      'Import diary entries'
                    )}
            </Button>
          </section>

          <section className="space-y-4 border-t pt-5">
            <h3 className="font-semibold">
              {t(
                'settings.dataImport.fddb.extrasTitle',
                '3. Review optional sections'
              )}
            </h3>
            <p className="text-muted-foreground">
              {t(
                'settings.dataImport.fddb.extrasDescription',
                'Select only the sections you want. Recipes become drafts with unlinked ingredient text; activities may overlap another activity sync source.'
              )}
            </p>
            {sections.map((section) => (
              <div key={section} className="rounded-md border p-3 space-y-2">
                <label className="flex min-h-11 items-center gap-3 font-medium">
                  <Checkbox
                    checked={selected[section]}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                      setSelected((previous) => ({
                        ...previous,
                        [section]: checked === true,
                      }))
                    }
                  />
                  {t(`settings.dataImport.fddb.${section}`, section)} (
                  {exportData[section].length})
                </label>
                {section === 'recipes' && selected.recipes && (
                  <p className="text-muted-foreground">
                    {t(
                      'settings.dataImport.fddb.recipeWarning',
                      'Open each draft in Foods → Meals to link its ingredients. Your food library is checked first; provider search is available for missing foods. Nutrition is calculated after review.'
                    )}
                  </p>
                )}
                {section === 'activities' && selected.activities && (
                  <p className="text-muted-foreground">
                    {t(
                      'settings.dataImport.fddb.activityWarning',
                      'Check your existing exercise and Health imports first to avoid overlapping activity totals.'
                    )}
                  </p>
                )}
                {section === 'customFoods' && selected.customFoods && (
                  <div className="max-h-48 overflow-y-auto space-y-1 pl-6">
                    {exportData.customFoods.map((food) => (
                      <label
                        key={food.sourceKey}
                        className="flex min-h-9 items-center gap-2"
                      >
                        <Checkbox
                          checked={selectedFoodKeys.has(food.sourceKey)}
                          disabled={busy}
                          onCheckedChange={(checked) =>
                            toggleItem(
                              food.sourceKey,
                              checked === true,
                              selectedFoodKeys,
                              setSelectedFoodKeys
                            )
                          }
                        />
                        {food.name}
                      </label>
                    ))}
                  </div>
                )}
                {section === 'recipes' && selected.recipes && (
                  <div className="max-h-48 overflow-y-auto space-y-1 pl-6">
                    {exportData.recipes.map((recipe) => (
                      <label
                        key={recipe.sourceKey}
                        className="flex min-h-9 items-center gap-2"
                      >
                        <Checkbox
                          checked={selectedRecipeKeys.has(recipe.sourceKey)}
                          disabled={busy}
                          onCheckedChange={(checked) =>
                            toggleItem(
                              recipe.sourceKey,
                              checked === true,
                              selectedRecipeKeys,
                              setSelectedRecipeKeys
                            )
                          }
                        />
                        {recipe.name}
                      </label>
                    ))}
                  </div>
                )}
                {section === 'favorites' && selected.favorites && (
                  <div className="max-h-48 overflow-y-auto space-y-1 pl-6">
                    {exportData.favorites.map((name) => (
                      <label
                        key={name}
                        className="flex min-h-9 items-center gap-2"
                      >
                        <Checkbox
                          checked={selectedFavoriteNames.has(name)}
                          disabled={busy}
                          onCheckedChange={(checked) =>
                            toggleItem(
                              name,
                              checked === true,
                              selectedFavoriteNames,
                              setSelectedFavoriteNames
                            )
                          }
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                )}
                {section === 'measurements' && selected.measurements && (
                  <div className="max-h-48 overflow-y-auto space-y-1 pl-6">
                    {exportData.measurements.map((item) => (
                      <label
                        key={item.date}
                        className="flex min-h-9 items-center gap-2"
                      >
                        <Checkbox
                          checked={selectedWeightDates.has(item.date)}
                          disabled={busy}
                          onCheckedChange={(checked) =>
                            toggleItem(
                              item.date,
                              checked === true,
                              selectedWeightDates,
                              setSelectedWeightDates
                            )
                          }
                        />
                        {item.date}: {item.weightKg} kg
                      </label>
                    ))}
                  </div>
                )}
                {section === 'activities' && selected.activities && (
                  <div className="max-h-48 overflow-y-auto space-y-1 pl-6">
                    {exportData.activities.map((item) => (
                      <label
                        key={item.sourceKey}
                        className="flex min-h-9 items-center gap-2"
                      >
                        <Checkbox
                          checked={selectedActivityKeys.has(item.sourceKey)}
                          disabled={busy}
                          onCheckedChange={(checked) =>
                            toggleItem(
                              item.sourceKey,
                              checked === true,
                              selectedActivityKeys,
                              setSelectedActivityKeys
                            )
                          }
                        />
                        {item.date} {item.time} · {item.name} ·{' '}
                        {Math.round(item.caloriesBurned)} kcal
                      </label>
                    ))}
                  </div>
                )}
                {extraResults &&
                  (extraResults[section].imported > 0 ||
                    extraResults[section].alreadyPresent > 0 ||
                    (extraResults[section].unmatched?.length ?? 0) > 0 ||
                    (extraResults[section].errors?.length ?? 0) > 0) && (
                    <p role="status">
                      {t(
                        'settings.dataImport.fddb.extraResult',
                        '{{imported}} imported · {{existing}} already present · {{unmatched}} unmatched · {{errors}} errors',
                        {
                          imported: extraResults[section].imported,
                          existing: extraResults[section].alreadyPresent,
                          unmatched:
                            extraResults[section].unmatched?.length ?? 0,
                          errors: extraResults[section].errors?.length ?? 0,
                        }
                      )}
                    </p>
                  )}
                {extraResults &&
                  ((extraResults[section].unmatched?.length ?? 0) > 0 ||
                    (extraResults[section].errors?.length ?? 0) > 0) && (
                    <details>
                      <summary className="cursor-pointer">
                        {t(
                          'settings.dataImport.fddb.reviewIssues',
                          'Review unmatched items and errors'
                        )}
                      </summary>
                      <ul className="max-h-48 overflow-y-auto list-disc pl-5 text-muted-foreground">
                        {extraResults[section].unmatched?.map((name, index) => (
                          <li key={`unmatched-${index}`}>
                            {t(
                              'settings.dataImport.fddb.unmatchedItem',
                              'No unique owned food matches: {{name}}',
                              { name }
                            )}
                          </li>
                        ))}
                        {extraResults[section].errors?.map((issue, index) => (
                          <li key={`error-${index}`}>
                            {issue.item}: {issue.message}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
              </div>
            ))}
            <Button onClick={importExtras} disabled={busy || extraCount === 0}>
              {t(
                'settings.dataImport.fddb.importSelected',
                'Import {{count}} selected items',
                { count: extraCount }
              )}
            </Button>
          </section>
        </>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive p-3 text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
