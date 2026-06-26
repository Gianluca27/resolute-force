import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/mp.js', () => ({
  createCardPayment: vi.fn(),
  createPreference: vi.fn().mockResolvedValue({ id: 'PREF-1', initPoint: 'https://mp.test/redirect' }),
  getPayment: vi.fn(),
}));

import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { prisma } from '../src/prisma.js';
import * as mp from '../src/lib/mp.js';

const app = createApp();
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', dir: 'Calle 1', ciudad: 'CABA' };
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

describe('POST /api/orders/transfer', () => {
  it('creates a pending transfer order with the discounted total', async () => {
    const res = await request(app).post('/api/orders/transfer').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(27000);
    expect(res.body.orderNo).toMatch(/^RF-/);
  });
});
