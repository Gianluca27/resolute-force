import { Router } from 'express';
import { listProducts, getProductBySlug } from '../services/catalog.js';

export const productsRouter = Router();

productsRouter.get('/', async (_req, res, next) => {
  try { res.json(await listProducts()); } catch (e) { next(e); }
});

productsRouter.get('/:slug', async (req, res, next) => {
  try {
    const product = await getProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(product);
  } catch (e) { next(e); }
});
