import * as ImageManipulator from 'expo-image-manipulator';
import { prepareImageForUpload } from '../../src/utils/pickImage';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async () => ({ uri: 'file:///prepared.jpg' })),
  SaveFormat: { JPEG: 'jpeg' },
}));

const manipulateAsync = ImageManipulator.manipulateAsync as jest.Mock;

describe('prepareImageForUpload', () => {
  beforeEach(() => manipulateAsync.mockClear());

  it('caps the long edge of a portrait camera image and encodes JPEG', async () => {
    const image = await prepareImageForUpload({
      uri: 'file:///portrait.heic',
      width: 3000,
      height: 4000,
    });

    expect(image.uri).toBe('file:///prepared.jpg');
    expect(manipulateAsync).toHaveBeenCalledWith(
      'file:///portrait.heic',
      [{ resize: { height: 1600 } }],
      { compress: 0.85, format: 'jpeg' }
    );
  });

  it('re-encodes a smaller image without resizing it', async () => {
    await prepareImageForUpload({
      uri: 'file:///small.heic',
      width: 900,
      height: 1200,
    });

    expect(manipulateAsync).toHaveBeenCalledWith('file:///small.heic', [], {
      compress: 0.85,
      format: 'jpeg',
    });
  });
});
