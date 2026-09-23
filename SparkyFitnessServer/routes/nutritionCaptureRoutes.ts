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
  listNutritionCaptures,
} from '../models/nutritionCaptureRepository.js';
import { resolveUploadPathWithinRoot } from '../utils/uploadsPath.js';

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
