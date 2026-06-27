import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { markPaidByOrderNo } from '../../services/orders.js';

export const adminOrdersRouter = Router();

adminOrdersRouter.get('/', async (_req, res, next) => {
  try { res.json(await prisma.order.findMany({ orderBy: { createdAt: 'desc' }, include: { items: true } })); } catch (e) { next(e); }
});

const statusSchema = z.object({ status: z.enum(['pending', 'paid', 'shipped', 'cancelled']) });
adminOrdersRouter.patch('/:id/status', async (req, res, next) => {
  const p = statusSchema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Estado inválido' });
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (p.data.status === 'paid') { await markPaidByOrderNo(order.orderNo, order.mpPaymentId ?? 'manual'); }
    else { await prisma.order.update({ where: { id: order.id }, data: { status: p.data.status } }); }
    res.json(await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } }));
  } catch (e) { next(e); }
});
