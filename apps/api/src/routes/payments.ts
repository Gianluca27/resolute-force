import { Router } from 'express';
import { z } from 'zod';
import { cartLineSchema, customerSchema } from '@resolute/shared';
import { createOrder, markPaidByOrderNo } from '../services/orders.js';
import * as mp from '../lib/mp.js';
import { env } from '../env.js';
import { prisma } from '../prisma.js';

export const paymentsRouter = Router();
const base = z.object({ items: z.array(cartLineSchema).min(1), customer: customerSchema });

paymentsRouter.get('/public-key', (_req, res) => res.json({ publicKey: env.MP_PUBLIC_KEY }));

paymentsRouter.post('/card', async (req, res) => {
  const schema = base.extend({
    token: z.string().min(1), installments: z.number().int().min(1), paymentMethodId: z.string().min(1),
    issuerId: z.string().optional(),
    payer: z.object({ email: z.string().email(), identification: z.object({ type: z.string(), number: z.string() }).optional() }),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos de pago inválidos' });

  try {
    const { order } = await createOrder({ items: parsed.data.items, customer: parsed.data.customer, method: 'card' });
    const payment = await mp.createCardPayment({
      amount: order.total, token: parsed.data.token, installments: parsed.data.installments,
      paymentMethodId: parsed.data.paymentMethodId, issuerId: parsed.data.issuerId,
      payerEmail: parsed.data.payer.email, identification: parsed.data.payer.identification, orderNo: order.orderNo,
    });
    if (payment.status === 'approved') {
      await markPaidByOrderNo(order.orderNo, String(payment.id));
      return res.json({ status: 'approved', orderNo: order.orderNo, total: order.total, count: order.items.reduce((a, i) => a + i.qty, 0), name: order.customerName });
    }
    await prisma.order.update({ where: { id: order.id }, data: { mpPaymentId: String(payment.id), status: payment.status === 'in_process' ? 'pending' : 'cancelled' } });
    return res.json({ status: payment.status, orderNo: order.orderNo, detail: payment.statusDetail });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Error de pago' });
  }
});

paymentsRouter.post('/preference', async (req, res) => {
  const parsed = base.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
  try {
    const { order, quote } = await createOrder({ items: parsed.data.items, customer: parsed.data.customer, method: 'wallet' });
    const pref = await mp.createPreference({ orderNo: order.orderNo, customer: parsed.data.customer, lines: quote.lines });
    await prisma.order.update({ where: { id: order.id }, data: { mpPreferenceId: pref.id } });
    return res.json({ preferenceId: pref.id, initPoint: pref.initPoint, orderNo: order.orderNo });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Error creando preferencia' });
  }
});

paymentsRouter.post('/webhook', async (req, res) => {
  try {
    const type = (req.query.type ?? req.body?.type) as string | undefined;
    const id = (req.query['data.id'] ?? req.body?.data?.id) as string | undefined;
    if (type === 'payment' && id) {
      const payment = await mp.getPayment(String(id));
      if (payment.status === 'approved' && payment.externalReference) {
        await markPaidByOrderNo(payment.externalReference, String(payment.id));
      }
    }
  } catch (e) {
    console.error('[webhook]', e);
  }
  res.sendStatus(200); // always 200 so MP stops retrying
});
