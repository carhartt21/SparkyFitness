import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import DiaryTimeline from '../../src/components/DiaryTimeline';

it('separates recorded history from earlier planned tasks, exposes leaf actions and keeps meals collapsed', () => {
  const open = jest.fn();
  const view = render(
    <DiaryTimeline
      entries={[
        {
          id: 'plan',
          section: 'planned',
          timestamp: 1,
          clock: '08:00',
          label: 'Planned lunch',
          content: null,
          icon: 'meal',
        },
        {
          id: 'water',
          timestamp: 2,
          clock: '10:00',
          label: 'Water',
          content: null,
          summary: '350 ml',
          icon: 'water',
          onPress: open,
        },
        {
          id: 'meal',
          timestamp: 3,
          clock: '12:00',
          label: 'Lunch',
          content: <Text>Food snapshot</Text>,
          collapsible: true,
          icon: 'meal',
        },
        {
          id: 'weight',
          timestamp: null,
          clock: null,
          label: 'Weight',
          content: null,
          icon: 'scale',
        },
      ]}
    />
  );
  expect(view.queryByText('Food snapshot')).toBeNull();
  expect(
    view
      .getByTestId('diary-recorded')
      .findAllByType(Text)
      .map((n) => n.props.children)
  ).toContain('350 ml');
  expect(
    view
      .getByTestId('diary-planned')
      .findAllByType(Text)
      .map((n) => n.props.children)
  ).toContain('Planned lunch');
  fireEvent.press(view.getByTestId('diary-expand-water'));
  expect(open).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByTestId('diary-expand-meal'));
  expect(view.getByText('Food snapshot')).toBeTruthy();
  expect(view.getByLabelText('10:00, Water, 350 ml')).toBeTruthy();
});

it.each([
  ['Breakfast', '600 kcal · 2 items'],
  ['Lunch', 'Planned · nothing logged yet'],
  ['Vitamin D3', 'Supplement · 1 capsule'],
  ['Weight', 'Amount unknown'],
  ['Mobility', 'Complete'],
])(
  'announces the visible summary for %s without inventing values',
  (label, summary) => {
    const view = render(
      <DiaryTimeline
        entries={[
          {
            id: 'entry',
            timestamp: 1,
            clock: '08:30',
            label,
            summary,
            content: null,
            collapsible: true,
          },
        ]}
      />
    );
    expect(view.getByLabelText(`08:30, ${label}, ${summary}`)).toBeTruthy();
    expect(view.getByText(summary)).toBeTruthy();
  }
);
