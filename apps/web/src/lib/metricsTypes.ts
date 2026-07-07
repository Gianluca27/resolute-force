// Mirrors the backend Metrics contract (apps/api/src/services/metrics.ts). Kept in sync by hand —
// the two apps don't share a runtime type, so a change there must be reflected here.
export const METRIC_RANGES = ['hoy', '7d', '30d', '90d', 'anio', 'todo'] as const;
export type MetricsRange = (typeof METRIC_RANGES)[number];

export const RANGE_LABELS: Record<MetricsRange, string> = {
  hoy: 'Hoy', '7d': '7 días', '30d': '30 días', '90d': '90 días', anio: 'Año', todo: 'Todo',
};

export interface Kpi {
  value: number;
  prev: number | null;
  deltaPct: number | null;
}

export interface MetricsDTO {
  range: MetricsRange;
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
  revenueSeries: { date: string; total: number }[];
  visitsSeries: { date: string; count: number }[];
  lowStock: { line: string; color: string; size: string; stock: number }[];
  lowStockThreshold: number;
}
