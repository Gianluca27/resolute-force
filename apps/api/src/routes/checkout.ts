import { Router } from 'express';
import { checkoutQuoteSchema } from '@resolute/shared';
import { quote } from '../services/quote.js';

export const checkoutRouter = Router();

checkoutRouter.post('/quote', async (req, res, next) => {
  const parsed = checkoutQuoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Items inválidos', details: parsed.error.flatten() });
  try {
    res.json(await quote(parsed.data.items));
  } catch (e) {
    res.status(409).json({ error: e instanceof Error ? e.message : 'No se pudo cotizar' });
  }
});
