import { getClient } from '../db/poolManager.js';

export interface CaptureInput {
  id: string;
  capturedAt: string;
  consumedAt: string;
  entryDate: string;
  mealTypeId?: string | null;
  notes?: string | null;
}

const captureSelect = `
  SELECT c.id, c.user_id, c.captured_at, c.consumed_at, c.entry_date,
         c.meal_type_id, c.notes, c.completion_state, c.created_at,
         c.updated_at,
         COALESCE((
           SELECT jsonb_agg(
             jsonb_build_object('id', i.id,
               'url', '/api/nutrition-captures/' || c.id || '/images/' || i.id || '/file')
             ORDER BY i.created_at, i.id)
           FROM nutrition_capture_images i WHERE i.capture_id = c.id
         ), '[]'::jsonb) AS images
    FROM nutrition_captures c`;

export async function getNutritionCapture(userId: string, id: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `${captureSelect} WHERE c.user_id = $1 AND c.id = $2`,
      [userId, id]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function listNutritionCaptures(userId: string, entryDate: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `${captureSelect}
       WHERE c.user_id = $1 AND c.entry_date = $2
       ORDER BY c.consumed_at, c.id`,
      [userId, entryDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/** The client UUID is the immutable create-operation key. */
export async function createNutritionCapture(
  userId: string,
  input: CaptureInput
) {
  const client = await getClient(userId);
  try {
    await client.query(
      `INSERT INTO nutrition_captures
        (id, user_id, captured_at, consumed_at, entry_date, meal_type_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        input.id,
        userId,
        input.capturedAt,
        input.consumedAt,
        input.entryDate,
        input.mealTypeId ?? null,
        input.notes ?? null,
      ]
    );
    const result = await client.query(
      `${captureSelect} WHERE c.user_id = $1 AND c.id = $2`,
      [userId, input.id]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function getNutritionCaptureImage(
  userId: string,
  captureId: string,
  imageId: string
) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT i.id, i.file_path FROM nutrition_capture_images i
        JOIN nutrition_captures c ON c.id = i.capture_id
       WHERE c.user_id = $1 AND c.id = $2 AND i.id = $3`,
      [userId, captureId, imageId]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function addNutritionCaptureImage(
  userId: string,
  captureId: string,
  imageId: string,
  filePath: string
) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `INSERT INTO nutrition_capture_images (id, capture_id, file_path)
       SELECT $3, c.id, $4 FROM nutrition_captures c
       WHERE c.id = $2 AND c.user_id = $1
       ON CONFLICT (id) DO NOTHING
       RETURNING id, file_path`,
      [userId, captureId, imageId, filePath]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function deleteNutritionCaptureImage(
  userId: string,
  captureId: string,
  imageId: string
) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `DELETE FROM nutrition_capture_images i
        USING nutrition_captures c
       WHERE c.id = i.capture_id AND c.user_id = $1
         AND c.id = $2 AND i.id = $3
       RETURNING i.file_path`,
      [userId, captureId, imageId]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function deleteNutritionCapture(userId: string, id: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `DELETE FROM nutrition_captures
       WHERE user_id = $1 AND id = $2 RETURNING id`,
      [userId, id]
    );
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

export async function getNutritionCaptureFoodEntry(userId: string, id: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT fe.* FROM food_entries fe
       WHERE fe.user_id = $1 AND fe.nutrition_capture_id = $2`,
      [userId, id]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function markNutritionCaptureComplete(userId: string, id: string) {
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `UPDATE nutrition_captures SET completion_state = 'complete',
          updated_at = now()
       WHERE user_id = $1 AND id = $2
       RETURNING id`,
      [userId, id]
    );
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}
