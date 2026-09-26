import type { NutritionCapture } from '../services/api/nutritionCaptureApi';
import type { PendingPhotoAction } from '../services/nutritionActionOutbox';
import type { CapturePhotoRef } from '../components/NutritionCaptureThumbnail';
import { resolveNutritionPhotoUri } from '../services/nutritionPhotoFiles';

/** Prefer the protected server copy online; an old absolute file URI may no
 * longer resolve after an iOS app update. The durable local copy serves offline. */
export function nutritionCapturePhotoRefs(
  remote: NutritionCapture[],
  local: PendingPhotoAction[],
  isConnected: boolean
): Record<string, CapturePhotoRef> {
  const images: Record<string, CapturePhotoRef> = {};
  for (const action of local) {
    const uri = action.payload.images[0]?.uri;
    if (uri)
      images[action.payload.id] = {
        localUri: resolveNutritionPhotoUri(
          action.payload.id,
          action.payload.images[0].id,
          uri
        ),
        consumedAt: action.payload.consumedAt,
      };
  }
  for (const capture of remote) {
    const url = capture.images[0]?.url;
    if (url && (isConnected || !images[capture.id]))
      images[capture.id] = {
        remotePath: url,
        consumedAt: capture.consumed_at,
      };
  }
  return images;
}
