import { beforeEach, describe, it, expect } from 'vitest';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { prisma } from '../src/prisma.js';
import { createOrder, markPaidByOrderNo } from '../src/services/orders.js';

const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', dir: 'Calle 1', ciudad: 'CABA' };
let navyId = '';
beforeEach(async () => {
  await resetDb();
  await seed();
  navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
});

describe('createOrder', () => {
  it('persists a pending order with server-priced items', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'card' });
    expect(order.status).toBe('pending');
    expect(order.total).toBe(60000);
    expect(order.items[0]!.unitPrice).toBe(30000);
    expect(order.orderNo).toMatch(/^RF-\d{6}$/);
  });

  it('applies the transfer discount to the order total', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, method: 'transfer' });
    expect(order.total).toBe(27000);
    expect(order.discount).toBe(3000);
  });
});

describe('markPaidByOrderNo', () => {
  it('marks paid and decrements stock once (idempotent)', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 3 }], customer, method: 'card' });
    await markPaidByOrderNo(order.orderNo, 'PAY-1');
    await markPaidByOrderNo(order.orderNo, 'PAY-1'); // second call must not double-decrement
    const v = await prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } });
    expect(v.stock).toBe(22); // 25 − 3
    const reread = await prisma.order.findUniqueOrThrow({ where: { orderNo: order.orderNo } });
    expect(reread.status).toBe('paid');
  });
});
