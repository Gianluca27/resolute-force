import { Router } from 'express';
import multer from 'multer';
import { productInputSchema } from '@resolute/shared';
import { listAll, createProduct, updateProduct, deleteProduct, setProductImage } from '../../services/adminProducts.js';
import { uploadImage } from '../../lib/cloudinary.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });
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

adminProductsRouter.post('/:id/image', upload.single('image'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Falta la imagen' });
  try {
    const { url, publicId } = await uploadImage(req.file.buffer);
    res.json(await setProductImage(req.params.id!, url, publicId));
  } catch (e) { next(e); }
});
