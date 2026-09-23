import { Directory, File, Paths } from 'expo-file-system';

const ROOT = 'nutrition-captures';
const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

/** Recover a document photo after iOS changes the app container's absolute URI. */
export function resolveNutritionPhotoUri(
  captureId: string,
  imageId: string,
  storedUri: string
): string {
  try {
    if (new File(storedUri).exists) return storedUri;
    const extension = storedUri
      .split('?')[0]
      .split('#')[0]
      .split('.')
      .pop()
      ?.toLowerCase();
    if (!extension || !imageExtensions.has(extension)) return storedUri;
    const current = new File(
      new Directory(Paths.document, ROOT, captureId),
      `${imageId}.${extension}`
    );
    return current.exists ? current.uri : storedUri;
  } catch {
    return storedUri;
  }
}
