import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useState } from 'react';
import MealTypeIconPicker from '@/pages/Settings/MealTypeIconPicker';
import { MEAL_TYPE_ICON_KEYS, type MealTypeIcon } from '@workspace/shared';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

function Harness() {
  const [value, setValue] = useState<MealTypeIcon | null>('water');
  return <MealTypeIconPicker value={value} onChange={setValue} />;
}

it('exposes the shared semantic choices and preserves one selected choice until reset', () => {
  render(<Harness />);
  const water = screen.getByRole('radio', {
    name: 'mealTypeManager.icons.water',
  });
  expect(water).toBeChecked();
  expect(screen.getAllByRole('radio')).toHaveLength(MEAL_TYPE_ICON_KEYS.length);
  const food = screen.getByRole('radio', {
    name: 'mealTypeManager.icons.food',
  });
  fireEvent.click(food);
  expect(food).toBeChecked();
  expect(water).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Use default icon' }));
  expect(
    screen
      .getAllByRole('radio')
      .some((radio) => (radio as HTMLInputElement).checked)
  ).toBe(false);
});
