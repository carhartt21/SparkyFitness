import { File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { resolveFoodImageSource } from '../hooks/useFoodImageSource';
import { getActiveServerConfig } from './storage';
import { addLog } from './LogService';

/** Edge of a Watch food thumbnail, in pixels: a 38 pt row at 2x plus margin. */
const THUMBNAIL_PX = 96;
const THUMBNAIL_QUALITY = 0.7;

export type TransferThumbnail = (
  fileUri: string,
  metadata: { type: 'foodThumbnail'; key: string }
) => Promise<void>;

/** Scales the short edge to `THUMBNAIL_PX` and keeps the centre square. */
async function squareThumbnail(
  uri: string
): Promise<ImageManipulator.ImageResult> {
  const original = await ImageManipulator.manipulateAsync(uri, []);
  const scale =
    THUMBNAIL_PX / Math.max(1, Math.min(original.width, original.height));
  const width = Math.max(THUMBNAIL_PX, Math.round(original.width * scale));
  const height = Math.max(THUMBNAIL_PX, Math.round(original.height * scale));
  return ImageManipulator.manipulateAsync(
    original.uri,
    [
      { resize: { width, height } },
      {
        crop: {
          originX: Math.floor((width - THUMBNAIL_PX) / 2),
          originY: Math.floor((height - THUMBNAIL_PX) / 2),
          width: THUMBNAIL_PX,
          height: THUMBNAIL_PX,
        },
      },
    ],
    { compress: THUMBNAIL_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );
}

/** Keys being fetched or sent, so a repeated request doesn't send twice. */
const inFlight = new Set<string>();

/**
 * Fetches the food pictures the Watch asked for, shrinks each to a small
 * square JPEG and sends it as a file named by its key. The Watch cannot reach
 * the server itself, so the phone fetches with its own server settings.
 *
 * Best effort: a picture that fails is logged and skipped, and the Watch asks
 * again on its next launch.
 */
export async function sendWatchFoodThumbnails(
  keys: string[],
  imagePathByKey: Record<string, string>,
  transfer: TransferThumbnail
): Promise<void> {
  const config = await getActiveServerConfig();
  for (const key of keys) {
    const imagePath = imagePathByKey[key];
    if (!imagePath || inFlight.has(key)) continue;
    const source = resolveFoodImageSource(imagePath, config);
    if (!source) continue;
    inFlight.add(key);
    const download = new File(Paths.cache, `watch-thumbnail-${key}-source`);
    try {
      if (download.exists) download.delete();
      await File.downloadFileAsync(source.uri, download, {
        headers: source.headers,
      });
      const thumbnail = await squareThumbnail(download.uri);
      await transfer(thumbnail.uri, { type: 'foodThumbnail', key });
    } catch (error) {
      addLog(
        `Watch food thumbnail ${key} not sent: ${String(error)}`,
        'WARNING'
      );
    } finally {
      if (download.exists) download.delete();
      inFlight.delete(key);
    }
  }
}
