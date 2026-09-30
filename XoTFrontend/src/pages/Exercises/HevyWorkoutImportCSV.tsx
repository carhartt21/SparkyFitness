import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  useHevyCsvImport,
  type HevyCsvImportResult,
  type HevyCsvPreview,
} from '@/hooks/Exercises/useHevyCsvImport';

const MAX_CSV_BYTES = 20_000_000;

export default function HevyWorkoutImportCSV() {
  const { t } = useTranslation();
  const { timezone: preferredTimezone } = usePreferences();
  const { preview: previewCsv, importCsv } = useHevyCsvImport();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [timezone, setTimezone] = useState(preferredTimezone || 'UTC');
  const [preview, setPreview] = useState<HevyCsvPreview | null>(null);
  const [result, setResult] = useState<HevyCsvImportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [reviewedDuplicates, setReviewedDuplicates] = useState(false);
  const fileReadId = useRef(0);
  const exerciseMappings = preview?.exerciseMappings ?? [];
  const potentialDuplicateSessions = preview?.potentialDuplicateSessions ?? [];

  const handleFile = async (file: File | undefined) => {
    const readId = ++fileReadId.current;
    setPreview(null);
    setResult(null);
    setError('');
    setCsv('');
    setFileName(file?.name ?? '');
    setReviewedDuplicates(false);
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      setError(
        t(
          'settings.dataImport.hevy.fileTooLarge',
          'The CSV must be under 20 MB.'
        )
      );
      return;
    }
    try {
      const contents = await file.text();
      if (readId === fileReadId.current) setCsv(contents);
    } catch {
      if (readId === fileReadId.current) {
        setError(
          t('settings.dataImport.hevy.readFailed', 'Could not read this file.')
        );
      }
    }
  };

  const runPreview = async () => {
    setBusy('preview');
    setError('');
    setPreview(null);
    setResult(null);
    setReviewedDuplicates(false);
    try {
      setPreview(await previewCsv(csv, timezone.trim()));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    if (
      !preview?.timezoneValidated ||
      (potentialDuplicateSessions.length > 0 && !reviewedDuplicates)
    )
      return;
    setBusy('import');
    setError('');
    try {
      const imported = await importCsv(csv, timezone.trim());
      setResult(imported);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {t(
          'settings.dataImport.hevy.description',
          'Import completed workouts from a Hevy history export. Saved routines are separate and require a Hevy API connection.'
        )}
      </p>

      <div className="space-y-2">
        <label htmlFor="hevy-csv-file" className="text-sm font-medium">
          {t('settings.dataImport.hevy.file', 'Hevy workout CSV')}
        </label>
        <Input
          id="hevy-csv-file"
          type="file"
          accept=".csv,text/csv"
          disabled={busy !== null}
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        {fileName ? (
          <p className="text-xs text-muted-foreground">{fileName}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="hevy-csv-timezone" className="text-sm font-medium">
          {t('settings.dataImport.hevy.timezone', 'Workout timezone')}
        </label>
        <Input
          id="hevy-csv-timezone"
          value={timezone}
          disabled={busy !== null}
          onChange={(event) => {
            setTimezone(event.target.value);
            setPreview(null);
            setResult(null);
            setReviewedDuplicates(false);
          }}
          placeholder="Europe/Berlin"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          {t(
            'settings.dataImport.hevy.timezoneHint',
            'Hevy CSV times have no UTC offset. Enter the IANA timezone where the workouts were recorded; ambiguous daylight-saving times cannot be imported.'
          )}
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        disabled={!csv || !timezone.trim() || busy !== null}
        onClick={() => void runPreview()}
      >
        {busy === 'preview'
          ? t('settings.dataImport.hevy.previewing', 'Checking…')
          : t('settings.dataImport.hevy.preview', 'Preview workouts')}
      </Button>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {preview ? (
        <div className="space-y-3 rounded-md border p-4">
          <p className="font-medium">
            {t(
              'settings.dataImport.hevy.previewCount',
              '{{workouts}} workouts · {{sets}} set rows',
              { workouts: preview.workouts.length, sets: preview.rowCount }
            )}
          </p>
          {preview.workouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('settings.dataImport.hevy.noWorkouts', 'No workouts found.')}
            </p>
          ) : (
            <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
              {preview.workouts.map((workout, index) => (
                <li key={`${workout.startTimeLocal}-${workout.title}-${index}`}>
                  <span className="font-medium">{workout.title}</span>
                  {' · '}
                  {workout.startTimeLocal}
                  {' · '}
                  {t(
                    'settings.dataImport.hevy.exerciseCount',
                    '{{count}} exercises',
                    { count: workout.exercises.length }
                  )}
                  {preview.alreadyImportedWorkoutIndices.includes(index)
                    ? ` · ${t('settings.dataImport.hevy.alreadyImported', 'Already imported (will skip)')}`
                    : null}
                </li>
              ))}
            </ul>
          )}
          {preview.warnings.map((warning) => (
            <p
              key={warning}
              className="text-sm text-amber-700 dark:text-amber-300"
            >
              {warning}
            </p>
          ))}
          {preview.reviewAvailable ? (
            <div className="space-y-2 border-t pt-3 text-sm">
              <p className="font-medium">
                {t(
                  'settings.dataImport.hevy.exerciseMappingSummary',
                  '{{existing}} exercise names match your library · {{create}} will be created',
                  {
                    existing: exerciseMappings.filter(
                      (mapping) => mapping.status === 'existing-name'
                    ).length,
                    create: exerciseMappings.filter(
                      (mapping) => mapping.status === 'will-create'
                    ).length,
                  }
                )}
              </p>
              {exerciseMappings.some(
                (mapping) => mapping.status === 'will-create'
              ) ? (
                <p className="text-muted-foreground">
                  {t(
                    'settings.dataImport.hevy.unmatchedExercises',
                    'New exercise names'
                  )}
                  :{' '}
                  {exerciseMappings
                    .filter((mapping) => mapping.status === 'will-create')
                    .map((mapping) => mapping.title)
                    .join(', ')}
                </p>
              ) : null}
              {potentialDuplicateSessions.length > 0 ? (
                <Alert>
                  <AlertDescription className="space-y-2">
                    <p className="font-medium">
                      {t(
                        'settings.dataImport.hevy.duplicateReviewTitle',
                        'Possible duplicate workouts need review'
                      )}
                    </p>
                    <p>
                      {t(
                        'settings.dataImport.hevy.duplicateReviewHint',
                        'These workouts share a date and title with existing sessions from another source or an older import. They are not merged automatically.'
                      )}
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      {potentialDuplicateSessions.map((match) => (
                        <li
                          key={`${match.workoutIndex}-${match.existingSessionId}`}
                        >
                          {preview.workouts[match.workoutIndex]?.title} ·{' '}
                          {match.entryDate} ·{' '}
                          {match.existingSource ||
                            t(
                              'settings.dataImport.hevy.unknownSource',
                              'Unknown source'
                            )}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox
                        id="hevy-duplicate-reviewed"
                        checked={reviewedDuplicates}
                        onCheckedChange={(checked) =>
                          setReviewedDuplicates(checked === true)
                        }
                      />
                      <label htmlFor="hevy-duplicate-reviewed">
                        {t(
                          'settings.dataImport.hevy.duplicateReviewed',
                          'I reviewed these possible duplicates and want to continue.'
                        )}
                      </label>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t(
              'settings.dataImport.hevy.routineNote',
              'This file contains completed workouts only. It will not create saved routines.'
            )}
          </p>
          <Button
            type="button"
            disabled={
              busy !== null ||
              !preview.timezoneValidated ||
              preview.workouts.length === 0 ||
              (potentialDuplicateSessions.length > 0 && !reviewedDuplicates) ||
              (result !== null && result.failed.length === 0)
            }
            onClick={() => void runImport()}
          >
            {busy === 'import'
              ? t('settings.dataImport.hevy.importing', 'Importing…')
              : result?.failed.length
                ? t('settings.dataImport.hevy.retry', 'Retry failed workouts')
                : t('settings.dataImport.hevy.import', 'Import these workouts')}
          </Button>
        </div>
      ) : null}

      {result ? (
        <Alert>
          <AlertDescription>
            <p>
              {t(
                'settings.dataImport.hevy.result',
                'Imported {{imported}}, skipped {{skipped}}, failed {{failed}}.',
                {
                  imported: result.imported,
                  skipped: result.skipped,
                  failed: result.failed.length,
                }
              )}
            </p>
            {result.failed.map((failure) => (
              <p key={failure.id} className="mt-1 text-destructive">
                {failure.id}: {failure.message}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
