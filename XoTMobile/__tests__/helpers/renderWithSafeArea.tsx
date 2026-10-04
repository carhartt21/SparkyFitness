import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function SafeAreaTestProvider({ children }: React.PropsWithChildren) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 44, bottom: 34, left: 0, right: 0 },
      }}
    >
      {children}
    </SafeAreaProvider>
  );
}

/** Supply the same safe-area context that the application shell provides. */
export function renderWithSafeArea(
  component: React.ReactElement,
  options?: Parameters<typeof render>[1]
) {
  return render(component, { wrapper: SafeAreaTestProvider, ...options });
}
