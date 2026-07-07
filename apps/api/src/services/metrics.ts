import type { Order, OrderItem } from '@prisma/client';
import { prisma } from '../prisma.js';

export const METRIC_RANGES = ['hoy', '7d', '30d', '90d', 'anio', 'todo'] as const;
export type MetricsRange = (typeof METRIC_RANGES)[number];
export function isMetricsRange(x: unknown): x is MetricsRange {
  return typeof x === 'string' && (METRIC_RANGES as readonly string[]).includes(x);
}

/** A headline number plus its previous-window value and relative change. prev/deltaPct are null
 *  when there is no comparable previous window (range=todo) or the previous value was zero. */
export interface Kpi {
  value: number;
  prev: number | null;
  deltaPct: number | null;
}

export interface Metrics {
  range: MetricsRange;
  // Headline KPIs (each carries a period-over-period delta)
  revenue: Kpi;
  orders: Kpi;
  paidOrders: Kpi;
  unitsSold: Kpi;
  avgOrderValue: Kpi;
  unitsPerOrder: Kpi;
  visits: Kpi;
  conversionRate: Kpi;
  pendingValue: Kpi;
  cancellationRate: Kpi;
  discountTotal: Kpi;
  // Breakdowns (current window)
  ordersByStatus: Record<string, number>;
  revenueByMethod: { method: string; revenue: number; orders: number }[];
  topProductsByRevenue: { label: string; revenue: number; qty: number }[];
  revenueByLine: { line: string; revenue: number; qty: number }[];
  sizeDistribution: { size: string; qty: number }[];
  newVsReturning: { newCustomers: number; returning: number; newRevenue: number; returningRevenue: number };
  topCustomers: { email: string; name: string; orders: number; spent: number }[];
  funnel: { visits: number; orders: number; paid: number; shipped: number };
  discountOrdersPct: number;
  shipping: { byType: { type: string; count: number }[]; cancelled: number; avgWeightGrams: number; avgDeclaredValue: number };
  topPages: { path: string; views: number }[];
  // Trend series
  revenueSeries: { date: string; total: number }[];
  visitsSeries: { date: string; count: number }[];
  // Tables
  lowStock: { line: string; color: string; size: string; stock: number }[];
  lowStockThreshold: number;
}

type OrderWithItems = Order & { items: OrderItem[] };

const PAID = ['paid', 'shipped'];
const SIZE_ORDER = ['S', 'M', 'L', 'XL'];
const DAY = 86400000;
// Business operates in Argentina (UTC-3, no DST). Bucket by AR-local date so "today" matches the
// business day, not the UTC day (which rolls 3h early).
const AR_OFFSET_MS = 3 * 3600000;
const shifted = (ms: number) => new Date(ms - AR_OFFSET_MS);
const localDate = (ms: number) => shifted(ms).toISOString().slice(0, 10);
const localMonth = (ms: number) => shifted(ms).toISOString().slice(0, 7);

const RANGE_DAYS: Record<Exclude<MetricsRange, 'todo'>, number> = { hoy: 1, '7d': 7, '30d': 30, '90d': 90, anio: 365 };

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (part: number, whole: number) => (whole ? round1((part / whole) * 100) : 0);
const rate100 = (part: number, whole: number) => (whole ? Math.min(100, round1((part / whole) * 100)) : 0);

function kpi(value: number, prev: number | null): Kpi {
  const deltaPct = prev === null || prev === 0 ? null : round1(((value - prev) / prev) * 100);
  return { value, prev, deltaPct };
}

interface Scalars {
  count: number;
  paidCount: number;
  shipped: number;
  cancelled: number;
  revenue: number;
  units: number;
  pendingValue: number;
  discountTotal: number;
}

function scalars(orders: OrderWithItems[]): Scalars {
  const paid = orders.filter((o) => PAID.includes(o.status));
  return {
    count: orders.length,
    paidCount: paid.length,
    shipped: orders.filter((o) => o.status === 'shipped').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    revenue: paid.reduce((a, o) => a + o.total, 0),
    units: paid.reduce((a, o) => a + o.items.reduce((s, i) => s + i.qty, 0), 0),
    pendingValue: orders.filter((o) => o.status === 'pending').reduce((a, o) => a + o.total, 0),
    discountTotal: paid.reduce((a, o) => a + o.discount, 0),
  };
}

/** count keys 'YYYY-MM' for the last `count` AR-local months, oldest first. */
function lastMonthKeys(nowMs: number, count: number): string[] {
  const d = shifted(nowMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    let yy = y;
    let mm = m - i;
    while (mm < 0) { mm += 12; yy--; }
    keys.push(`${yy}-${String(mm + 1).padStart(2, '0')}`);
  }
  return keys;
}

const monthStartMs = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return Date.UTC(y!, m! - 1, 1) + AR_OFFSET_MS;
};

/** How many AR-local months, capped at 24, from the earliest order to now (min 1). */
function monthsSpan(orders: OrderWithItems[], nowMs: number): number {
  if (!orders.length) return 1;
  const min = Math.min(...orders.map((o) => o.createdAt.getTime()));
  const a = shifted(min);
  const b = shifted(nowMs);
  const span = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + 1;
  return Math.min(24, Math.max(1, span));
}

export async function getMetrics(nowMs = Date.now(), range: MetricsRange = '30d'): Promise<Metrics> {
  const allOrders = (await prisma.order.findMany({ include: { items: true } })) as OrderWithItems[];

  const D = range === 'todo' ? null : RANGE_DAYS[range];
  const curStart = D === null ? -Infinity : nowMs - D * DAY;
  const prevStart = D === null ? null : nowMs - 2 * D * DAY;

  const cur = allOrders.filter((o) => { const t = o.createdAt.getTime(); return t >= curStart && t <= nowMs; });
  const prev = prevStart === null ? null : allOrders.filter((o) => { const t = o.createdAt.getTime(); return t >= prevStart && t < curStart; });

  const sc = scalars(cur);
  const sp = prev ? scalars(prev) : null;

  // Visit aggregates via SQL (the Visit table is unbounded — never load it whole).
  const curWhere = D === null ? {} : { createdAt: { gte: new Date(curStart) } };
  const prevWhere = prevStart === null ? null : { createdAt: { gte: new Date(prevStart), lt: new Date(curStart) } };
  const curVisits = await prisma.visit.count({ where: curWhere });
  const curHome = await prisma.visit.count({ where: { path: '/', ...curWhere } });
  const prevVisits = prevWhere ? await prisma.visit.count({ where: prevWhere }) : null;
  const prevHome = prevWhere ? await prisma.visit.count({ where: { path: '/', ...prevWhere } }) : null;

  const aov = (s: Scalars) => (s.paidCount ? Math.round(s.revenue / s.paidCount) : 0);
  const upo = (s: Scalars) => (s.paidCount ? round1(s.units / s.paidCount) : 0);

  const conversionRate = kpi(rate100(sc.paidCount, curHome), prevHome === null ? null : rate100(sp!.paidCount, prevHome));

  // Breakdowns over the current window's paid orders.
  const paidCur = cur.filter((o) => PAID.includes(o.status));
  const ordersByStatus = cur.reduce<Record<string, number>>((acc, o) => { acc[o.status] = (acc[o.status] ?? 0) + 1; return acc; }, {});

  const methodMap = new Map<string, { revenue: number; orders: number }>();
  for (const o of paidCur) { const m = methodMap.get(o.paymentMethod) ?? { revenue: 0, orders: 0 }; m.revenue += o.total; m.orders++; methodMap.set(o.paymentMethod, m); }
  const revenueByMethod = [...methodMap].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.revenue - a.revenue);

  const prodMap = new Map<string, { revenue: number; qty: number }>();
  const lineMap = new Map<string, { revenue: number; qty: number }>();
  const sizeMap = new Map<string, number>();
  for (const o of paidCur) for (const i of o.items) {
    const key = `${i.line} · ${i.color}`;
    const p = prodMap.get(key) ?? { revenue: 0, qty: 0 }; p.revenue += i.unitPrice * i.qty; p.qty += i.qty; prodMap.set(key, p);
    const l = lineMap.get(i.line) ?? { revenue: 0, qty: 0 }; l.revenue += i.unitPrice * i.qty; l.qty += i.qty; lineMap.set(i.line, l);
    sizeMap.set(i.size, (sizeMap.get(i.size) ?? 0) + i.qty);
  }
  const topProductsByRevenue = [...prodMap].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const revenueByLine = [...lineMap].map(([line, v]) => ({ line, ...v })).sort((a, b) => b.revenue - a.revenue);
  const sizeDistribution = [...sizeMap].map(([size, qty]) => ({ size, qty }))
    .sort((a, b) => (SIZE_ORDER.indexOf(a.size) + 1 || 99) - (SIZE_ORDER.indexOf(b.size) + 1 || 99));

  // New vs returning: a customer is "new" when their first-ever order falls inside the window.
  const firstSeen = new Map<string, number>();
  for (const o of allOrders) { const t = o.createdAt.getTime(); const s = firstSeen.get(o.customerEmail); if (s === undefined || t < s) firstSeen.set(o.customerEmail, t); }
  const revByEmail = new Map<string, number>();
  for (const o of paidCur) revByEmail.set(o.customerEmail, (revByEmail.get(o.customerEmail) ?? 0) + o.total);
  let newCustomers = 0, returning = 0, newRevenue = 0, returningRevenue = 0;
  for (const email of new Set(cur.map((o) => o.customerEmail))) {
    const rev = revByEmail.get(email) ?? 0;
    if ((firstSeen.get(email) ?? Infinity) >= curStart) { newCustomers++; newRevenue += rev; }
    else { returning++; returningRevenue += rev; }
  }

  const custMap = new Map<string, { name: string; orders: number; spent: number }>();
  for (const o of paidCur) { const c = custMap.get(o.customerEmail) ?? { name: o.customerName, orders: 0, spent: 0 }; c.orders++; c.spent += o.total; custMap.set(o.customerEmail, c); }
  const topCustomers = [...custMap].map(([email, v]) => ({ email, ...v })).sort((a, b) => b.spent - a.spent).slice(0, 8);

  const funnel = { visits: curVisits, orders: sc.count, paid: sc.paidCount, shipped: sc.shipped };
  const discountOrdersPct = pct(cur.filter((o) => o.discount > 0).length, sc.count);

  // Shipping (bounded by the window via createdAt).
  const shipments = await prisma.shipment.findMany({ where: curWhere });
  const typeMap = new Map<string, number>();
  let shCancelled = 0, wSum = 0, dvSum = 0;
  for (const s of shipments) { typeMap.set(s.deliveryType, (typeMap.get(s.deliveryType) ?? 0) + 1); if (s.status === 'cancelled') shCancelled++; wSum += s.weightGrams; dvSum += s.declaredValue; }
  const shipping = {
    byType: [...typeMap].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    cancelled: shCancelled,
    avgWeightGrams: shipments.length ? Math.round(wSum / shipments.length) : 0,
    avgDeclaredValue: shipments.length ? Math.round(dvSum / shipments.length) : 0,
  };

  const pageGroups = await prisma.visit.groupBy({ by: ['path'], where: curWhere, _count: { path: true }, orderBy: { _count: { path: 'desc' } }, take: 8 });
  const topPages = pageGroups.map((g) => ({ path: g.path, views: g._count.path }));

  // Trend series: daily for finite ranges, monthly for anio/todo.
  const monthly = range === 'anio' || range === 'todo';
  let keys: string[];
  let seriesStartMs: number;
  if (!monthly) {
    keys = [];
    for (let d = D! - 1; d >= 0; d--) keys.push(localDate(nowMs - d * DAY));
    seriesStartMs = nowMs - D! * DAY;
  } else {
    keys = lastMonthKeys(nowMs, range === 'anio' ? 12 : monthsSpan(allOrders, nowMs));
    seriesStartMs = monthStartMs(keys[0]!);
  }
  const bucketOf = monthly ? localMonth : localDate;

  const revByKey = new Map<string, number>();
  for (const o of allOrders) {
    if (!PAID.includes(o.status) || o.createdAt.getTime() < seriesStartMs) continue;
    const k = bucketOf(o.createdAt.getTime()); revByKey.set(k, (revByKey.get(k) ?? 0) + o.total);
  }
  const revenueSeries = keys.map((date) => ({ date, total: revByKey.get(date) ?? 0 }));

  const seriesVisits = await prisma.visit.findMany({ where: { createdAt: { gte: new Date(seriesStartMs) } }, select: { createdAt: true } });
  const visByKey = new Map<string, number>();
  for (const v of seriesVisits) { const k = bucketOf(v.createdAt.getTime()); visByKey.set(k, (visByKey.get(k) ?? 0) + 1); }
  const visitsSeries = keys.map((date) => ({ date, count: visByKey.get(date) ?? 0 }));

  // Low stock (range-independent) with a configurable threshold.
  const content = await prisma.siteContent.findFirst({ orderBy: { id: 'asc' } });
  const lowStockThreshold = content?.lowStockThreshold ?? 5;
  const variants = await prisma.variant.findMany({ where: { stock: { lte: lowStockThreshold }, product: { active: true } }, include: { product: true }, orderBy: { stock: 'asc' } });
  const lowStock = variants.map((v) => ({ line: v.product.line, color: v.product.color, size: v.size, stock: v.stock }));

  return {
    range,
    revenue: kpi(sc.revenue, sp ? sp.revenue : null),
    orders: kpi(sc.count, sp ? sp.count : null),
    paidOrders: kpi(sc.paidCount, sp ? sp.paidCount : null),
    unitsSold: kpi(sc.units, sp ? sp.units : null),
    avgOrderValue: kpi(aov(sc), sp ? aov(sp) : null),
    unitsPerOrder: kpi(upo(sc), sp ? upo(sp) : null),
    visits: kpi(curVisits, prevVisits),
    conversionRate,
    pendingValue: kpi(sc.pendingValue, sp ? sp.pendingValue : null),
    cancellationRate: kpi(pct(sc.cancelled, sc.count), sp ? pct(sp.cancelled, sp.count) : null),
    discountTotal: kpi(sc.discountTotal, sp ? sp.discountTotal : null),
    ordersByStatus,
    revenueByMethod,
    topProductsByRevenue,
    revenueByLine,
    sizeDistribution,
    newVsReturning: { newCustomers, returning, newRevenue, returningRevenue },
    topCustomers,
    funnel,
    discountOrdersPct,
    shipping,
    topPages,
    revenueSeries,
    visitsSeries,
    lowStock,
    lowStockThreshold,
  };
}
