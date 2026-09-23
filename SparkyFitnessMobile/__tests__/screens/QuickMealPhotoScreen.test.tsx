import { render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import QuickMealPhotoScreen from '../../src/screens/QuickMealPhotoScreen';
import { saveMealPhotoLocally } from '../../src/services/nutritionPhotoCapture';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
jest.mock('../../src/services/nutritionPhotoCapture', () => ({
  saveMealPhotoLocally: jest.fn().mockResolvedValue({}),
}));

const navigate = jest.fn();
const goBack = jest.fn();
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));
const props = {
  navigation: { navigate, goBack },
  route: { key: 'quick-photo', name: 'QuickMealPhoto' },
} as unknown as React.ComponentProps<typeof QuickMealPhotoScreen>;

describe('QuickMealPhotoScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocused = true;
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
    });
  });

  test('opens camera directly and saves locally before leaving the route', async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picker/meal.jpg' }],
    });
    render(<QuickMealPhotoScreen {...props} />);
    await waitFor(() => expect(saveMealPhotoLocally).toHaveBeenCalledTimes(1));
    expect(saveMealPhotoLocally).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUri: 'file:///picker/meal.jpg' })
    );
    expect(navigate).toHaveBeenCalledWith('Tabs', { screen: 'Diary' });
  });

  test('camera cancellation makes no nutrition entry', async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: true,
    });
    render(<QuickMealPhotoScreen {...props} />);
    await waitFor(() => expect(goBack).toHaveBeenCalledTimes(1));
    expect(saveMealPhotoLocally).not.toHaveBeenCalled();
  });

  test('opening the route again after returning to the diary relaunches the camera', async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picker/meal.jpg' }],
    });
    const screen = render(<QuickMealPhotoScreen {...props} />);
    await waitFor(() =>
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalledTimes(1)
    );
    mockFocused = false;
    screen.rerender(<QuickMealPhotoScreen {...props} />);
    mockFocused = true;
    screen.rerender(<QuickMealPhotoScreen {...props} />);
    await waitFor(() =>
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalledTimes(2)
    );
  });
});
