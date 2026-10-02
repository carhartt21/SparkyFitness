const previous = process.env.EXPO_PUBLIC_MICRONUTRIENT_SYNC_ENABLED;
afterEach(() => {
  if (previous === undefined)
    delete process.env.EXPO_PUBLIC_MICRONUTRIENT_SYNC_ENABLED;
  else process.env.EXPO_PUBLIC_MICRONUTRIENT_SYNC_ENABLED = previous;
  jest.resetModules();
});

it('the release rollback flag prevents extended native nutrient writeback', () => {
  process.env.EXPO_PUBLIC_MICRONUTRIENT_SYNC_ENABLED = 'false';
  jest.isolateModules(() => {
    const { micronutrientWriteback } =
      require('../../src/services/shared/micronutrientWriteback') as typeof import('../../src/services/shared/micronutrientWriteback');
    expect(
      micronutrientWriteback(
        {
          id: 'synthetic',
          entry_date: '2026-10-02',
          meal_type: 'lunch',
          quantity: 100,
          serving_size: 100,
          unit: 'g',
          custom_nutrients: { Magnesium: 120 },
        },
        [{ id: 'mg', name: 'Magnesium', unit: 'mg', catalog_id: 'magnesium' }]
      )
    ).toEqual([]);
  });
});
