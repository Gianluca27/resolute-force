import { Router } from 'express';
import { pageDesignUpdateSchema } from '@resolute/shared';
import { getDraftDesign, updateDraftDesign, publishDesign, discardDraftDesign } from '../../services/pageDesign.js';

export const adminPageDesignRouter = Router();

adminPageDesignRouter.get('/', async (_req, res, next) => {
  try { res.json(await getDraftDesign()); } catch (e) { next(e); }
});

adminPageDesignRouter.put('/', async (req, res, next) => {
  const p = pageDesignUpdateSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Diseño inválido', details: p.error.flatten() });
  try { res.json(await updateDraftDesign(p.data.doc, p.data.updatedAt)); } catch (e) { next(e); }
});

adminPageDesignRouter.post('/publish', async (_req, res, next) => {
  try { res.json(await publishDesign()); } catch (e) { next(e); }
});

adminPageDesignRouter.post('/discard', async (_req, res, next) => {
  try { res.json(await discardDraftDesign()); } catch (e) { next(e); }
});
