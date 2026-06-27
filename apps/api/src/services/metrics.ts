import { prisma } from '../prisma.js';

export interface Metrics {
  revenue: number;
  ordersByStatus: Record<string, number>;
  unitsSold: number;
  avgOrderValue: number;
  topProducts: { label: string; qty: number }[];
  revenueLast30: { date: string; total: number }[];
  lowStock: { line: string; color: string; size: string; stock: number }[];
  visits30: number;
  conversionRate: number;
}

const PAID = ['paid', 'shipped'];

export async function getMetrics(nowMs = Date.now()): Promise<Metrics> {
  const orders = await prisma.order.findMany({ include: { items: true } });
  const paid = orders.filter((o) => PAID.includes(o.status));

  const revenue = paid.reduce((a, o) => a + o.total, 0);
  const ordersByStatus = orders.reduce<Record<string, number>>((acc, o) => { acc[o.status] = (acc[o.status] ?? 0) + 1; return acc; }, {});
  const unitsSold = paid.reduce((a, o) => a + o.items.reduce((s, i) => s + i.qty, 0), 0);
  const avgOrderValue = paid.length ? Math.round(revenue / paid.length) : 0;

  const byProduct = new Map<string, number>();
  for (const o of paid) for (const i of o.items) byProduct.set(`${i.line} · ${i.color}`, (byProduct.get(`${i.line} · ${i.color}`) ?? 0) + i.qty);
  const topProducts = [...byProduct.entries()].map(([label, qty]) => ({ label, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);

  const dayMs = 86400000;
  const revenueLast30: { date: string; total: number }[] = [];
  for (let d = 29; d >= 0; d--) {
    const start = nowMs - d * dayMs;
    const date = new Date(start).toISOString().slice(0, 10);
    const total = paid.filter((o) => o.createdAt.toISOString().slice(0, 10) === date).reduce((a, o) => a + o.total, 0);
    revenueLast30.push({ date, total });
  }

  const variants = await prisma.variant.findMany({ where: { stock: { lte: 5 } }, include: { product: true } });
  const lowStock = variants.map((v) => ({ line: v.product.line, color: v.product.color, size: v.size, stock: v.stock }));

  const visits30 = await prisma.visit.count({ where: { createdAt: { gte: new Date(nowMs - 30 * dayMs) } } });
  const conversionRate = visits30 ? Math.round((paid.length / visits30) * 1000) / 10 : 0;

  return { revenue, ordersByStatus, unitsSold, avgOrderValue, topProducts, revenueLast30, lowStock, visits30, conversionRate };
}
