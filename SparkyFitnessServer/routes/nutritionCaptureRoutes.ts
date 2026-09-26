import express from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  uploadSingleImage,
  stagedFilesFrom,
  finalizeUploadedImages,
  cleanupStagedImages,
  removeOrphanedImages,
  removeEntityImageDir,
  MAX_IMAGE_COUNT,
} from '../middleware/imageUpload.js';
import {
  addNutritionCaptureImage,
  createNutritionCapture,
  deleteNutritionCapture,
  deleteNutritionCaptureImage,
  getNutritionCapture,
  getNutritionCaptureImage,
  getNutritionCaptureFoodEntry,
  listNutritionCaptures,
  markNutritionCaptureComplete,
} from '../models/nutritionCaptureRepository.js';
import { resolveUploadPathWithinRoot } from '../utils/uploadsPath.js';
import foodEntryService from '../services/foodEntryService.js';

const router = express.Router();
router.use(authenticate);

const idSchema = z.uuid();
const createSchema = z.strictObject({
  id: idSchema,
  capturedAt: z.iso.datetime({ offset: true }),
  consumedAt: z.iso.datetime({ offset: true }),
  entryDate: z.iso.date(),
  mealTypeId: idSchema.nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
});
const completeSchema = z.strictObject({
  clientOperationId: idSchema,
  food: z.strictObject({
    meal_type_id: z.string().min(1),
    quantity: z.number().finite().positive(),
    unit: z.string().min(1),
    food_id: z.string().optional(),
    variant_id: z.string().optional(),
    food_name: z.string().min(1),
    brand_name: z.string().optional(),
    serving_size: z.number().finite().positive(),
    serving_unit: z.string().min(1),
    calories: z.number().finite().nonnegative(),
    protein: z.number().finite().nonnegative().optional(),
    carbs: z.number().finite().nonnegative().optional(),
    fat: z.number().finite().nonnegative().optional(),
    dietary_fiber: z.number().finite().nonnegative().optional(),
    saturated_fat: z.number().finite().nonnegative().optional(),
    sodium: z.number().finite().nonnegative().optional(),
    sugars: z.number().finite().nonnegative().optional(),
    trans_fat: z.number().finite().nonnegative().optional(),
    potassium: z.number().finite().nonnegative().optional(),
    calcium: z.number().finite().nonnegative().optional(),
    iron: z.number().finite().nonnegative().optional(),
    caffeine_mg: z.number().finite().nonnegative().optional(),
    water_ml: z.number().finite().nonnegative().optional(),
    alcohol_g: z.number().finite().nonnegative().optional(),
    cholesterol: z.number().finite().nonnegative().optional(),
    vitamin_a: z.number().finite().nonnegative().optional(),
    vitamin_c: z.number().finite().nonnegative().optional(),
    custom_nutrients: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .nullable()
      .optional(),
  }),
});

// Captures are personal to the authenticated actor. A family diary context
// must not silently switch the owner of a private meal photo.
const owner = (req: express.Request) => req.authenticatedUserId || req.userId;

router.post('/', express.json(), async (req, res, next) => {
  const input = createSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: 'Invalid nutrition capture.' });
    return;
  }
  try {
    const capture = await createNutritionCapture(owner(req), input.data);
    if (!capture) {
      res.status(409).json({ error: 'Capture ID belongs to another owner.' });
      return;
    }
    res.status(200).json(capture);
  } catch (error) {
    next(error);
  }
});

router.get('/by-date/:date', async (req, res, next) => {
  const parsed = z.iso.date().safeParse(req.params.date);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid date.' });
    return;
  }
  try {
    res.json(await listNutritionCaptures(owner(req), parsed.data));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  const parsed = idSchema.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid ID.' });
  try {
    const capture = await getNutritionCapture(owner(req), parsed.data);
    if (!capture) return res.status(404).json({ error: 'Not found.' });
    res.json(capture);
  } catch (error) {
    next(error);
  }
});

// One reviewed snapshot completes this occurrence. Retries use the same
// operation ID; an existing linked row wins over a different completion.
router.post('/:id/complete', express.json(), async (req, res, next) => {
  const id = idSchema.safeParse(req.params.id);
  const input = completeSchema.safeParse(req.body);
  if (!id.success || !input.success) {
    return res.status(400).json({ error: 'Invalid completion.' });
  }
  const userId = owner(req);
  try {
    const capture = await getNutritionCapture(userId, id.data);
    if (!capture) return res.status(404).json({ error: 'Not found.' });
    const existing = await getNutritionCaptureFoodEntry(userId, id.data);
    if (
      existing &&
      existing.client_operation_id !== input.data.clientOperationId
    ) {
      return res.status(409).json({ error: 'Capture already completed.' });
    }
    const entry =
      existing ??
      (await foodEntryService.createFoodEntry(userId, userId, {
        ...input.data.food,
        entry_date: capture.entry_date,
        // The capture owns the precise consumed instant. A food diary clock
        // field has no timezone, so do not derive it from server-local time.
        entry_time: null,
        client_operation_id: input.data.clientOperationId,
        nutrition_capture_id: id.data,
      }));
    if (entry.nutrition_capture_id !== id.data) {
      return res
        .status(409)
        .json({ error: 'Operation ID belongs to another entry.' });
    }
    await markNutritionCaptureComplete(userId, id.data);
    return res.json({
      capture: await getNutritionCapture(userId, id.data),
      entry,
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      const raced = await getNutritionCaptureFoodEntry(userId, id.data);
      if (raced?.client_operation_id === input.data.clientOperationId) {
        await markNutritionCaptureComplete(userId, id.data);
        return res.json({
          capture: await getNutritionCapture(userId, id.data),
          entry: raced,
        });
      }
      return res.status(409).json({ error: 'Capture already completed.' });
    }
    next(error);
  }
});

router.put(
  '/:id/images/:imageId',
  uploadSingleImage,
  async (req, res, next) => {
    const id = idSchema.safeParse(req.params.id);
    const imageId = idSchema.safeParse(req.params.imageId);
    if (!id.success || !imageId.success) {
      await cleanupStagedImages(req);
      return res.status(400).json({ error: 'Invalid ID.' });
    }
    try {
      const capture = await getNutritionCapture(owner(req), id.data);
      if (!capture) return res.status(404).json({ error: 'Not found.' });
      const existing = await getNutritionCaptureImage(
        owner(req),
        id.data,
        imageId.data
      );
      if (existing) return res.json(existing);
      if (capture.images.length >= MAX_IMAGE_COUNT) {
        return res.status(400).json({ error: 'Too many images.' });
      }
      const staged = stagedFilesFrom(req);
      if (staged.length !== 1) {
        return res.status(400).json({ error: 'One image is required.' });
      }
      const paths = await finalizeUploadedImages(
        staged,
        'nutrition_captures',
        id.data
      );
      try {
        const inserted = await addNutritionCaptureImage(
          owner(req),
          id.data,
          imageId.data,
          paths[0]
        );
        if (inserted) return res.json(inserted);
        const raced = await getNutritionCaptureImage(
          owner(req),
          id.data,
          imageId.data
        );
        await removeOrphanedImages(paths, []);
        if (raced) return res.json(raced);
        return res.status(409).json({ error: 'Image ID conflict.' });
      } catch (error) {
        await removeOrphanedImages(paths, []);
        throw error;
      }
    } catch (error) {
      next(error);
    } finally {
      await cleanupStagedImages(req);
    }
  }
);

router.get('/:id/images/:imageId/file', async (req, res, next) => {
  const id = idSchema.safeParse(req.params.id);
  const imageId = idSchema.safeParse(req.params.imageId);
  if (!id.success || !imageId.success) {
    return res.status(400).json({ error: 'Invalid ID.' });
  }
  try {
    const image = await getNutritionCaptureImage(
      owner(req),
      id.data,
      imageId.data
    );
    if (!image) return res.status(404).json({ error: 'Not found.' });
    const file = resolveUploadPathWithinRoot(image.file_path);
    if (!file) return res.status(404).json({ error: 'Not found.' });
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(file);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/images/:imageId', async (req, res, next) => {
  const id = idSchema.safeParse(req.params.id);
  const imageId = idSchema.safeParse(req.params.imageId);
  if (!id.success || !imageId.success) {
    return res.status(400).json({ error: 'Invalid ID.' });
  }
  try {
    const removed = await deleteNutritionCaptureImage(
      owner(req),
      id.data,
      imageId.data
    );
    if (!removed) return res.status(404).json({ error: 'Not found.' });
    await removeOrphanedImages([removed.file_path], []);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: 'Invalid ID.' });
  try {
    const removed = await deleteNutritionCapture(owner(req), id.data);
    if (!removed) return res.status(404).json({ error: 'Not found.' });
    await removeEntityImageDir('nutrition_captures', id.data);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
