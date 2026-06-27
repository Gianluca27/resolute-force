import { Router } from 'express';
import { z } from 'zod';
import { getDrop, getContent, updateDrop, updateContent } from '../../services/config.js';

export const adminConfigRouter = Router();

const dropSchema = z.object({ targetAt: z.string().min(1), visible: z.boolean(), title: z.string(), teaser: z.string() });
const contentSchema = z.object({
  marquee: z.array(z.string()).min(1), heroKicker: z.string(), heroTitle1: z.string(), heroTitle2: z.string(), heroSubtitle: z.string(),
  transferDiscountPct: z.number().int().min(0).max(90), bankAlias: z.string(), bankCbu: z.string(),
  contactWhatsapp: z.string(), contactInstagram: z.string(), contactEmail: z.string(), contactLocation: z.string(),
});

adminConfigRouter.get('/drop', async (_req, res, next) => { try { res.json(await getDrop()); } catch (e) { next(e); } });
adminConfigRouter.put('/drop', async (req, res, next) => {
  const p = dropSchema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Drop inválido' });
  try { res.json(await updateDrop(p.data)); } catch (e) { next(e); }
});
adminConfigRouter.get('/content', async (_req, res, next) => { try { res.json(await getContent()); } catch (e) { next(e); } });
adminConfigRouter.put('/content', async (req, res, next) => {
  const p = contentSchema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Contenido inválido' });
  try { res.json(await updateContent(p.data)); } catch (e) { next(e); }
});
