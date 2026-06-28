import { Router } from 'express';
import { z } from 'zod';
import { getDrop, getContent, updateDrop, updateContent } from '../../services/config.js';

export const adminConfigRouter = Router();

const dropSchema = z.object({
  // min(1) catches empty; refine catches non-empty bogus strings ("not-a-date") that would
  // otherwise reach Prisma as Invalid Date and 500 (H-02). updatedAt: optimistic-lock token (H-06).
  targetAt: z.string().min(1).refine((s) => !Number.isNaN(new Date(s).getTime()), { message: 'Fecha inválida' }),
  visible: z.boolean(), title: z.string(), teaser: z.string(), updatedAt: z.string().optional(),
});
const contentSchema = z.object({
  marquee: z.array(z.string()).min(1), heroKicker: z.string(), heroTitle1: z.string(), heroTitle2: z.string(), heroSubtitle: z.string(),
  transferDiscountPct: z.number().int().min(0).max(90), bankAlias: z.string(), bankCbu: z.string(),
  // contactEmail validated like the customer email (was z.string()) — rejects "not-an-email" → broken mailto (H-03).
  contactWhatsapp: z.string(), contactInstagram: z.string(), contactEmail: z.string().email(), contactLocation: z.string(),
  updatedAt: z.string().optional(),
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
