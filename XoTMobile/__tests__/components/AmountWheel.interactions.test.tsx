import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

type CapturedGesture = {
  enabled?: boolean;
  holdMs?: number;
  distance?: number;
  onStart?: () => void;
  onUpdate?: (event: { translationY: number }) => void;
  onEnd?: (event: unknown, success: boolean) => void;
  onFinalize?: () => void;
};
const mockGestures: { pan: CapturedGesture; tap: CapturedGesture } = {
  pan: {},
  tap: {},
};

// Native recognition is exercised by XCTest. Capture callbacks here to test
// quantity/draft semantics without pretending Jest can arbitrate scrolling.
jest.mock('react-native-gesture-handler', () => {
  const makeGesture = (kind: 'pan' | 'tap') => {
    const captured: CapturedGesture = {};
    mockGestures[kind] = captured;
    const gesture = {
      enabled: (enabled: boolean) => {
        captured.enabled = enabled;
        return gesture;
      },
      activateAfterLongPress: (ms: number) => {
        captured.holdMs = ms;
        return gesture;
      },
      minDistance: (distance: number) => {
        captured.distance = distance;
        return gesture;
      },
      maxDistance: () => gesture,
      failOffsetX: () => gesture,
      runOnJS: () => gesture,
      onStart: (fn: CapturedGesture['onStart']) => {
        captured.onStart = fn;
        return gesture;
      },
      onUpdate: (fn: CapturedGesture['onUpdate']) => {
        captured.onUpdate = fn;
        return gesture;
      },
      onEnd: (fn: CapturedGesture['onEnd']) => {
        captured.onEnd = fn;
        return gesture;
      },
      onFinalize: (fn: CapturedGesture['onFinalize']) => {
        captured.onFinalize = fn;
        return gesture;
      },
    };
    return gesture;
  };
  return {
    Gesture: {
      Pan: () => makeGesture('pan'),
      Tap: () => makeGesture('tap'),
      Exclusive: (...gestures: unknown[]) => gestures,
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});

import AmountWheel from '../../src/components/AmountWheel';

describe('AmountWheel intentional interaction', () => {
  it('requires a hold before spinning, then applies bounded grid changes', () => {
    const onChange = jest.fn();
    render(
      <AmountWheel value={137} onChange={onChange} metric unitLabel="g" />
    );
    expect(mockGestures.pan.holdMs).toBe(400);
    expect(mockGestures.pan.distance).toBe(6);
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      mockGestures.pan.onStart?.();
      mockGestures.pan.onUpdate?.({ translationY: -14 });
      mockGestures.pan.onUpdate?.({ translationY: -15 });
    });
    expect(onChange.mock.calls).toEqual([[140]]);
    act(() => mockGestures.pan.onUpdate?.({ translationY: 10000 }));
    expect(onChange).toHaveBeenLastCalledWith(5);
    act(() => mockGestures.pan.onFinalize?.());
  });

  it('uses the latest value when starting another drag', () => {
    const onChange = jest.fn();
    const view = render(
      <AmountWheel value={100} onChange={onChange} metric unitLabel="g" />
    );
    view.rerender(
      <AmountWheel value={200} onChange={onChange} metric unitLabel="g" />
    );
    act(() => {
      mockGestures.pan.onStart?.();
      mockGestures.pan.onUpdate?.({ translationY: -28 });
    });
    expect(onChange).toHaveBeenCalledWith(210);
  });

  it('opens numeric entry only after a successful tap and preserves decimal drafts', () => {
    const onChange = jest.fn();
    const onDraftChange = jest.fn();
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const view = render(
      <AmountWheel
        value={100}
        onChange={onChange}
        onDraftChange={onDraftChange}
        onFocus={onFocus}
        onBlur={onBlur}
        metric
        unitLabel="g"
      />
    );
    act(() => mockGestures.tap.onEnd?.({}, false));
    expect(view.queryByTestId('food-entry-amount-input')).toBeNull();
    act(() => mockGestures.tap.onEnd?.({}, true));
    const input = view.getByTestId('food-entry-amount-input');
    expect(input.props.keyboardType).toBe('decimal-pad');
    // RN otherwise inserts an extra, English native toolbar above the pad.
    expect(input.props.returnKeyType).toBeUndefined();
    fireEvent(input, 'focus');
    expect(onFocus).toHaveBeenCalledTimes(1);
    fireEvent.changeText(input, '12,5');
    expect(onDraftChange).toHaveBeenLastCalledWith('12,5');
    fireEvent.changeText(input, '');
    fireEvent(input, 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('food-entry-amount-input').props.value).toBe('');
    expect(onDraftChange).toHaveBeenLastCalledWith('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('retains VoiceOver adjustments and exact entry', () => {
    const onChange = jest.fn();
    const view = render(
      <AmountWheel
        value={1}
        onChange={onChange}
        metric={false}
        unitLabel="Portion"
      />
    );
    fireEvent(
      view.getByTestId('food-entry-amount-wheel'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    );
    expect(onChange).toHaveBeenCalledWith(1.25);
    fireEvent(
      view.getByTestId('food-entry-amount-wheel'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'activate' } }
    );
    fireEvent.changeText(view.getByTestId('food-entry-amount-input'), '2,5');
    expect(onChange).toHaveBeenLastCalledWith(2.5);
  });

  it('disables both gestures and accessibility changes during a pending save', () => {
    const onChange = jest.fn();
    const view = render(
      <AmountWheel
        value={100}
        onChange={onChange}
        metric
        unitLabel="g"
        disabled
      />
    );
    expect(mockGestures.pan.enabled).toBe(false);
    expect(mockGestures.tap.enabled).toBe(false);
    fireEvent(
      view.getByTestId('food-entry-amount-wheel'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
