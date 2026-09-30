import type { IconName } from '../Icon';

/** Icons a habit may use. Unknown stored names fall back to the generic one. */
export const HABIT_ICON_OPTIONS: readonly IconName[] = [
  'habit',
  'exercise-running',
  'exercise-weights',
  'exercise-yoga',
  'exercise-walking',
  'moon',
  'sun',
  'book',
  'heart',
  'bolt',
  'brain',
  'fork-knife',
  'medication',
  'timer',
];

export function habitIcon(name: string | null): IconName {
  return name && (HABIT_ICON_OPTIONS as readonly string[]).includes(name)
    ? (name as IconName)
    : 'habit';
}
