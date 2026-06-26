import { Router } from 'express';
import { z } from 'zod';
import { cartLineSchema, customerSchema } from '@resolute/shared';
import { createOrder } from '../services/orders.js';
import { prisma } from '../prisma.js';

export const ordersRouter = Router();
const base = z.object({ items: z.array(cartLineSchema).min(1), customer: customerSchema });

ordersRouter.post('/transfer', async (req, res) => {
  const parsed = base.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
  try {
    const { order } = await createOrder({ items: parsed.data.items, customer: parsed.data.customer, method: 'transfer' });
    const content = await prisma.siteContent.findUnique({ where: { id: 1 } });
    void import('../services/notify.js').then((m) => m.notifyTransferOrder(order.orderNo, { bankAlias: content?.bankAlias ?? '', bankCbu: content?.bankCbu ?? '' })).catch((e) => console.error('[notify:transfer]', e));
    return res.json({
      orderNo: order.orderNo, total: order.total, count: order.items.reduce((a, i) => a + i.qty, 0),
      name: order.customerName, bankAlias: content?.bankAlias ?? '', bankCbu: content?.bankCbu ?? '',
    });
  } catch (e) {
    return res.status(409).json({ error: e instanceof Error ? e.message : 'No se pudo crear el pedido' });
  }
});
