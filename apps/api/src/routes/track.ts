import { Router } from 'express';
import { prisma } from '../prisma.js';

export const trackRouter = Router();
trackRouter.post('/', async (req, res) => {
  const path = typeof req.body?.path === 'string' ? req.body.path.slice(0, 200) : '/';
  try { await prisma.visit.create({ data: { path } }); } catch { /* non-critical */ }
  res.json({ ok: true });
});
