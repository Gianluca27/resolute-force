import { Router } from 'express';
import { z } from 'zod';
import { cartLineSchema, customerSchema } from '@resolute/shared';
import { createOrder, markPaidByOrderNo, reverseOrderIfPaid, OutOfStockError } from '../services/orders.js';
import { QuoteError } from '../services/quote.js';
import * as mp from '../lib/mp.js';
import { verifyWebhookSignature } from '../lib/webhook.js';
import { env } from '../env.js';
import { prisma } from '../prisma.js';

export const paymentsRouter = Router();
const base = z.object({ items: z.array(cartLineSchema).min(1), customer: customerSchema });

/**
 * Confirm an approved payment. If stock can't be reserved (concurrent buyer took the last unit
 * between quote and capture), refund the captured charge and cancel the order — never oversell,
 * never silently keep money for an order we can't fulfill.
 */
async function confirmOrRefund(orderNo: string, paymentId: string): Promise<'paid' | 'refunded'> {
  try {
    await markPaidByOrderNo(orderNo, paymentId);
    return 'paid';
  } catch (e) {
    if (e instanceof OutOfStockError) {
      await mp.refundPayment(paymentId).catch((err) => console.error('[refund]', err));
      await prisma.order.update({ where: { orderNo }, data: { status: 'cancelled' } });
      return 'refunded';
    }
    throw e;
  }
}

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
      const outcome = await confirmOrRefund(order.orderNo, String(payment.id));
      if (outcome === 'refunded') {
        return res.json({ status: 'refunded', orderNo: order.orderNo, detail: 'Se agotó el stock durante el pago; reintegramos el cobro.' });
      }
      return res.json({ status: 'approved', orderNo: order.orderNo, total: order.total, count: order.items.reduce((a, i) => a + i.qty, 0), name: order.customerName });
    }
    await prisma.order.update({ where: { id: order.id }, data: { mpPaymentId: String(payment.id), status: payment.status === 'in_process' ? 'pending' : 'cancelled' } });
    return res.json({ status: payment.status, orderNo: order.orderNo, detail: payment.statusDetail });
  } catch (e) {
    if (e instanceof QuoteError) return res.status(409).json({ error: e.message });
    return res.status(500).json({ error: 'No se pudo procesar el pago' });
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
    if (e instanceof QuoteError) return res.status(409).json({ error: e.message });
    return res.status(500).json({ error: 'No se pudo crear la preferencia' });
  }
});

paymentsRouter.post('/webhook', async (req, res) => {
  try {
    const type = (req.query.type ?? req.body?.type) as string | undefined;
    const id = (req.query['data.id'] ?? req.body?.data?.id) as string | undefined;
    // Reject spoofed notifications when a webhook secret is configured (no-op in dev/test).
    if (!verifyWebhookSignature({
      signature: req.headers['x-signature'] as string | undefined,
      requestId: req.headers['x-request-id'] as string | undefined,
      dataId: String(id ?? ''),
      secret: env.MP_WEBHOOK_SECRET,
    })) {
      return res.sendStatus(401);
    }
    if (type === 'payment' && id) {
      const payment = await mp.getPayment(String(id));
      const REVERSED = ['refunded', 'charged_back', 'cancelled'];
      if (payment.externalReference) {
        if (payment.status === 'approved') {
          await confirmOrRefund(payment.externalReference, String(payment.id));
        } else if (payment.status && REVERSED.includes(payment.status)) {
          await reverseOrderIfPaid(payment.externalReference);
        }
      }
    }
  } catch (e) {
    console.error('[webhook]', e);
  }
  res.sendStatus(200); // always 200 so MP stops retrying
});
