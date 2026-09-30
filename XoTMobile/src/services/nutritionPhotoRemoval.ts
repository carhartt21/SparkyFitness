import { ApiError } from './api/errors';
import { deleteNutritionCapture } from './api/nutritionCaptureApi';
import {
  listNutritionActions,
  removePhotoCaptureAction,
} from './nutritionActionOutbox';
import { withNutritionActionsPaused } from './nutritionActionSync';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import { removeLocalNutritionPhotoFiles } from './nutritionPhotoFiles';

export class NutritionPhotoRemovalError extends Error {
  constructor(public readonly reason: 'signIn' | 'reconnect') {
    super(reason);
    this.name = 'NutritionPhotoRemovalError';
  }
}

/** Remove an incomplete capture from its owning account and local outbox. */
export async function removeIncompleteMealPhoto(input: {
  captureId: string;
  hasRemoteCapture: boolean;
  isConnected: boolean;
}): Promise<void> {
  await withNutritionActionsPaused(async () => {
    const identity = await getActiveNutritionIdentity();
    if (!identity) throw new NutritionPhotoRemovalError('signIn');
    const actions = await listNutritionActions(identity);
    const creation = actions.find(
      (action) =>
        action.type === 'createPhotoEntry' &&
        action.payload.id === input.captureId
    );
    const hasAttemptedUpload = !!creation && creation.retryCount > 0;
    if (
      input.hasRemoteCapture ||
      hasAttemptedUpload ||
      creation?.syncState === 'synced'
    ) {
      if (!input.isConnected) {
        throw new NutritionPhotoRemovalError('reconnect');
      }
      try {
        await deleteNutritionCapture(input.captureId);
      } catch (error) {
        if (!(error instanceof ApiError && error.statusCode === 404))
          throw error;
      }
    }
    if (creation) await removePhotoCaptureAction(identity, input.captureId);
    // The outbox and server no longer reference this dedicated directory.
    try {
      removeLocalNutritionPhotoFiles(input.captureId);
    } catch {
      // The capture has been removed; a failed local cleanup must not imply
      // that retrying the server deletion is needed.
    }
  });
}
