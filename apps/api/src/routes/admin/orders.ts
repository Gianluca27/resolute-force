import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { changeOrderStatus, InvalidStatusTransition, OutOfStockError } from '../../services/orders.js';

export const adminOrdersRouter = Router();

adminOrdersRouter.get('/', async (_req, res, next) => {
  try { res.json(await prisma.order.findMany({ orderBy: { createdAt: 'desc' }, include: { items: true } })); } catch (e) { next(e); }
});

const statusSchema = z.object({ status: z.enum(['pending', 'paid', 'shipped', 'cancelled']) });
adminOrdersRouter.patch('/:id/status', async (req, res, next) => {
  const p = statusSchema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Estado inválido' });
  try {
    const order = await changeOrderStatus(req.params.id!, p.data.status);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json(order);
  } catch (e) {
    if (e instanceof InvalidStatusTransition) return res.status(422).json({ error: e.message });
    if (e instanceof OutOfStockError) return res.status(409).json({ error: e.message });
    next(e);
  }
});
