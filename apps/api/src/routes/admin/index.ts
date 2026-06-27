import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../prisma.js';
import { signAdmin } from '../../lib/jwt.js';
import { requireAdmin, type AuthedRequest } from '../../middleware/auth.js';
import { adminProductsRouter } from './products.js';
import { adminOrdersRouter } from './orders.js';
import { adminConfigRouter } from './config.js';
import { getMetrics } from '../../services/metrics.js';

export const adminRouter = Router();

adminRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Datos inválidos' });
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return res.status(401).json({ error: 'Credenciales inválidas' });
  res.json({ token: signAdmin({ sub: admin.id, email: admin.email }), email: admin.email });
});

adminRouter.use(requireAdmin); // everything below requires a valid token

adminRouter.get('/me', (req: AuthedRequest, res) => res.json({ email: req.admin!.email }));

adminRouter.use('/products', adminProductsRouter);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/config', adminConfigRouter);

adminRouter.get('/metrics', async (_req, res, next) => { try { res.json(await getMetrics()); } catch (e) { next(e); } });
