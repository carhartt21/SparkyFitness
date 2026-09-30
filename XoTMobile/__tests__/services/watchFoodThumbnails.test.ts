import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { sendWatchFoodThumbnails } from '../../src/services/watchFoodThumbnails';
import { getActiveServerConfig } from '../../src/services/storage';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockDownload = jest.fn();
jest.mock('expo-file-system', () => {
  const FileMock = jest.fn().mockImplementation(() => ({
    uri: 'file:///cache/source',
    exists: false,
    delete: jest.fn(),
  }));
  Object.assign(FileMock, {
    downloadFileAsync: (...args: unknown[]) => mockDownload(...args),
  });
  return { File: FileMock, Paths: { cache: { uri: 'file:///cache/' } } };
});

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
  proxyHeadersToRecord: () => ({ 'X-Proxy': 'yes' }),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));

const manipulateAsync = ImageManipulator.manipulateAsync as jest.Mock;

describe('sendWatchFoodThumbnails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getActiveServerConfig as jest.Mock).mockResolvedValue({
      url: 'https://fit.example',
      proxyHeaders: [],
    });
    manipulateAsync
      .mockResolvedValueOnce({
        uri: 'file:///cache/original.jpg',
        width: 400,
        height: 300,
      })
      .mockResolvedValueOnce({
        uri: 'file:///cache/thumb.jpg',
        width: 96,
        height: 96,
      });
  });

  it('downloads with proxy headers, crops a centred square and sends it under its key', async () => {
    const transfer = jest.fn().mockResolvedValue(undefined);
    await sendWatchFoodThumbnails(
      ['abcd1234'],
      { abcd1234: '/uploads/foods/1/a.jpg' },
      transfer
    );

    expect(mockDownload).toHaveBeenCalledWith(
      'https://fit.example/api/uploads/foods/1/a.jpg',
      expect.anything(),
      { headers: { 'X-Proxy': 'yes' } }
    );
    expect(manipulateAsync).toHaveBeenLastCalledWith(
      'file:///cache/original.jpg',
      [
        { resize: { width: 128, height: 96 } },
        { crop: { originX: 16, originY: 0, width: 96, height: 96 } },
      ],
      { compress: 0.7, format: 'jpeg' }
    );
    expect(transfer).toHaveBeenCalledWith('file:///cache/thumb.jpg', {
      type: 'foodThumbnail',
      key: 'abcd1234',
    });
  });

  it('ignores keys that do not belong to an offered food', async () => {
    const transfer = jest.fn();
    await sendWatchFoodThumbnails(['ffffffff'], {}, transfer);
    expect(File).not.toHaveBeenCalled();
    expect(transfer).not.toHaveBeenCalled();
  });

  it('skips a picture that fails and keeps going', async () => {
    mockDownload.mockRejectedValueOnce(new Error('offline'));
    const transfer = jest.fn().mockResolvedValue(undefined);
    await sendWatchFoodThumbnails(
      ['aaaaaaaa', 'bbbbbbbb'],
      {
        aaaaaaaa: '/uploads/foods/1/a.jpg',
        bbbbbbbb: '/uploads/foods/2/b.jpg',
      },
      transfer
    );
    expect(transfer).toHaveBeenCalledTimes(1);
    expect(transfer).toHaveBeenCalledWith(expect.any(String), {
      type: 'foodThumbnail',
      key: 'bbbbbbbb',
    });
  });
});
