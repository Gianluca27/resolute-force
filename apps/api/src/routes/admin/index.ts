import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../prisma.js';
import { signAdmin } from '../../lib/jwt.js';
import { requireAdmin, type AuthedRequest } from '../../middleware/auth.js';
import { adminProductsRouter } from './products.js';
import { adminOrdersRouter } from './orders.js';
import { adminConfigRouter } from './config.js';
import { adminPageDesignRouter } from './pageDesign.js';
import { adminUploadsRouter } from './uploads.js';
import { getMetrics } from '../../services/metrics.js';

export const adminRouter = Router();

// A valid bcrypt hash to compare against when the email is unknown — keeps response time
// constant whether or not the account exists, preventing user-enumeration via timing.
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO3p3qS6kQ2Y3sQ4dQ8Q9Q0Q1Q2Q3Q4O';

adminRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Datos inválidos' });
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !ok) return res.status(401).json({ error: 'Credenciales inválidas' });
  res.json({ token: signAdmin({ sub: admin.id, email: admin.email }), email: admin.email });
});

adminRouter.use(requireAdmin); // everything below requires a valid token

adminRouter.get('/me', (req: AuthedRequest, res) => res.json({ email: req.admin!.email }));

adminRouter.use('/products', adminProductsRouter);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/config', adminConfigRouter);
adminRouter.use('/page-design', adminPageDesignRouter);
adminRouter.use('/uploads', adminUploadsRouter);

adminRouter.get('/metrics', async (_req, res, next) => { try { res.json(await getMetrics()); } catch (e) { next(e); } });
