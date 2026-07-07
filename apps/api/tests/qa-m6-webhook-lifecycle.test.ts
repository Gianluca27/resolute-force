// QA Módulo 6 — Webhook & Order Lifecycle (docs/qa/06-webhook-order-lifecycle.md)
// Ejecuta los casos TC-WHK-001..037 de forma determinística contra la DB de test,
// con MercadoPago y notify mockeados. NO es parte del set permanente: archivo de corrida QA.
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/mp.js', () => ({
  createCardPayment: vi.fn(),
  createPreference: vi.fn().mockResolvedValue({ id: 'PREF-1', initPoint: 'https://mp.test/redirect' }),
  getPayment: vi.fn(),
  refundPayment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/services/notify.js', () => ({
  notifyOrderPaid: vi.fn().mockResolvedValue(undefined),
  notifyTransferOrder: vi.fn().mockResolvedValue(undefined),
}));
// Real signature logic by default (secret='' → skip). Overridable per-test for the 401 route path.
vi.mock('../src/lib/webhook.js', async (orig) => {
  const actual = (await orig()) as typeof import('../src/lib/webhook.js');
  return { verifyWebhookSignature: vi.fn(actual.verifyWebhookSignature) };
});

import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import { prisma } from '../src/prisma.js';
import { createOrder } from '../src/services/orders.js';
import * as mp from '../src/lib/mp.js';
import * as notify from '../src/services/notify.js';
import { verifyWebhookSignature } from '../src/lib/webhook.js';

const app = createApp();
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', calle: 'Calle 1', altura: '100', cp: '1425', provincia: 'C', ciudad: 'CABA' };
let navyId = '';

const stockMS = () => prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } }).then((v) => v.stock);
const setStockMS = (n: number) => prisma.variant.updateMany({ where: { productId: navyId, size: 'M' }, data: { stock: n } });
const orderBy = (orderNo: string) => prisma.order.findUniqueOrThrow({ where: { orderNo }, include: { items: true } });
const pendingOrder = (qty: number, method: 'transfer' | 'card' | 'wallet' = 'wallet') =>
  createOrder({ items: [{ productId: navyId, size: 'M', qty }], customer, method }).then((r) => r.order);
const webhook = (id: string, body: Record<string, unknown> = {}) =>
  request(app).post(`/api/payments/webhook?type=payment&data.id=${id}`).send(body);
const approves = (orderNo: string, id: string | number = 999) =>
  vi.mocked(mp.getPayment).mockResolvedValue({ id: Number(id), status: 'approved', externalReference: orderNo });

beforeEach(async () => {
  await resetDb();
  await seed();
  vi.clearAllMocks();
  vi.mocked(verifyWebhookSignature).mockImplementation(
    (await vi.importActual<typeof import('../src/lib/webhook.js')>('../src/lib/webhook.js')).verifyWebhookSignature,
  );
  navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
});

// ───────────────────────── A. Signature validation ─────────────────────────
describe('A. Signature validation', () => {
  it('TC-WHK-001: no secret → check skipped → processed (200)', async () => {
    const o = await pendingOrder(1);
    approves(o.orderNo);
    const res = await webhook('999');
    expect(res.status).toBe(200);
    expect((await orderBy(o.orderNo)).status).toBe('paid');
  });

  it('TC-WHK-002/003: verifier rejects (missing/tampered) → 401, no processing, state unchanged', async () => {
    const o = await pendingOrder(1);
    vi.mocked(verifyWebhookSignature).mockReturnValueOnce(false);
    const res = await webhook('999');
    expect(res.status).toBe(401);
    expect(mp.getPayment).not.toHaveBeenCalled();
    expect((await orderBy(o.orderNo)).status).toBe('pending');
    expect(await stockMS()).toBe(25);
  });

  it('TC-WHK-004: valid signature → processed (verifier true)', async () => {
    const o = await pendingOrder(1);
    approves(o.orderNo);
    vi.mocked(verifyWebhookSignature).mockReturnValueOnce(true);
    const res = await webhook('999');
    expect(res.status).toBe(200);
    expect((await orderBy(o.orderNo)).status).toBe('paid');
  });
  // TC-WHK-005 (constant-time) verificado por inspección: webhook.ts usa crypto.timingSafeEqual.
});

// ───────────────────────── B. Webhook processing ─────────────────────────
describe('B. Webhook processing', () => {
  it('TC-WHK-006: type ≠ payment is ignored', async () => {
    const res = await request(app).post('/api/payments/webhook?type=plan&data.id=123').send({});
    expect(res.status).toBe(200);
    expect(mp.getPayment).not.toHaveBeenCalled();
  });

  it('TC-WHK-007: missing data.id handled gracefully (no getPayment, no crash)', async () => {
    const res = await request(app).post('/api/payments/webhook?type=payment').send({});
    expect(res.status).toBe(200);
    expect(mp.getPayment).not.toHaveBeenCalled();
  });

  it('TC-WHK-008: reads type & id from query params', async () => {
    const o = await pendingOrder(1);
    approves(o.orderNo);
    await request(app).post('/api/payments/webhook?type=payment&data.id=999').send({});
    expect(mp.getPayment).toHaveBeenCalledWith('999');
    expect((await orderBy(o.orderNo)).status).toBe('paid');
  });

  it('TC-WHK-009: reads type & id from JSON body', async () => {
    const o = await pendingOrder(1);
    approves(o.orderNo);
    const res = await request(app).post('/api/payments/webhook').send({ type: 'payment', data: { id: '999' } });
    expect(res.status).toBe(200);
    expect(mp.getPayment).toHaveBeenCalledWith('999');
    expect((await orderBy(o.orderNo)).status).toBe('paid');
  });

  it('TC-WHK-010: getPayment is authoritative; body-claimed status ignored', async () => {
    const o = await pendingOrder(1);
    vi.mocked(mp.getPayment).mockResolvedValue({ id: 999, status: 'rejected', externalReference: o.orderNo });
    const res = await webhook('999', { type: 'payment', data: { id: '999' }, status: 'approved' });
    expect(res.status).toBe(200);
    expect(mp.getPayment).toHaveBeenCalledWith('999');
    expect((await orderBy(o.orderNo)).status).toBe('pending');
    expect(await stockMS()).toBe(25);
  });

  it('TC-WHK-011: approved → paid + stock 25→24 + paid email', async () => {
    const o = await pendingOrder(1);
    approves(o.orderNo);
    const res = await webhook('999');
    expect(res.status).toBe(200);
    expect((await orderBy(o.orderNo)).status).toBe('paid');
    expect(await stockMS()).toBe(24);
    await new Promise((r) => setTimeout(r, 0));
    expect(vi.mocked(notify.notifyOrderPaid)).toHaveBeenCalledTimes(1);
  });

  it('TC-WHK-012: internal error still returns 200', async () => {
    vi.mocked(mp.getPayment).mockRejectedValue(new Error('boom'));
    const res = await webhook('999');
    expect(res.status).toBe(200);
  });

  it('TC-WHK-012b: unknown external_reference is caught → 200', async () => {
    vi.mocked(mp.getPayment).mockResolvedValue({ id: 999, status: 'approved', externalReference: 'RF-000000' });
    const res = await webhook('999');
    expect(res.status).toBe(200);
  });
});

// ───────────────────────── C. Idempotency & replay ─────────────────────────
describe('C. Idempotency & replay', () => {
  it('TC-WHK-013: duplicate webhook decrements stock exactly once', async () => {
    const o = await pendingOrder(3);
    approves(o.orderNo, 7);
    await webhook('7');
    expect(await stockMS()).toBe(22);
    await webhook('7'); // replay
    expect(await stockMS()).toBe(22);
    expect((await orderBy(o.orderNo)).status).toBe('paid');
  });

  it('TC-WHK-014: replay does not send a second paid email', async () => {
    const o = await pendingOrder(1);
    approves(o.orderNo, 7);
    await webhook('7');
    await webhook('7');
    await new Promise((r) => setTimeout(r, 0));
    expect(vi.mocked(notify.notifyOrderPaid)).toHaveBeenCalledTimes(1);
  });

  it('TC-WHK-015: mpPaymentId persisted even when the paid transition fails (OutOfStock)', async () => {
    const o = await pendingOrder(1);
    await setStockMS(0); // stock drained before confirm
    vi.mocked(mp.getPayment).mockResolvedValue({ id: 555, status: 'approved', externalReference: o.orderNo });
    const res = await webhook('555');
    expect(res.status).toBe(200);
    const reread = await orderBy(o.orderNo);
    expect(reread.mpPaymentId).toBe('555'); // traceable even though fulfilment failed
    expect(reread.status).toBe('cancelled'); // confirmOrRefund refunded + cancelled
    expect(mp.refundPayment).toHaveBeenCalledWith('555');
  });

  it('TC-WHK-016: out-of-order refund before paid is a no-op', async () => {
    const o = await pendingOrder(1);
    vi.mocked(mp.getPayment).mockResolvedValue({ id: 9, status: 'refunded', externalReference: o.orderNo });
    const res = await webhook('9');
    expect(res.status).toBe(200);
    expect((await orderBy(o.orderNo)).status).toBe('pending');
    expect(await stockMS()).toBe(25);
  });
});

// ───────────────────────── D. Reversal & restock ─────────────────────────
describe('D. Reversal & restock', () => {
  async function paid(qty: number, id: number) {
    const o = await pendingOrder(qty);
    approves(o.orderNo, id);
    await webhook(String(id));
    return o;
  }

  it('TC-WHK-017: refunded on paid → restock + cancelled', async () => {
    const o = await paid(2, 1);
    expect(await stockMS()).toBe(23);
    vi.mocked(mp.getPayment).mockResolvedValue({ id: 1, status: 'refunded', externalReference: o.orderNo });
    await webhook('1');
    expect((await orderBy(o.orderNo)).status).toBe('cancelled');
    expect(await stockMS()).toBe(25);
  });

  it('TC-WHK-018: charged_back on paid → restock + cancelled', async () => {
    const o = await paid(2, 2);
    vi.mocked(mp.getPayment).mockResolvedValue({ id: 2, status: 'charged_back', externalReference: o.orderNo });
    await webhook('2');
    expect((await orderBy(o.orderNo)).status).toBe('cancelled');
    expect(await stockMS()).toBe(25);
  });

  it('TC-WHK-019: cancelled status on paid → restock + cancelled', async () => {
    const o = await paid(2, 3);
    vi.mocked(mp.getPayment).mockResolvedValue({ id: 3, status: 'cancelled', externalReference: o.orderNo });
    await webhook('3');
    expect((await orderBy(o.orderNo)).status).toBe('cancelled');
    expect(await stockMS()).toBe(25);
  });

  it('TC-WHK-020: reversal on an already-cancelled order is a no-op', async () => {
    const o = await paid(2, 4);
    vi.mocked(mp.getPayment).mockResolvedValue({ id: 4, status: 'refunded', externalReference: o.orderNo });
    await webhook('4'); // 23 → 25, cancelled
    expect(await stockMS()).toBe(25);
    await webhook('4'); // second refund — must not double-restock
    expect(await stockMS()).toBe(25);
    expect((await orderBy(o.orderNo)).status).toBe('cancelled');
  });
});

// ───────────────────────── E. Automatic lifecycle (card) ─────────────────────────
describe('E. Automatic status lifecycle', () => {
  const cardBody = (qty: number) => ({
    items: [{ productId: navyId, size: 'M', qty }], customer,
    token: 'tok', installments: 1, paymentMethodId: 'visa', payer: { email: 'ana@x.com' },
  });

  it('TC-WHK-021: created order starts pending, stock not held', async () => {
    const o = await pendingOrder(1);
    expect(o.status).toBe('pending');
    expect(await stockMS()).toBe(25);
  });

  it('TC-WHK-022: card rejected → cancelled, stock untouched', async () => {
    vi.mocked(mp.createCardPayment).mockResolvedValue({ id: 222, status: 'rejected', statusDetail: 'cc_rejected' });
    const res = await request(app).post('/api/payments/card').send(cardBody(1));
    expect(res.body.status).toBe('rejected');
    expect(await stockMS()).toBe(25);
    expect((await orderBy(res.body.orderNo)).status).toBe('cancelled');
  });

  it('TC-WHK-023: card approved but stock gone → MP refund + cancelled, client sees refunded', async () => {
    vi.mocked(mp.createCardPayment).mockImplementation(async () => {
      await setStockMS(0); // drained between quote and capture
      return { id: 333, status: 'approved', statusDetail: 'accredited' };
    });
    const res = await request(app).post('/api/payments/card').send(cardBody(1));
    expect(res.body.status).toBe('refunded');
    expect(mp.refundPayment).toHaveBeenCalledWith('333');
    expect((await orderBy(res.body.orderNo)).status).toBe('cancelled');
    expect(await stockMS()).toBe(0); // never oversold
    expect(vi.mocked(notify.notifyOrderPaid)).not.toHaveBeenCalled();
  });
});

// ───────────────────────── F. Admin status transitions ─────────────────────────
describe('F. Admin status transitions', () => {
  const patch = (id: string, status: string) =>
    request(app).patch(`/api/admin/orders/${id}/status`).set(authHeader()).send({ status });

  it('TC-WHK-024: pending → paid decrements + paid email + mpPaymentId=manual', async () => {
    const o = await pendingOrder(2, 'transfer');
    const res = await patch(o.id, 'paid');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
    expect(await stockMS()).toBe(23);
    expect((await orderBy(o.orderNo)).mpPaymentId).toBe('manual');
    await new Promise((r) => setTimeout(r, 0));
    expect(vi.mocked(notify.notifyOrderPaid)).toHaveBeenCalledTimes(1);
  });

  it('TC-WHK-025: pending → shipped also decrements stock', async () => {
    const o = await pendingOrder(2, 'transfer');
    const res = await patch(o.id, 'shipped');
    expect(res.body.status).toBe('shipped');
    expect(await stockMS()).toBe(23);
  });

  it('TC-WHK-026: paid → shipped does not change stock', async () => {
    const o = await pendingOrder(2, 'transfer');
    await patch(o.id, 'paid');
    expect(await stockMS()).toBe(23);
    const res = await patch(o.id, 'shipped');
    expect(res.body.status).toBe('shipped');
    expect(await stockMS()).toBe(23);
  });

  it('TC-WHK-027: paid → cancelled restocks', async () => {
    const o = await pendingOrder(2, 'transfer');
    await patch(o.id, 'paid');
    await patch(o.id, 'cancelled');
    expect(await stockMS()).toBe(25);
  });

  it('TC-WHK-028: paid → pending blocked (422), state & stock unchanged', async () => {
    const o = await pendingOrder(2, 'transfer');
    await patch(o.id, 'paid');
    const res = await patch(o.id, 'pending');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('No se puede revertir un pedido pagado a pendiente');
    expect((await orderBy(o.orderNo)).status).toBe('paid');
    expect(await stockMS()).toBe(23);
  });

  it('TC-WHK-029: cancelled → paid re-decrements stock', async () => {
    const o = await pendingOrder(2, 'transfer');
    await patch(o.id, 'paid'); // 25→23
    await patch(o.id, 'cancelled'); // →25
    const res = await patch(o.id, 'paid'); // →23 again
    expect(res.body.status).toBe('paid');
    expect(await stockMS()).toBe(23);
  });

  it('TC-WHK-030: same-status PATCH is a no-op (no decrement, no email)', async () => {
    const o = await pendingOrder(2, 'transfer');
    await patch(o.id, 'paid'); // 25→23, email #1
    vi.mocked(notify.notifyOrderPaid).mockClear();
    const res = await patch(o.id, 'paid');
    expect(res.status).toBe(200);
    expect(await stockMS()).toBe(23);
    await new Promise((r) => setTimeout(r, 0));
    expect(vi.mocked(notify.notifyOrderPaid)).not.toHaveBeenCalled();
  });

  it('TC-WHK-031: invalid status → 400; unknown order → 404', async () => {
    const o = await pendingOrder(1, 'transfer');
    const bad = await patch(o.id, 'done');
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('Estado inválido');
    const missing = await patch('does-not-exist', 'paid');
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('Orden no encontrada');
  });

  it('TC-WHK-032: order line with deleted product is skipped on mark-paid', async () => {
    const o = await pendingOrder(2, 'transfer');
    await prisma.orderItem.updateMany({ where: { orderId: o.id }, data: { productId: null } });
    const res = await patch(o.id, 'paid');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
    expect(await stockMS()).toBe(25); // null-product line skipped, no decrement
  });
});

// ───────────────────────── G. Order number & concurrency / oversell ─────────────────────────
describe('G. Order number & concurrency / oversell', () => {
  const patch = (id: string, status: string) =>
    request(app).patch(`/api/admin/orders/${id}/status`).set(authHeader()).send({ status });

  it('TC-WHK-033: orderNo matches /^RF-\\d{6}$/ and is unique', async () => {
    const nos: string[] = [];
    for (let i = 0; i < 8; i++) nos.push((await pendingOrder(1, 'transfer')).orderNo);
    for (const n of nos) expect(n).toMatch(/^RF-\d{6}$/);
    expect(new Set(nos).size).toBe(nos.length);
  });

  it('TC-WHK-034: oversell guard — admin mark-paid with stock<qty → 409, stock not negative', async () => {
    const o = await pendingOrder(2, 'transfer');
    await setStockMS(1);
    const res = await patch(o.id, 'paid');
    expect(res.status).toBe(409);
    expect(await stockMS()).toBe(1); // unchanged, never negative
    expect((await orderBy(o.orderNo)).status).toBe('pending');
  });

  it('TC-WHK-035: concurrent orders for the last unit — exactly one wins', async () => {
    await setStockMS(1);
    const a = await pendingOrder(1);
    const b = await pendingOrder(1);
    vi.mocked(mp.getPayment).mockImplementation(async (id: string) =>
      ({ id: Number(id), status: 'approved', externalReference: id === '100' ? a.orderNo : b.orderNo }));
    const [ra, rb] = await Promise.all([webhook('100'), webhook('101')]);
    expect(ra.status).toBe(200);
    expect(rb.status).toBe(200);
    expect(await stockMS()).toBe(0); // never below zero
    const statuses = [(await orderBy(a.orderNo)).status, (await orderBy(b.orderNo)).status].sort();
    expect(statuses).toEqual(['cancelled', 'paid']); // one paid, loser refunded+cancelled
  });

  it('TC-WHK-036: concurrent duplicate webhooks → single decrement', async () => {
    const o = await pendingOrder(1);
    approves(o.orderNo, 50);
    const [r1, r2] = await Promise.all([webhook('50'), webhook('50')]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(await stockMS()).toBe(24); // exactly one decrement
    expect((await orderBy(o.orderNo)).status).toBe('paid');
  });

  it('TC-WHK-037: stock to exactly zero, then next order rejected (409 QuoteError)', async () => {
    await setStockMS(1);
    const o = await pendingOrder(1, 'transfer');
    await patch(o.id, 'paid');
    expect(await stockMS()).toBe(0);
    // New card attempt for the same sold-out variant → 409 at quote
    vi.mocked(mp.createCardPayment).mockResolvedValue({ id: 9, status: 'approved', statusDetail: 'accredited' });
    const res = await request(app).post('/api/payments/card').send({
      items: [{ productId: navyId, size: 'M', qty: 1 }], customer,
      token: 'tok', installments: 1, paymentMethodId: 'visa', payer: { email: 'ana@x.com' },
    });
    expect(res.status).toBe(409);
    expect(mp.createCardPayment).not.toHaveBeenCalled();
  });
});
