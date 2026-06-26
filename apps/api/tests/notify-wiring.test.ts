import { beforeEach, it, expect, vi } from 'vitest';

vi.mock('../src/services/notify.js', () => ({
  notifyOrderPaid: vi.fn().mockResolvedValue(undefined),
  notifyTransferOrder: vi.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { prisma } from '../src/prisma.js';
import { createOrder, markPaidByOrderNo } from '../src/services/orders.js';
import * as notify from '../src/services/notify.js';

const app = createApp();
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', dir: 'Calle 1', ciudad: 'CABA' };
let navyId = '';

beforeEach(async () => {
  await resetDb();
  await seed();
  vi.clearAllMocks();
  navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
});

it('markPaid notifies once on transition, not on the idempotent repeat', async () => {
  const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, method: 'card' });
  await markPaidByOrderNo(order.orderNo, 'PAY-1');
  await markPaidByOrderNo(order.orderNo, 'PAY-1');
  await new Promise((r) => setTimeout(r, 0));
  expect(vi.mocked(notify.notifyOrderPaid)).toHaveBeenCalledTimes(1);
});

it('transfer order creation notifies', async () => {
  await request(app).post('/api/orders/transfer').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer });
  await new Promise((r) => setTimeout(r, 0));
  expect(vi.mocked(notify.notifyTransferOrder)).toHaveBeenCalledOnce();
});
