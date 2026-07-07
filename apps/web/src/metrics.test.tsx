import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./lib/adminApi', () => ({ adminApi: { metrics: vi.fn() } }));

import { adminApi } from './lib/adminApi';
import Metrics from './pages/admin/Metrics';
import type { MetricsDTO } from './lib/metricsTypes';

const kpi = (value: number, prev: number | null = null, deltaPct: number | null = null) => ({ value, prev, deltaPct });

function mkMetrics(over: Partial<MetricsDTO> = {}): MetricsDTO {
  return {
    range: '30d',
    revenue: kpi(61234, 30000, 100),
    orders: kpi(4, 2, 90),
    paidOrders: kpi(3, 2, 50),
    unitsSold: kpi(8, 5, 60),
    avgOrderValue: kpi(20000, 15000, 33.3),
    unitsPerOrder: kpi(2.7, 2.5, 8),
    visits: kpi(120, 100, 20),
    conversionRate: kpi(2.5, 2, 25),
    pendingValue: kpi(30000, 0, null),
    cancellationRate: kpi(10, 20, -50),
    discountTotal: kpi(3000, 1000, 200),
    ordersByStatus: { pending: 1, paid: 2, shipped: 1 },
    revenueByMethod: [{ method: 'card', revenue: 40000, orders: 2 }, { method: 'transfer', revenue: 20000, orders: 1 }],
    topProductsByRevenue: [{ label: 'Champion Mentality · Negro', revenue: 90000, qty: 3 }],
    revenueByLine: [{ line: 'Champion Mentality', revenue: 60000, qty: 8 }],
    sizeDistribution: [{ size: 'M', qty: 5 }, { size: 'L', qty: 3 }],
    newVsReturning: { newCustomers: 2, returning: 1, newRevenue: 40000, returningRevenue: 20000 },
    topCustomers: [{ email: 'big@x.com', name: 'Big', orders: 2, spent: 60000 }],
    funnel: { visits: 120, orders: 4, paid: 3, shipped: 1 },
    discountOrdersPct: 25,
    shipping: { byType: [{ type: 'homeDelivery', count: 2 }], cancelled: 1, avgWeightGrams: 500, avgDeclaredValue: 30000 },
    topPages: [{ path: '/', views: 100 }],
    revenueSeries: Array.from({ length: 30 }, (_, i) => ({ date: `2026-06-${String(i + 1).padStart(2, '0')}`, total: i * 1000 })),
    visitsSeries: Array.from({ length: 30 }, (_, i) => ({ date: `2026-06-${String(i + 1).padStart(2, '0')}`, count: i })),
    lowStock: [{ line: 'Champion Mentality', color: 'Negro', size: 'M', stock: 3 }],
    lowStockThreshold: 5,
    ...over,
  };
}

function renderMetrics() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Metrics /></QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(adminApi.metrics).mockReset();
  vi.mocked(adminApi.metrics).mockResolvedValue(mkMetrics());
});

describe('Metrics — dashboard', () => {
  it('renders the heading and headline revenue', async () => {
    renderMetrics();
    expect(screen.getByRole('heading', { name: /Métricas/i })).toBeInTheDocument();
    expect(await screen.findByText('$61.234')).toBeInTheDocument();
  });

  it('defaults to the 30-day range on first load', async () => {
    renderMetrics();
    await screen.findByText('$61.234');
    expect(adminApi.metrics).toHaveBeenCalledWith('30d');
  });

  it('refetches with the chosen range when a range button is clicked', async () => {
    renderMetrics();
    await screen.findByText('$61.234');
    fireEvent.click(screen.getByRole('button', { name: '7 días' }));
    await waitFor(() => expect(adminApi.metrics).toHaveBeenCalledWith('7d'));
  });

  it('shows the period-over-period delta on a KPI', async () => {
    renderMetrics();
    await screen.findByText('$61.234');
    expect(screen.getByText(/100%/)).toBeInTheDocument(); // revenue deltaPct
  });

  it('lists a top product with its revenue', async () => {
    renderMetrics();
    expect(await screen.findByText('Champion Mentality · Negro')).toBeInTheDocument();
  });
});
