import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ProgressPhotoCapture from '../../src/components/ProgressPhotoCapture';
import { prepareImageForUpload } from '../../src/utils/pickImage';

const mockTakePictureAsync = jest.fn(async () => ({
  uri: 'file:///original.jpg',
  width: 3000,
  height: 4000,
}));
const mockDeleteTemporaryFile = jest.fn();

jest.mock('expo-camera', () => {
  const { forwardRef, useImperativeHandle } =
    jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual('react-native');
  return {
    CameraView: forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
      useImperativeHandle(ref, () => ({
        takePictureAsync: mockTakePictureAsync,
      }));
      return <View testID="camera-preview" />;
    }),
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
  };
});
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, Path: View };
});
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    uri,
    exists: true,
    delete: () => mockDeleteTemporaryFile(uri),
  })),
}));
jest.mock('../../src/utils/pickImage', () => ({
  prepareImageForUpload: jest.fn(async () => ({
    uri: 'file:///compressed.jpg',
  })),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('ProgressPhotoCapture', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the optional guide in the preview and sends only the prepared image', async () => {
    const onCaptured = jest.fn(async () => true);
    const onClose = jest.fn();
    const screen = render(
      <ProgressPhotoCapture
        visible
        angle="side"
        onClose={onClose}
        onCaptured={onCaptured}
      />
    );

    expect(
      screen.UNSAFE_getByProps({ testID: 'progress-photo-pose-guide' })
    ).toBeTruthy();
    fireEvent.press(screen.getByRole('switch', { name: 'Pose guide' }));
    expect(
      screen.UNSAFE_queryByProps({ testID: 'progress-photo-pose-guide' })
    ).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Capture photo' }));

    await waitFor(() => {
      expect(prepareImageForUpload).toHaveBeenCalledWith(
        expect.objectContaining({ uri: 'file:///original.jpg' })
      );
      expect(onCaptured).toHaveBeenCalledWith('file:///compressed.jpg');
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockDeleteTemporaryFile).toHaveBeenCalledWith(
        'file:///original.jpg'
      );
      expect(mockDeleteTemporaryFile).toHaveBeenCalledWith(
        'file:///compressed.jpg'
      );
    });
  });

  it('keeps the camera open after an upload failure so capture can be retried', async () => {
    const onCaptured = jest.fn(async () => false);
    const onClose = jest.fn();
    const screen = render(
      <ProgressPhotoCapture
        visible
        angle="front"
        onClose={onClose}
        onCaptured={onCaptured}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Capture photo' }));

    await waitFor(() => {
      expect(
        screen.getByText('Could not save that photo. Try again.')
      ).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
      expect(mockDeleteTemporaryFile).toHaveBeenCalledWith(
        'file:///compressed.jpg'
      );
    });
    fireEvent.press(screen.getByRole('button', { name: 'Capture photo' }));
    await waitFor(() => expect(onCaptured).toHaveBeenCalledTimes(2));
  });
});
