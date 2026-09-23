import { Directory, File, Paths } from 'expo-file-system';
import { newUuid } from '../utils/ids';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import {
  enqueuePhotoCapture,
  type PendingPhotoAction,
} from './nutritionActionOutbox';

const ROOT = 'nutrition-captures';
const extensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export interface SaveMealPhotoInput {
  sourceUri: string;
  capturedAt?: string;
  consumedAt?: string;
  mealTypeId?: string;
  notes?: string;
}

/** Move a picker/cache URI into application documents before recording action. */
export async function saveMealPhotoLocally(
  input: SaveMealPhotoInput
): Promise<PendingPhotoAction> {
  const identity = await getActiveNutritionIdentity();
  if (!identity) {
    throw new Error('Sign in once while online before saving meals offline.');
  }
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const consumedAt = input.consumedAt ?? capturedAt;
  const consumed = new Date(consumedAt);
  if (
    Number.isNaN(consumed.getTime()) ||
    Number.isNaN(Date.parse(capturedAt))
  ) {
    throw new Error('Invalid meal timestamp.');
  }
  const captureId = newUuid();
  const imageId = newUuid();
  const rawExtension = input.sourceUri
    .split('?')[0]
    .split('.')
    .pop()
    ?.toLowerCase();
  if (!rawExtension || !extensions.has(rawExtension)) {
    throw new Error('Unsupported meal photo format.');
  }
  const extension = rawExtension;
  const directory = new Directory(Paths.document, ROOT, captureId);
  directory.create({ intermediates: true, idempotent: true });
  const durable = new File(directory, `${imageId}.${extension}`);
  try {
    await new File(input.sourceUri).copy(durable);
    if (!durable.exists || durable.size <= 0) {
      throw new Error('Meal photo could not be saved on this device.');
    }
    return await enqueuePhotoCapture({
      ...identity,
      payload: {
        id: captureId,
        capturedAt,
        consumedAt,
        entryDate: `${consumed.getFullYear()}-${String(consumed.getMonth() + 1).padStart(2, '0')}-${String(consumed.getDate()).padStart(2, '0')}`,
        mealTypeId: input.mealTypeId ?? null,
        notes: input.notes ?? null,
        images: [{ id: imageId, uri: durable.uri }],
      },
    });
  } catch (error) {
    // The outbox write failed, so this copy cannot be reached from any action.
    // A crash between copy and enqueue may leave one orphan; startup recovery
    // can safely inspect this dedicated directory without touching other data.
    try {
      if (directory.exists) directory.delete();
    } catch {
      // Preserve the original persistence failure for the caller.
    }
    throw error;
  }
}

export function isMealPhotoAvailable(uri: string): boolean {
  return new File(uri).exists;
}
