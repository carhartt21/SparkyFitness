import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import HevyWorkoutImportCSV from '@/pages/Exercises/HevyWorkoutImportCSV';

const previewCsv = jest.fn();
const importCsv = jest.fn();

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ timezone: 'Europe/Berlin' }),
}));
jest.mock('@/hooks/Exercises/useHevyCsvImport', () => ({
  useHevyCsvImport: () => ({ preview: previewCsv, importCsv }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      key: string,
      fallback: string | { defaultValue?: string; [key: string]: unknown },
      values?: Record<string, unknown>
    ) => {
      let text =
        typeof fallback === 'string'
          ? fallback
          : (fallback?.defaultValue ?? key);
      for (const [name, value] of Object.entries(
        typeof fallback === 'object' ? fallback : (values ?? {})
      ))
        text = text.replaceAll(`{{${name}}}`, String(value));
      return text;
    },
  }),
}));

describe('Hevy completed-workout CSV import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    previewCsv.mockResolvedValue({
      rowCount: 1,
      savedRoutinesIncluded: false,
      timezoneRequired: true,
      timezoneValidated: true,
      reviewAvailable: true,
      alreadyImportedWorkoutIndices: [],
      exerciseMappings: [{ title: 'Bench Press', status: 'existing-name' }],
      potentialDuplicateSessions: [],
      warnings: [],
      workouts: [
        {
          title: 'Full Body',
          startTimeLocal: '23 Sep 2026, 21:42',
          endTimeLocal: '23 Sep 2026, 22:34',
          exercises: [{ title: 'Bench Press', sets: [{ type: 'normal' }] }],
        },
      ],
    });
    importCsv.mockResolvedValue({
      submitted: 1,
      imported: 1,
      skipped: 0,
      failed: [],
      savedRoutinesIncluded: false,
    });
  });

  it('shows exercise mapping and requires review before importing possible duplicate sessions', async () => {
    previewCsv.mockResolvedValueOnce({
      rowCount: 1,
      savedRoutinesIncluded: false,
      timezoneRequired: true,
      timezoneValidated: true,
      reviewAvailable: true,
      alreadyImportedWorkoutIndices: [],
      exerciseMappings: [{ title: 'Ring Row', status: 'will-create' }],
      potentialDuplicateSessions: [
        {
          workoutIndex: 0,
          existingSessionId: 'session-1',
          existingSource: 'Apple Health',
          entryDate: '2026-09-23',
        },
      ],
      warnings: [],
      workouts: [
        {
          title: 'Full Body',
          startTimeLocal: '23 Sep 2026, 21:42',
          endTimeLocal: '23 Sep 2026, 22:34',
          exercises: [{ title: 'Ring Row', sets: [{ type: 'normal' }] }],
        },
      ],
    });
    render(<HevyWorkoutImportCSV />);
    const file = new File(['csv content'], 'workouts.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(file, 'text', {
      value: jest.fn().mockResolvedValue('csv content'),
    });
    fireEvent.change(screen.getByLabelText('Hevy workout CSV'), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Preview workouts' })
      ).toBeEnabled()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview workouts' }));
    await waitFor(() =>
      expect(
        screen.getByText('Possible duplicate workouts need review')
      ).toBeInTheDocument()
    );
    expect(screen.getByText(/Ring Row/)).toBeInTheDocument();
    const importButton = screen.getByRole('button', {
      name: 'Import these workouts',
    });
    expect(importButton).toBeDisabled();
    fireEvent.click(
      screen.getByLabelText(
        'I reviewed these possible duplicates and want to continue.'
      )
    );
    expect(importButton).toBeEnabled();
  });

  it('requires a fresh preview after the timezone changes before importing', async () => {
    render(<HevyWorkoutImportCSV />);
    const file = new File(['csv content'], 'workouts.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(file, 'text', {
      value: jest.fn().mockResolvedValue('csv content'),
    });
    fireEvent.change(screen.getByLabelText('Hevy workout CSV'), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Preview workouts' })
      ).toBeEnabled()
    );
    expect(
      screen.queryByRole('button', { name: 'Import these workouts' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Preview workouts' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Import these workouts' })
      ).toBeEnabled()
    );
    expect(previewCsv).toHaveBeenCalledWith('csv content', 'Europe/Berlin');

    fireEvent.change(screen.getByLabelText('Workout timezone'), {
      target: { value: 'America/New_York' },
    });
    expect(
      screen.queryByRole('button', { name: 'Import these workouts' })
    ).not.toBeInTheDocument();
    expect(importCsv).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Preview workouts' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Import these workouts' })
      ).toBeEnabled()
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Import these workouts' })
    );
    await waitFor(() =>
      expect(importCsv).toHaveBeenCalledWith('csv content', 'America/New_York')
    );
  });

  it('allows a partial import to be retried from the same file', async () => {
    importCsv
      .mockResolvedValueOnce({
        submitted: 1,
        imported: 0,
        skipped: 0,
        failed: [{ id: 'csv_example', message: 'Temporary write failure' }],
        savedRoutinesIncluded: false,
      })
      .mockResolvedValueOnce({
        submitted: 1,
        imported: 1,
        skipped: 0,
        failed: [],
        savedRoutinesIncluded: false,
      });
    render(<HevyWorkoutImportCSV />);
    const file = new File(['csv content'], 'workouts.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(file, 'text', {
      value: jest.fn().mockResolvedValue('csv content'),
    });
    fireEvent.change(screen.getByLabelText('Hevy workout CSV'), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Preview workouts' })
      ).toBeEnabled()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview workouts' }));
    const importButton = await screen.findByRole('button', {
      name: 'Import these workouts',
    });
    fireEvent.click(importButton);

    const retryButton = await screen.findByRole('button', {
      name: 'Retry failed workouts',
    });
    expect(retryButton).toBeEnabled();
    fireEvent.click(retryButton);

    await waitFor(() => expect(importCsv).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Import these workouts' })
      ).toBeDisabled()
    );
  });

  it('shows possible duplicate rows in the dry run before import', async () => {
    previewCsv.mockResolvedValueOnce({
      rowCount: 2,
      savedRoutinesIncluded: false,
      timezoneRequired: true,
      timezoneValidated: true,
      alreadyImportedWorkoutIndices: [0],
      warnings: [
        'Possible duplicate: rows 2 and 3 are identical; both are retained as separate sets.',
      ],
      workouts: [
        {
          title: 'Full Body',
          startTimeLocal: '23 Sep 2026, 21:42',
          endTimeLocal: '23 Sep 2026, 22:34',
          exercises: [{ title: 'Bench Press', sets: [{ type: 'normal' }] }],
        },
      ],
    });
    render(<HevyWorkoutImportCSV />);
    const file = new File(['csv content'], 'workouts.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(file, 'text', {
      value: jest.fn().mockResolvedValue('csv content'),
    });
    fireEvent.change(screen.getByLabelText('Hevy workout CSV'), {
      target: { files: [file] },
    });
    const previewButton = await screen.findByRole('button', {
      name: 'Preview workouts',
    });
    await waitFor(() => expect(previewButton).toBeEnabled());
    fireEvent.click(previewButton);

    expect(
      await screen.findByText(
        'Possible duplicate: rows 2 and 3 are identical; both are retained as separate sets.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Already imported \(will skip\)/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Import these workouts' })
    ).toBeEnabled();
    expect(importCsv).not.toHaveBeenCalled();
  });

  it('shows the successful save range and opens that diary day for a historical import', async () => {
    importCsv.mockResolvedValueOnce({
      submitted: 205,
      imported: 205,
      skipped: 0,
      failed: [],
      savedRoutinesIncluded: false,
      importedDateRange: { from: '2025-04-01', to: '2026-09-23' },
    });
    render(
      <MemoryRouter>
        <HevyWorkoutImportCSV />
      </MemoryRouter>
    );
    const file = new File(['csv content'], 'workouts.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(file, 'text', {
      value: jest.fn().mockResolvedValue('csv content'),
    });
    fireEvent.change(screen.getByLabelText('Hevy workout CSV'), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Preview workouts' })
      ).toBeEnabled()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview workouts' }));
    const button = await screen.findByRole('button', {
      name: 'Import these workouts',
    });
    fireEvent.click(button);
    const link = await screen.findByRole('link', {
      name: 'View imported workouts',
    });
    expect(link).toHaveAttribute('href', '/diary?date=2025-04-01');
    expect(
      screen.getByText('Saved to your diary: 2025-04-01 – 2026-09-23')
    ).toBeInTheDocument();
  });
});
