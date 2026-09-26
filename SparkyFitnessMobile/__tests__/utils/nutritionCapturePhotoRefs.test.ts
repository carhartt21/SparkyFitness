import { nutritionCapturePhotoRefs } from '../../src/utils/nutritionCapturePhotoRefs';
import type { NutritionCapture } from '../../src/services/api/nutritionCaptureApi';
import type { PendingPhotoAction } from '../../src/services/nutritionActionOutbox';

const remote = [
  {
    id: 'capture-1',
    consumed_at: '2026-09-23T12:00:00.000Z',
    images: [
      {
        id: 'image-1',
        url: '/api/nutrition-captures/capture-1/images/image-1/file',
      },
    ],
  },
] as NutritionCapture[];
const local = [
  {
    payload: {
      id: 'capture-1',
      consumedAt: '2026-09-23T12:00:00.000Z',
      images: [{ id: 'image-1', uri: 'file:///old-container/photo.jpg' }],
    },
  },
] as PendingPhotoAction[];

describe('capture photo source', () => {
  it('uses the protected server photo online even when a synced local URI remains', () => {
    expect(nutritionCapturePhotoRefs(remote, local, true)['capture-1']).toEqual(
      {
        remotePath: remote[0].images[0].url,
        consumedAt: remote[0].consumed_at,
      }
    );
  });

  it('uses the durable local photo offline, including after server sync', () => {
    expect(
      nutritionCapturePhotoRefs(remote, local, false)['capture-1']
    ).toEqual({
      localUri: local[0].payload.images[0].uri,
      consumedAt: local[0].payload.consumedAt,
    });
  });

  it('keeps an unsynced local capture visible', () => {
    expect(
      nutritionCapturePhotoRefs([], local, true)['capture-1'].localUri
    ).toBe(local[0].payload.images[0].uri);
  });
});
