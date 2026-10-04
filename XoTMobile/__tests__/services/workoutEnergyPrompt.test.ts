import { Alert } from 'react-native';
import type { TFunction } from 'i18next';
import { requestWorkoutActiveEnergy } from '../../src/services/workoutEnergyPrompt';

const t = ((_key: string, options: { defaultValue?: string }) =>
  options.defaultValue) as TFunction;
afterEach(() => jest.restoreAllMocks());
test('presents an editable estimate but does not resolve until the user confirms', async () => {
  const prompt = jest.spyOn(Alert, 'prompt').mockImplementation(() => {});
  let resolved = false;
  const energy = requestWorkoutActiveEnergy(t, {
    mobility: true,
    estimate: { activeKcal: 18, weightKg: 80, timedSeconds: 600 },
  });
  void energy.then(() => {
    resolved = true;
  });
  await Promise.resolve();
  expect(resolved).toBe(false);
  expect(prompt).toHaveBeenCalledWith(
    'Confirm mobility calories',
    expect.stringContaining('not a measurement'),
    expect.any(Array),
    'plain-text',
    '18',
    'decimal-pad'
  );
  const actions = prompt.mock.calls[0]![2];
  if (!Array.isArray(actions)) throw new Error('Missing prompt actions.');
  actions[1]!.onPress?.('21,5');
  expect(await energy).toBe(21.5);
});
test('skipping the estimate never exports it implicitly', async () => {
  const prompt = jest.spyOn(Alert, 'prompt').mockImplementation(() => {});
  const energy = requestWorkoutActiveEnergy(t, { mobility: true });
  expect(prompt.mock.calls[0]![4]).toBe('');
  const actions = prompt.mock.calls[0]![2];
  if (!Array.isArray(actions)) throw new Error('Missing prompt actions.');
  actions[0]!.onPress?.('');
  expect(await energy).toBeUndefined();
});
