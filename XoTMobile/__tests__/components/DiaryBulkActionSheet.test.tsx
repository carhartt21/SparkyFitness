import { TextInput } from 'react-native';
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import DiaryBulkActionSheet from '../../src/components/DiaryBulkActionSheet';
import type { MealType } from '../../src/types/mealTypes';
import i18n, { initializeI18n } from '../../src/localization/i18n';
import { SafeAreaProvider } from 'react-native-safe-area-context';
jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: () => ({ preferences: { first_day_of_week: 1 } }),
}));

jest.mock('react-native-ui-datepicker', () => {
  const { Text, Pressable } =
    require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({
      onChange,
    }: {
      onChange: (value: { date: string }) => void;
    }) => (
      <Pressable
        testID="pick-day"
        onPress={() => onChange({ date: '2030-02-28' })}
      >
        <Text>Calendar day</Text>
      </Pressable>
    ),
  };
});

const meals: MealType[] = [
  {
    id: 'custom-meal',
    name: 'Test meal',
    user_id: 'ui-test-owner',
    sort_order: 0,
    created_at: '',
    is_visible: true,
    show_in_quick_log: true,
  },
];

describe('selected-food bulk sheet', () => {
  beforeEach(async () => {
    await initializeI18n('en');
    await i18n.changeLanguage('en');
    jest.clearAllMocks();
  });
  const setup = (
    extra: Partial<React.ComponentProps<typeof DiaryBulkActionSheet>> = {}
  ) => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    const props = {
      action: 'copy' as const,
      sourceDate: '2030-02-27',
      selectedCount: 1,
      mealTypes: meals,
      busy: false,
      onApply,
      onClose,
      ...extra,
    };
    return {
      ...render(<DiaryBulkActionSheet {...props} />, {
        wrapper: ({ children }) => (
          <SafeAreaProvider
            initialMetrics={{
              frame: { x: 0, y: 0, width: 390, height: 844 },
              insets: { top: 0, bottom: 34, left: 0, right: 0 },
            }}
          >
            {children}
          </SafeAreaProvider>
        ),
      }),
      props,
      onApply,
      onClose,
    };
  };

  it('uses the calendar, keeps local day and explicit meal, and collapses queued double taps', () => {
    const v = setup();
    fireEvent.press(v.getByText('Apply'));
    expect(v.onApply).not.toHaveBeenCalled();
    expect(v.getByLabelText('Choose destination date')).toBeTruthy();
    expect(v.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    fireEvent.press(v.getByTestId('pick-day'));
    expect(v.onApply).not.toHaveBeenCalled();
    fireEvent.press(v.getByText('Test meal'));
    fireEvent.press(v.getByText('Apply'));
    fireEvent.press(v.getByText('Apply'));
    expect(v.onApply).toHaveBeenCalledTimes(1);
    expect(v.onApply).toHaveBeenCalledWith('copy', '2030-02-28', 'custom-meal');
  });

  it('keeps individual calendar controls accessible and refuses a newly hidden selected meal', () => {
    const v = setup();
    expect(v.getByLabelText('Choose destination date').props.accessible).toBe(
      true
    );
    expect(v.getByTestId('pick-day')).toBeTruthy();
    fireEvent.press(v.getByText('Test meal'));
    v.rerender(
      <DiaryBulkActionSheet
        {...v.props}
        mealTypes={[{ ...meals[0], is_visible: false }]}
      />
    );
    expect(v.queryByText('Test meal')).toBeNull();
    fireEvent.press(v.getByText('Apply'));
    expect(v.onApply).not.toHaveBeenCalled();
  });

  it('cancel changes nothing even after picking a destination', () => {
    const v = setup();
    fireEvent.press(v.getByTestId('pick-day'));
    fireEvent.press(v.getByText('Test meal'));
    fireEvent.press(v.getByText('Cancel'));
    expect(v.onClose).toHaveBeenCalledTimes(1);
    expect(v.onApply).not.toHaveBeenCalled();
  });

  it('rejects impossible day, missing/hidden targets and empty selection', () => {
    const v = setup({ sourceDate: '2030-02-30' });
    fireEvent.press(v.getByText('Test meal'));
    fireEvent.press(v.getByText('Apply'));
    expect(v.onApply).not.toHaveBeenCalled();
    v.rerender(<DiaryBulkActionSheet {...v.props} mealTypes={[]} />);
    fireEvent.press(v.getByText('Apply'));
    expect(v.onApply).not.toHaveBeenCalled();
    v.rerender(<DiaryBulkActionSheet {...v.props} selectedCount={0} />);
    fireEvent.press(v.getByText('Apply'));
    expect(v.onApply).not.toHaveBeenCalled();
  });

  it('preserves move payload and disables interaction while pending', () => {
    const v = setup({ action: 'move' });
    fireEvent.press(v.getByText('Test meal'));
    fireEvent.press(v.getByText('Apply'));
    expect(v.onApply).toHaveBeenCalledWith('move', '2030-02-27', 'custom-meal');
    v.rerender(<DiaryBulkActionSheet {...v.props} busy />);
    fireEvent.press(v.getByText('Cancel'));
    fireEvent.press(v.getByText('Saving…'));
    expect(v.onClose).not.toHaveBeenCalled();
    expect(v.onApply).toHaveBeenCalledTimes(1);
  });

  it('updates German labels on the mounted sheet without changing custom names', async () => {
    const v = setup();
    await act(async () => {
      await i18n.changeLanguage('de');
    });
    expect(v.getByText('Ausgewählte Lebensmittel kopieren')).toBeTruthy();
    expect(v.getByLabelText('Zieldatum auswählen')).toBeTruthy();
    expect(v.getByText('Test meal')).toBeTruthy();
    expect(v.getByText('Abbrechen')).toBeTruthy();
  });
});
