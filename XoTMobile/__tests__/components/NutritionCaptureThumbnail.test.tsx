import { fireEvent, render, waitFor } from '@testing-library/react-native';
import NutritionCaptureThumbnail from '../../src/components/NutritionCaptureThumbnail';

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest
    .fn()
    .mockResolvedValue({ url: 'https://test.invalid', proxyHeaders: [] }),
  proxyHeadersToRecord: jest.fn(() => ({})),
}));
jest.mock('../../src/services/api/authService', () => ({
  getAuthHeaders: jest.fn(() => ({ Authorization: 'Bearer synthetic' })),
}));
jest.mock('../../src/components/SafeImage', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({
      source,
    }: {
      source: { uri: string; headers: Record<string, string> };
    }) => <View testID="capture-image" source={source} />,
  };
});

describe('completed diary photo', () => {
  test('uses the authenticated capture route and opens the same image full screen', async () => {
    const screen = render(
      <NutritionCaptureThumbnail
        photo={{
          remotePath: '/api/nutrition-captures/capture-1/images/image-1/file',
        }}
      />
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('capture-image')).toHaveLength(1)
    );
    const thumbnail = screen.getByTestId('capture-image');
    expect(thumbnail.props.source).toEqual({
      uri: 'https://test.invalid/api/nutrition-captures/capture-1/images/image-1/file',
      headers: { Authorization: 'Bearer synthetic' },
    });
    fireEvent.press(screen.getByLabelText('View meal photo'));
    expect(screen.getAllByTestId('capture-image')).toHaveLength(2);
  });
});
