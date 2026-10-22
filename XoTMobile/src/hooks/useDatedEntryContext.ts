import { useState } from 'react';
import { getTodayDate } from '../utils/dateUtils';

/** A shortcut selects context, never filters the list or records an action. */
export function useDatedEntryContext(
  incomingDate?: string,
  incomingFocus?: string,
  source?: object
) {
  const [context, setContext] = useState(() => ({
    incomingDate,
    incomingFocus,
    source,
    date: incomingDate ?? getTodayDate(),
    focus: incomingFocus,
  }));
  if (
    context.incomingDate !== incomingDate ||
    context.incomingFocus !== incomingFocus ||
    context.source !== source
  ) {
    setContext({
      incomingDate,
      incomingFocus,
      source,
      date: incomingDate ?? getTodayDate(),
      focus: incomingFocus,
    });
  }
  return {
    date: context.date,
    focusedId: context.focus,
    setDate: (date: string) =>
      setContext((current) => ({
        ...current,
        date,
        focus: date === current.date ? current.focus : undefined,
      })),
  };
}
