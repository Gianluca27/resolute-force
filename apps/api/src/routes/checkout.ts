import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { checkoutQuoteSchema } from '@resolute/shared';
import { quote, QuoteError } from '../services/quote.js';

export const checkoutRouter = Router();

checkoutRouter.post('/quote', async (req: Request, res: Response, next: NextFunction) => {
  const parsed = checkoutQuoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Items inválidos', details: parsed.error.flatten() });
  try {
    res.json(await quote(parsed.data.items));
  } catch (e) {
    if (e instanceof QuoteError) return res.status(409).json({ error: e.message });
    next(e);
  }
});
