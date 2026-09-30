import { ApiError } from '../../src/services/api/errors';
import { deleteNutritionCapture } from '../../src/services/api/nutritionCaptureApi';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import {
  listNutritionActions,
  removePhotoCaptureAction,
} from '../../src/services/nutritionActionOutbox';
import { removeLocalNutritionPhotoFiles } from '../../src/services/nutritionPhotoFiles';
import { removeIncompleteMealPhoto } from '../../src/services/nutritionPhotoRemoval';

jest.mock('../../src/services/api/nutritionCaptureApi', () => ({
  deleteNutritionCapture: jest.fn(),
}));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/nutritionActionOutbox', () => ({
  listNutritionActions: jest.fn(),
  removePhotoCaptureAction: jest.fn(),
}));
jest.mock('../../src/services/nutritionActionSync', () => ({
  withNutritionActionsPaused: (work: () => Promise<unknown>) => work(),
}));
jest.mock('../../src/services/nutritionPhotoFiles', () => ({
  removeLocalNutritionPhotoFiles: jest.fn(),
}));

const captureId = '281fe77f-2d74-43aa-8f35-c47aa106d6e7';
const identity = { serverConfigId: 'server-a', userId: 'user-a' };
const pendingPhoto = {
  type: 'createPhotoEntry',
  payload: { id: captureId },
  syncState: 'pending',
  retryCount: 0,
};

describe('removeIncompleteMealPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
    jest
      .mocked(listNutritionActions)
      .mockResolvedValue([pendingPhoto] as never);
    jest.mocked(deleteNutritionCapture).mockResolvedValue(undefined);
    jest.mocked(removePhotoCaptureAction).mockResolvedValue(true);
  });

  it('removes a never-uploaded photo offline without a server request', async () => {
    await removeIncompleteMealPhoto({
      captureId,
      hasRemoteCapture: false,
      isConnected: false,
    });
    expect(deleteNutritionCapture).not.toHaveBeenCalled();
    expect(removePhotoCaptureAction).toHaveBeenCalledWith(identity, captureId);
    expect(removeLocalNutritionPhotoFiles).toHaveBeenCalledWith(captureId);
  });

  it('deletes a server copy before clearing the local outbox', async () => {
    await removeIncompleteMealPhoto({
      captureId,
      hasRemoteCapture: true,
      isConnected: true,
    });
    expect(deleteNutritionCapture).toHaveBeenCalledWith(captureId);
    expect(
      jest.mocked(deleteNutritionCapture).mock.invocationCallOrder[0]
    ).toBeLessThan(
      jest.mocked(removePhotoCaptureAction).mock.invocationCallOrder[0]
    );
    expect(removeLocalNutritionPhotoFiles).toHaveBeenCalledWith(captureId);
  });

  it('keeps an attempted upload when offline', async () => {
    jest
      .mocked(listNutritionActions)
      .mockResolvedValue([{ ...pendingPhoto, retryCount: 1 }] as never);
    await expect(
      removeIncompleteMealPhoto({
        captureId,
        hasRemoteCapture: false,
        isConnected: false,
      })
    ).rejects.toMatchObject({ reason: 'reconnect' });
    expect(removePhotoCaptureAction).not.toHaveBeenCalled();
  });

  it('preserves local state if the server rejects deletion', async () => {
    jest
      .mocked(deleteNutritionCapture)
      .mockRejectedValue(new ApiError('Completed capture', 409));
    await expect(
      removeIncompleteMealPhoto({
        captureId,
        hasRemoteCapture: true,
        isConnected: true,
      })
    ).rejects.toThrow('Completed capture');
    expect(removePhotoCaptureAction).not.toHaveBeenCalled();
    expect(removeLocalNutritionPhotoFiles).not.toHaveBeenCalled();
  });
});
