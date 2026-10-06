import { fireEvent, render, screen } from '@testing-library/react';
import { Input, TimeCommitInput } from '@/components/ui/input';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: { defaultValue: string }) =>
      options.defaultValue,
  }),
}));

it('uses an explicit 24-hour text clock independent of browser locale and accepts numeric keyboard entry', () => {
  const changed = jest.fn();
  render(
    <Input
      type="time"
      aria-label="Clock"
      onChange={(e) => changed(e.target.value)}
    />
  );
  const input = screen.getByRole('textbox', {
    name: 'Clock',
  }) as HTMLInputElement;
  expect(input.type).toBe('text');
  expect(input.inputMode).toBe('numeric');
  fireEvent.change(input, { target: { value: '1430' } });
  expect(changed).toHaveBeenLastCalledWith('14:30');
  expect(input.checkValidity()).toBe(true);
  for (const value of ['2:30 PM', '24:00', '12:60', '14:']) {
    fireEvent.change(input, { target: { value } });
    expect(input.checkValidity()).toBe(false);
  }
});

it('never autosaves a partial or invalid time, commits on blur, and follows remote corrections', () => {
  const commit = jest.fn();
  const view = render(
    <TimeCommitInput aria-label="Reminder" value="08:00" onCommit={commit} />
  );
  const input = screen.getByRole('textbox', {
    name: 'Reminder',
  }) as HTMLInputElement;
  fireEvent.change(input, { target: { value: '14:' } });
  fireEvent.blur(input);
  expect(commit).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '1430' } });
  expect(commit).not.toHaveBeenCalled();
  fireEvent.blur(input);
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit).toHaveBeenCalledWith('14:30');
  view.rerender(
    <TimeCommitInput aria-label="Reminder" value="16:45" onCommit={commit} />
  );
  expect(input.value).toBe('16:45');
  fireEvent.blur(input);
  expect(commit).toHaveBeenCalledTimes(1);
});
