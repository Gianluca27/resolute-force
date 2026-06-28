import { Router } from 'express';
import multer from 'multer';
import { productInputSchema } from '@resolute/shared';
import { listAll, createProduct, updateProduct, deleteProduct, setProductImage } from '../../services/adminProducts.js';
import { uploadImage } from '../../lib/cloudinary.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  // Only accept real image uploads — reject anything else before it reaches Cloudinary.
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

// Run multer and translate its errors to proper client codes instead of letting them fall to a 500.
// A file over the limit is a client error (H-08) → 413, not a server failure.
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

export const adminProductsRouter = Router();

adminProductsRouter.get('/', async (_req, res, next) => { try { res.json(await listAll()); } catch (e) { next(e); } });

adminProductsRouter.post('/', async (req, res, next) => {
  const parsed = productInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Producto inválido', details: parsed.error.flatten() });
  try { res.status(201).json(await createProduct(parsed.data)); } catch (e) { next(e); }
});

adminProductsRouter.put('/:id', async (req, res, next) => {
  const parsed = productInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Producto inválido' });
  try { res.json(await updateProduct(req.params.id, parsed.data)); } catch (e) { next(e); }
});

adminProductsRouter.delete('/:id', async (req, res, next) => {
  try { await deleteProduct(req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});

adminProductsRouter.post('/:id/image', uploadImageField, async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Imagen inválida o ausente (solo se aceptan imágenes)' });
  try {
    const { url, publicId } = await uploadImage(req.file.buffer);
    res.json(await setProductImage(req.params.id!, url, publicId));
  } catch (e) { next(e); }
});
