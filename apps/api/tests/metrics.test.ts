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
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', calle: 'Calle 1', altura: '100', cp: '1425', provincia: 'Santa Fe', ciudad: 'Rosario' };
const DAY = 86400000;
beforeEach(async () => { await resetDb(); await seed(); });

async function productId(slug = 'champion-mentality-azul-marino') {
  return (await prisma.product.findUniqueOrThrow({ where: { slug } })).id;
}

/** Create a paid order and (optionally) back-date its creation. Returns the order. */
async function paidOrder(opts: { qty?: number; size?: string; method?: 'card' | 'transfer'; daysAgo?: number; email?: string; name?: string; slug?: string } = {}) {
  const pid = await productId(opts.slug);
  const cust = { ...customer, email: opts.email ?? customer.email, nombre: opts.name ?? customer.nombre };
  const { order } = await createOrder({ items: [{ productId: pid, size: opts.size ?? 'M', qty: opts.qty ?? 1 }], customer: cust, method: opts.method ?? 'card' });
  await markPaidByOrderNo(order.orderNo, `PAY-${order.orderNo}`);
  if (opts.daysAgo) await prisma.order.update({ where: { orderNo: order.orderNo }, data: { createdAt: new Date(Date.now() - opts.daysAgo * DAY) } });
  return prisma.order.findUniqueOrThrow({ where: { orderNo: order.orderNo } });
}

describe('metrics — auth & shape', () => {
  it('guards metrics behind auth', async () => {
    expect((await request(app).get('/api/admin/metrics')).status).toBe(401);
  });

  it('returns KPI objects with value/prev/deltaPct and echoes the range', async () => {
    await paidOrder({ qty: 2 });
    const res = await request(app).get('/api/admin/metrics?range=30d').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.range).toBe('30d');
    expect(res.body.revenue).toMatchObject({ value: 60000 });
    expect(res.body.revenue).toHaveProperty('prev');
    expect(res.body.revenue).toHaveProperty('deltaPct');
    expect(res.body.unitsSold.value).toBe(2);
  });

  it('defaults to a 30-day range when none is given', async () => {
    const res = await request(app).get('/api/admin/metrics').set(authHeader());
    expect(res.body.range).toBe('30d');
  });

  it('rejects an unknown range', async () => {
    expect((await request(app).get('/api/admin/metrics?range=bogus').set(authHeader())).status).toBe(400);
  });
});

describe('metrics — range windows & deltas', () => {
  it('scopes revenue to the selected window', async () => {
    await paidOrder({ qty: 1, daysAgo: 2 });   // inside 30d
    await paidOrder({ qty: 1, daysAgo: 45 });   // outside 30d, inside 90d
    const m30 = await getMetrics(Date.now(), '30d');
    const m90 = await getMetrics(Date.now(), '90d');
    expect(m30.revenue.value).toBe(30000);
    expect(m90.revenue.value).toBe(60000);
  });

  it('computes deltaPct vs the previous equal-length window', async () => {
    await paidOrder({ qty: 2, daysAgo: 3 });    // current 30d window: 60000
    await paidOrder({ qty: 1, daysAgo: 40 });   // previous 30d window: 30000
    const m = await getMetrics(Date.now(), '30d');
    expect(m.revenue.value).toBe(60000);
    expect(m.revenue.prev).toBe(30000);
    expect(m.revenue.deltaPct).toBe(100); // (60000-30000)/30000
  });

  it('has no previous window for range=todo (deltaPct null)', async () => {
    await paidOrder({ qty: 1, daysAgo: 400 });
    const m = await getMetrics(Date.now(), 'todo');
    expect(m.revenue.value).toBe(30000);
    expect(m.revenue.prev).toBeNull();
    expect(m.revenue.deltaPct).toBeNull();
  });
});

describe('metrics — revenue breakdowns', () => {
  it('splits revenue by payment method', async () => {
    await paidOrder({ method: 'card' });
    await paidOrder({ method: 'transfer', email: 'b@x.com' });
    const m = await getMetrics(Date.now(), '30d');
    const byMethod = Object.fromEntries(m.revenueByMethod.map((r) => [r.method, r.revenue]));
    expect(byMethod.card).toBeGreaterThan(0);
    expect(byMethod.transfer).toBeGreaterThan(0);
  });

  it('reports the total discount granted on paid orders', async () => {
    await paidOrder({ method: 'transfer' }); // 10% off 30000 = 3000
    const m = await getMetrics(Date.now(), '30d');
    expect(m.discountTotal.value).toBe(3000);
  });

  it('reports the value of pending orders in the window', async () => {
    const pid = await productId();
    await createOrder({ items: [{ productId: pid, size: 'M', qty: 1 }], customer, method: 'card' }); // stays pending
    const m = await getMetrics(Date.now(), '30d');
    expect(m.pendingValue.value).toBe(30000);
  });

  it('computes the cancellation rate over orders created in the window', async () => {
    await paidOrder();
    const pid = await productId();
    const { order } = await createOrder({ items: [{ productId: pid, size: 'L', qty: 1 }], customer, method: 'card' });
    await prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
    const m = await getMetrics(Date.now(), '30d');
    expect(m.cancellationRate.value).toBe(50); // 1 cancelled / 2 created
  });
});

describe('metrics — product depth', () => {
  it('ranks top products by revenue and includes qty', async () => {
    await paidOrder({ slug: 'champion-mentality-azul-marino', qty: 1 }); // 30000
    await paidOrder({ slug: 'champion-mentality-negro', qty: 3, email: 'c@x.com' }); // 90000
    const m = await getMetrics(Date.now(), '30d');
    expect(m.topProductsByRevenue[0]!.label).toContain('Negro');
    expect(m.topProductsByRevenue[0]!.revenue).toBe(90000);
    expect(m.topProductsByRevenue[0]!.qty).toBe(3);
  });

  it('aggregates size distribution across paid items', async () => {
    await paidOrder({ size: 'M', qty: 2 });
    await paidOrder({ size: 'L', qty: 1, email: 'd@x.com' });
    const m = await getMetrics(Date.now(), '30d');
    const bySize = Object.fromEntries(m.sizeDistribution.map((s) => [s.size, s.qty]));
    expect(bySize.M).toBe(2);
    expect(bySize.L).toBe(1);
  });
});

describe('metrics — customers', () => {
  it('classifies new vs returning by first-ever order date', async () => {
    // Ana: first order 50 days ago (before 30d window) + one inside → returning
    await paidOrder({ daysAgo: 50 });
    await paidOrder({ daysAgo: 1 });
    // Bea: first order ever, inside window → new
    await paidOrder({ daysAgo: 2, email: 'bea@x.com', name: 'Bea' });
    const m = await getMetrics(Date.now(), '30d');
    expect(m.newVsReturning.newCustomers).toBe(1);   // Bea
    expect(m.newVsReturning.returning).toBe(1);       // Ana
  });

  it('lists top customers by spend', async () => {
    await paidOrder({ qty: 3, email: 'big@x.com', name: 'Big' });   // 90000
    await paidOrder({ qty: 1, email: 'small@x.com', name: 'Small' }); // 30000
    const m = await getMetrics(Date.now(), '30d');
    expect(m.topCustomers[0]!.email).toBe('big@x.com');
    expect(m.topCustomers[0]!.spent).toBe(90000);
  });
});

describe('metrics — basket', () => {
  it('reports orders count and units per order', async () => {
    await paidOrder({ qty: 2 });
    await paidOrder({ qty: 4, email: 'e@x.com' });
    const m = await getMetrics(Date.now(), '30d');
    expect(m.orders.value).toBe(2);
    expect(m.unitsPerOrder.value).toBe(3); // (2+4)/2
  });
});

describe('metrics — traffic & funnel', () => {
  it('conversion uses home views as the denominator and clamps to 100', async () => {
    await paidOrder();
    await paidOrder({ email: 'f@x.com' });
    await prisma.visit.create({ data: { path: '/' } }); // 1 home view, 2 paid → clamp
    const m = await getMetrics(Date.now(), '30d');
    expect(m.conversionRate.value).toBe(100);
  });

  it('ignores non-home pageviews in the conversion denominator', async () => {
    await paidOrder();
    await prisma.visit.create({ data: { path: '/' } });
    await prisma.visit.create({ data: { path: '/producto/champion-mentality-negro' } });
    const m = await getMetrics(Date.now(), '30d');
    expect(m.conversionRate.value).toBe(100); // 1 paid / 1 home view (product view excluded)
  });

  it('builds the visits→orders→paid→shipped funnel', async () => {
    await paidOrder();
    const pid = await productId();
    await createOrder({ items: [{ productId: pid, size: 'M', qty: 1 }], customer, method: 'card' }); // pending
    await prisma.visit.create({ data: { path: '/' } });
    await prisma.visit.create({ data: { path: '/producto/x' } });
    const m = await getMetrics(Date.now(), '30d');
    expect(m.funnel.visits).toBe(2);
    expect(m.funnel.orders).toBe(2);
    expect(m.funnel.paid).toBe(1);
  });

  it('ranks most-viewed pages', async () => {
    await prisma.visit.create({ data: { path: '/producto/a' } });
    await prisma.visit.create({ data: { path: '/producto/a' } });
    await prisma.visit.create({ data: { path: '/' } });
    const m = await getMetrics(Date.now(), '30d');
    expect(m.topPages[0]).toMatchObject({ path: '/producto/a', views: 2 });
  });
});

describe('metrics — shipping', () => {
  it('breaks down shipments by delivery type and counts cancelled', async () => {
    const o1 = await paidOrder();
    const o2 = await paidOrder({ email: 'g@x.com' });
    const base = { serviceType: 'CP', weightGrams: 500, heightCm: 10, widthCm: 30, depthCm: 40, declaredValue: 30000 };
    await prisma.shipment.create({ data: { orderId: o1.id, trackingNumber: 'TN-1', deliveryType: 'homeDelivery', status: 'created', ...base } });
    await prisma.shipment.create({ data: { orderId: o2.id, trackingNumber: 'TN-2', deliveryType: 'agency', status: 'cancelled', ...base } });
    const m = await getMetrics(Date.now(), '30d');
    const byType = Object.fromEntries(m.shipping.byType.map((t) => [t.type, t.count]));
    expect(byType.homeDelivery).toBe(1);
    expect(m.shipping.cancelled).toBe(1);
    expect(m.shipping.avgWeightGrams).toBe(500);
  });
});

describe('metrics — series', () => {
  it('returns one daily point per day of a finite window', async () => {
    const m = await getMetrics(Date.now(), '30d');
    expect(m.revenueSeries).toHaveLength(30);
    expect(m.visitsSeries).toHaveLength(30);
  });

  it('buckets by month for range=anio (12 points)', async () => {
    const m = await getMetrics(Date.now(), 'anio');
    expect(m.revenueSeries).toHaveLength(12);
  });
});

describe('metrics — low stock', () => {
  it('excludes variants of inactive products and reports the threshold', async () => {
    const navy = await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } });
    await prisma.variant.updateMany({ where: { productId: navy.id, size: 'S' }, data: { stock: 1 } });
    await prisma.product.update({ where: { id: navy.id }, data: { active: false } });
    const m = await getMetrics(Date.now(), '30d');
    expect(m.lowStock.some((l) => l.line === navy.line && l.color === navy.color)).toBe(false);
    expect(m.lowStockThreshold).toBe(5); // seed default
  });

  it('honours a configurable low-stock threshold', async () => {
    await prisma.siteContent.updateMany({ data: { lowStockThreshold: 10 } });
    const negro = await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-negro' } });
    await prisma.variant.updateMany({ where: { productId: negro.id, size: 'M' }, data: { stock: 8 } }); // >5, <=10
    const m = await getMetrics(Date.now(), '30d');
    expect(m.lowStockThreshold).toBe(10);
    expect(m.lowStock.some((l) => l.line === negro.line && l.size === 'M')).toBe(true);
  });
});
