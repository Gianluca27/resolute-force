import { beforeEach, describe, it, expect, vi } from 'vitest';
vi.mock('../src/services/notify.js', () => ({ notifyOrderPaid: vi.fn().mockResolvedValue(undefined), notifyTransferOrder: vi.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import { prisma } from '../src/prisma.js';
import { createOrder, markPaidByOrderNo } from '../src/services/orders.js';
import { getMetrics } from '../src/services/metrics.js';

const app = createApp();
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', dir: 'Calle 1', ciudad: 'CABA' };
beforeEach(async () => { await resetDb(); await seed(); });

it('tracks a visit and reports revenue/top products/conversion', async () => {
  await request(app).post('/api/track').send({ path: '/' });
  const navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
  const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'card' });
  await markPaidByOrderNo(order.orderNo, 'PAY-1');

  const res = await request(app).get('/api/admin/metrics').set(authHeader());
  expect(res.status).toBe(200);
  expect(res.body.revenue).toBe(60000);
  expect(res.body.unitsSold).toBe(2);
  expect(res.body.topProducts[0].label).toContain('Azul Marino');
  expect(res.body.revenueLast30).toHaveLength(30);
  expect(res.body.visits30).toBe(1);
  expect(res.body.conversionRate).toBeGreaterThan(0);
});

it('guards metrics behind auth', async () => {
  expect((await request(app).get('/api/admin/metrics')).status).toBe(401);
});

it('conversionRate counts only paid orders inside the 30-day visit window', async () => {
  const navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
  const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, method: 'card' });
  await markPaidByOrderNo(order.orderNo, 'OLD');
  // Backdate the only paid order to 60 days ago — it must fall outside the 30-day window.
  await prisma.order.update({ where: { orderNo: order.orderNo }, data: { createdAt: new Date(Date.now() - 60 * 86400000) } });
  await prisma.visit.create({ data: { path: '/' } });

  const m = await getMetrics();
  expect(m.visits30).toBe(1);
  expect(m.conversionRate).toBe(0); // all-time paid=1 would wrongly give 100
});

it('lowStock excludes variants of inactive products', async () => {
  const navy = await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } });
  await prisma.variant.updateMany({ where: { productId: navy.id, size: 'S' }, data: { stock: 1 } });
  await prisma.product.update({ where: { id: navy.id }, data: { active: false } });
  const m = await getMetrics();
  expect(m.lowStock.some((l) => l.line === navy.line && l.color === navy.color)).toBe(false);
});
