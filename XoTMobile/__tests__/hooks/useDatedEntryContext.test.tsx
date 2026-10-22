import { act, renderHook } from '@testing-library/react-native';
import { useDatedEntryContext } from '../../src/hooks/useDatedEntryContext';

it('keeps the route day and cue, clears cue on another day, and adopts mounted parameter re-entry', () => {
  const v = renderHook(({ day, focus }) => useDatedEntryContext(day, focus), {
    initialProps: { day: '2030-02-01', focus: 'test-focus' },
  });
  expect(v.result.current).toMatchObject({
    date: '2030-02-01',
    focusedId: 'test-focus',
  });
  act(() => v.result.current.setDate('2030-02-02'));
  expect(v.result.current).toMatchObject({
    date: '2030-02-02',
    focusedId: undefined,
  });
  v.rerender({ day: '2030-02-03', focus: 'next-focus' });
  expect(v.result.current).toMatchObject({
    date: '2030-02-03',
    focusedId: 'next-focus',
  });
});

it('restores explicit route context on a fresh same-value parameter delivery', () => {
  const first = { date: '2030-02-01', id: 'test-focus' };
  const v = renderHook(
    ({ params }) => useDatedEntryContext(params.date, params.id, params),
    { initialProps: { params: first } }
  );
  act(() => v.result.current.setDate('2030-02-02'));
  v.rerender({ params: { ...first } });
  expect(v.result.current).toMatchObject({
    date: '2030-02-01',
    focusedId: 'test-focus',
  });
});
