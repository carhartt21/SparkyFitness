import { fireEvent, render } from '@testing-library/react-native';
import MobilityDiarySection from '../../src/components/MobilityDiarySection';
import { mobilitySession } from '../helpers/mobilityFixtures';

test('displays confirmed movement with a 24-hour time and opens the runner history', () => {
  const onPress = jest.fn();
  const screen = render(
    <MobilityDiarySection
      sessions={[mobilitySession({ state: 'cancelled' })]}
      timezone="Europe/Berlin"
      failed={false}
      onRetry={jest.fn()}
      onPress={onPress}
    />
  );
  expect(screen.getByText('Mobility workouts')).toBeTruthy();
  expect(screen.getByText(/1 completed · 0 skipped/)).toBeTruthy();
  expect(screen.getByText('Ended early')).toBeTruthy();
  expect(screen.queryByText(/AM|PM/)).toBeNull();
  expect(screen.getByText(/11:00/)).toBeTruthy();
  fireEvent.press(screen.getByText('Morning reach'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
test('keeps offline rows visible and offers retry for failed refreshes', () => {
  const retry = jest.fn();
  const screen = render(
    <MobilityDiarySection
      sessions={[mobilitySession()]}
      failed
      onRetry={retry}
      onPress={jest.fn()}
    />
  );
  expect(screen.getByText('Morning reach')).toBeTruthy();
  fireEvent.press(screen.getByText('Retry'));
  expect(retry).toHaveBeenCalled();
});
