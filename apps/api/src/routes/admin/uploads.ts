import { Router } from 'express';
import multer from 'multer';
import { uploadImage } from '../../lib/cloudinary.js';

// Generic image upload for page-builder blocks (gallery, text+image, banners).
// Same limits/filtering as the product image upload.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

const uploadImageField: import('express').RequestHandler = (req, res, next) => {
  upload.single('image')(req, res, (err: unknown) => {
    if (err) {
      if ((err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'La imagen supera el límite de 6 MB' });
      }
      return next(err);
    }
    next();
  });
};

export const adminUploadsRouter = Router();

adminUploadsRouter.post('/', uploadImageField, async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Imagen inválida o ausente (solo se aceptan imágenes)' });
  try {
    res.status(201).json(await uploadImage(req.file.buffer, 'resolute-force/design'));
  } catch (e) { next(e); }
});
