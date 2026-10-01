import i18n, { initializeI18n } from '../../src/localization/i18n';

describe('reviewed German workout labels', () => {
  beforeAll(async () => {
    await initializeI18n('de');
    await i18n.changeLanguage('de');
  });

  it.each([
    ['workout.setTypeDropSet', 'Reduktionssatz'],
    ['workout.deleteSet', 'Satz löschen'],
    ['workout.addExercise', 'Übung hinzufügen'],
    ['workout.endWorkout', 'Training beenden'],
    ['workout.prev', 'Vorher'],
    ['activeWorkout.columns.previous', 'Vorher'],
    ['activeWorkout.columns.reps', 'Wdh.'],
    ['activeWorkout.exercise.addSetLabel', 'Satz hinzufügen'],
    ['foodImagePicker.actions.addPhoto', 'Foto hinzufügen'],
  ])('translates %s without a mixed-language fallback', (key, expected) => {
    expect(i18n.t(key)).toBe(expected);
  });

  it('handles set plurals without changing a provider exercise name', () => {
    expect(i18n.t('workout.setCount', { count: 3, formattedCount: '3' })).toBe(
      '3 Sätze'
    );
    expect(
      i18n.t('activeWorkout.exerciseCard.setSummary', { count: 1, detail: '' })
    ).toBe('1 Satz');
    expect(
      i18n.t('activeWorkout.exerciseCard.setSummary', { count: 3, detail: '' })
    ).toBe('3 Sätze');
    expect(
      i18n.t('activeWorkout.exercise.viewDetails', { name: 'Bench Press' })
    ).toBe('Details zu Bench Press anzeigen');
  });
});
