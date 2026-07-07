import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/mp.js', () => ({
  createCardPayment: vi.fn(),
  createPreference: vi.fn().mockResolvedValue({ id: 'PREF-1', initPoint: 'https://mp.test/redirect' }),
  getPayment: vi.fn(),
  refundPayment: vi.fn(),
}));

import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { prisma } from '../src/prisma.js';
import * as mp from '../src/lib/mp.js';

const app = createApp();
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', calle: 'Calle 1', altura: '100', cp: '1425', provincia: 'C', ciudad: 'CABA' };
let navyId = '';
beforeEach(async () => { await resetDb(); await seed(); vi.clearAllMocks(); navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id; });

describe('POST /api/payments/card', () => {
  it('approved → order paid + stock decremented', async () => {
    vi.mocked(mp.createCardPayment).mockResolvedValue({ id: 111, status: 'approved', statusDetail: 'accredited' });
    const res = await request(app).post('/api/payments/card').send({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, token: 'tok', installments: 3, paymentMethodId: 'visa', payer: { email: 'ana@x.com' } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    const v = await prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } });
    expect(v.stock).toBe(23);
  });

  it('rejected → order not paid, stock untouched', async () => {
    vi.mocked(mp.createCardPayment).mockResolvedValue({ id: 222, status: 'rejected', statusDetail: 'cc_rejected' });
    const res = await request(app).post('/api/payments/card').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, token: 'tok', installments: 1, paymentMethodId: 'visa', payer: { email: 'ana@x.com' } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    const v = await prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } });
    expect(v.stock).toBe(25);
  });

  it('out-of-stock at quote time → 409 and no charge attempted', async () => {
    await prisma.variant.updateMany({ where: { productId: navyId, size: 'M' }, data: { stock: 0 } });
    const res = await request(app).post('/api/payments/card').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, token: 'tok', installments: 1, paymentMethodId: 'visa', payer: { email: 'ana@x.com' } });
    expect(res.status).toBe(409);
    expect(mp.createCardPayment).not.toHaveBeenCalled();
  });

  it('approved at MP but stock lost mid-payment → refunds, cancels, never oversells', async () => {
    // Stock is available at quote time; a concurrent buyer drains it before MP returns approved.
    vi.mocked(mp.createCardPayment).mockImplementation(async () => {
      await prisma.variant.updateMany({ where: { productId: navyId, size: 'M' }, data: { stock: 0 } });
      return { id: 333, status: 'approved', statusDetail: 'accredited' };
    });
    vi.mocked(mp.refundPayment).mockResolvedValue(undefined);
    const res = await request(app).post('/api/payments/card').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, token: 'tok', installments: 1, paymentMethodId: 'visa', payer: { email: 'ana@x.com' } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('refunded');
    expect(mp.refundPayment).toHaveBeenCalledWith('333');
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNo: res.body.orderNo } });
    expect(order.status).toBe('cancelled');
    expect(order.mpPaymentId).toBe('333'); // charge stays recoverable/traceable
    const v = await prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } });
    expect(v.stock).toBe(0); // never decremented below zero
  });
});

describe('POST /api/payments/preference', () => {
  it('creates a pending wallet order and returns the preference id', async () => {
    const res = await request(app).post('/api/payments/preference').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer });
    expect(res.status).toBe(200);
    expect(res.body.preferenceId).toBe('PREF-1');
    expect(res.body.orderNo).toMatch(/^RF-/);
    expect(await prisma.order.count({ where: { status: 'pending', paymentMethod: 'wallet' } })).toBe(1);
  });
});

describe('POST /api/payments/webhook', () => {
  it('marks the referenced order paid', async () => {
    const { body } = await request(app).post('/api/payments/preference').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer });
    vi.mocked(mp.getPayment).mockResolvedValue({ id: 999, status: 'approved', externalReference: body.orderNo });
    const res = await request(app).post('/api/payments/webhook?type=payment&data.id=999').send({});
    expect(res.status).toBe(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNo: body.orderNo } });
    expect(order.status).toBe('paid');
  });
});

describe('POST /api/payments/webhook idempotency & non-approved', () => {
  it('is idempotent on duplicate approved deliveries (decrements stock once)', async () => {
    const { body } = await request(app).post('/api/payments/preference').send({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer });
    vi.mocked(mp.getPayment).mockResolvedValue({ id: 7, status: 'approved', externalReference: body.orderNo });
    await request(app).post('/api/payments/webhook?type=payment&data.id=7').send({});
    await request(app).post('/api/payments/webhook?type=payment&data.id=7').send({});
    expect((await prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } })).stock).toBe(23); // not 21
  });

  it('ignores a non-approved payment (order stays pending, stock untouched)', async () => {
    const { body } = await request(app).post('/api/payments/preference').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer });
    vi.mocked(mp.getPayment).mockResolvedValue({ id: 8, status: 'in_process', externalReference: body.orderNo });
    await request(app).post('/api/payments/webhook?type=payment&data.id=8').send({});
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNo: body.orderNo } })).status).toBe('pending');
    expect((await prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } })).stock).toBe(25);
  });
});

describe('POST /api/payments/webhook reversals', () => {
  it('restocks and cancels a paid order when MP later reports a refund', async () => {
    const { body } = await request(app).post('/api/payments/preference').send({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer });
    vi.mocked(mp.getPayment).mockResolvedValueOnce({ id: 1, status: 'approved', externalReference: body.orderNo });
    await request(app).post('/api/payments/webhook?type=payment&data.id=1').send({});
    expect((await prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } })).stock).toBe(23);

    vi.mocked(mp.getPayment).mockResolvedValueOnce({ id: 1, status: 'refunded', externalReference: body.orderNo });
    await request(app).post('/api/payments/webhook?type=payment&data.id=1').send({});
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNo: body.orderNo } });
    expect(order.status).toBe('cancelled');
    expect((await prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } })).stock).toBe(25); // restocked
  });
});

describe('POST /api/orders/transfer', () => {
  it('creates a pending transfer order with the discounted total', async () => {
    const res = await request(app).post('/api/orders/transfer').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(27000);
    expect(res.body.orderNo).toMatch(/^RF-/);
  });
});
