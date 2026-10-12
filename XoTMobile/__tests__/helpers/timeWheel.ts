import { fireEvent } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

/** Drive the same independently adjustable controls exposed to assistive technology. */
export function setWheelTime(
  getByLabelText: (label: string) => ReactTestInstance,
  time: string
) {
  const targets = time.split(':').map(Number);
  ['Hours', 'Minutes'].forEach((label, index) => {
    for (let count = 0; count < 60; count++) {
      const control = getByLabelText(label);
      const current = Number(control.props.accessibilityValue.now);
      if (current === targets[index]) return;
      fireEvent(control, 'accessibilityAction', {
        nativeEvent: {
          actionName: current < targets[index] ? 'increment' : 'decrement',
        },
      });
    }
    throw new Error(`Could not select ${label} in ${time}`);
  });
}
