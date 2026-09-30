import type { HealthContextKind } from '@workspace/shared';
import type { IconName } from '../Icon';
import type { NeonScale } from './useNeonScale';

export const CONTEXT_ICON: Record<HealthContextKind, IconName> = {
  injury: 'bandage',
  illness: 'thermometer',
  vacation: 'airplane',
};

export function contextColor(
  kind: HealthContextKind,
  scale: NeonScale
): string {
  if (kind === 'injury') return scale.orange;
  if (kind === 'illness') return scale.violet;
  return scale.cyan;
}
