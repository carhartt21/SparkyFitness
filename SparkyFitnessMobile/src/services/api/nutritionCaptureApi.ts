import { apiFetch } from './apiClient';
import { postImageMultipart } from './imageUploadClient';
import type {
  PhotoCapturePayload,
  PhotoCompletionPayload,
} from '../nutritionActionOutbox';
import type { FoodEntry } from '../../types/foodEntries';

export interface NutritionCapture {
  id: string;
  user_id: string;
  captured_at: string;
  consumed_at: string;
  entry_date: string;
  meal_type_id: string | null;
  notes: string | null;
  completion_state: 'incomplete' | 'complete';
  images: { id: string; url: string }[];
}

export async function createNutritionCapture(
  payload: PhotoCapturePayload
): Promise<NutritionCapture> {
  return apiFetch<NutritionCapture>({
    endpoint: '/api/nutrition-captures',
    serviceName: 'Nutrition Capture API',
    operation: 'create capture',
    method: 'POST',
    body: {
      id: payload.id,
      capturedAt: payload.capturedAt,
      consumedAt: payload.consumedAt,
      entryDate: payload.entryDate,
      mealTypeId: payload.mealTypeId,
      notes: payload.notes,
    },
  });
}

export async function uploadNutritionCaptureImage(
  captureId: string,
  image: { id: string; uri: string }
): Promise<{ id: string; file_path: string }> {
  return postImageMultipart({
    endpoint: `/api/nutrition-captures/${captureId}/images/${image.id}`,
    serviceName: 'Nutrition Capture API',
    operation: 'upload capture image',
    method: 'PUT',
    fileField: 'image',
    includeOrder: false,
    order: [],
    newUris: [image.uri],
  });
}

export async function fetchNutritionCapturesByDate(
  date: string
): Promise<NutritionCapture[]> {
  return apiFetch<NutritionCapture[]>({
    endpoint: `/api/nutrition-captures/by-date/${date}`,
    serviceName: 'Nutrition Capture API',
    operation: 'list captures',
  });
}

export async function completeNutritionCapture(
  operationId: string,
  payload: PhotoCompletionPayload
): Promise<{ capture: NutritionCapture; entry: FoodEntry }> {
  return apiFetch<{ capture: NutritionCapture; entry: FoodEntry }>({
    endpoint: `/api/nutrition-captures/${payload.captureId}/complete`,
    serviceName: 'Nutrition Capture API',
    operation: 'complete capture',
    method: 'POST',
    body: { clientOperationId: operationId, food: payload.food },
  });
}
