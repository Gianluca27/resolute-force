// QA Módulo 10 — Admin orders, capa web (docs/qa/10-admin-orders.md).
// Cubre la card de Orders.tsx (TC-ORD-001..004), el total con descuento (TC-ORD-019),
// el fallo silencioso de PATCH (TC-ORD-020 / CD-19), la a11y del <select> (TC-ORD-023) y
// el render de listas grandes (TC-ORD-022). Mockea adminApi → render fiel del componente.
// Archivo de corrida QA, no set permanente.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./lib/adminApi', () => ({
  adminApi: { orders: vi.fn(), setOrderStatus: vi.fn() },
}));

import { adminApi } from './lib/adminApi';
import Orders from './pages/admin/Orders';

const mkOrder = (over: Partial<any> = {}) => ({
  id: 'o1',
  orderNo: 'RF-123456',
  customerName: 'Ana Gómez',
  customerEmail: 'ana@x.com',
  customerPhone: '3415550000',
  address: 'Calle 1',
  city: 'Rosario',
  paymentMethod: 'transfer',
  total: 27000,
  subtotal: 30000,
  discount: 3000,
  status: 'pending',
  items: [{ line: 'Champion Mentality', color: 'Azul Marino', size: 'M', qty: 2 }],
  ...over,
});

function renderOrders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Orders />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(adminApi.orders).mockReset();
  vi.mocked(adminApi.setOrderStatus).mockReset();
});

describe('Orders — render de card', () => {
  it('TC-ORD-001/002: renderiza heading y todos los campos de la card', async () => {
    vi.mocked(adminApi.orders).mockResolvedValue([mkOrder()]);
    renderOrders();
    expect(screen.getByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
    await screen.findByText(/RF-123456/);
    expect(screen.getByText('RF-123456 · Ana Gómez')).toBeInTheDocument();
    expect(screen.getByText('$27.000')).toBeInTheDocument(); // money(total)
    expect(screen.getByText('ana@x.com · 3415550000 · Calle 1, Rosario · transfer')).toBeInTheDocument();
    expect(screen.getByText('Champion Mentality Azul Marino M x2')).toBeInTheDocument();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('pending');
  });

  it('TC-ORD-003: teléfono null → muestra "—"', async () => {
    vi.mocked(adminApi.orders).mockResolvedValue([mkOrder({ customerPhone: null })]);
    renderOrders();
    await screen.findByText(/RF-123456/);
    expect(screen.getByText('ana@x.com · — · Calle 1, Rosario · transfer')).toBeInTheDocument();
  });

  it('TC-ORD-004: lista vacía → heading sin cards ni crash', async () => {
    vi.mocked(adminApi.orders).mockResolvedValue([]);
    renderOrders();
    expect(screen.getByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  });

  it('TC-ORD-019: total transfer muestra el descuento; card no muestra subtotal/discount', async () => {
    vi.mocked(adminApi.orders).mockResolvedValue([
      mkOrder({ id: 't', orderNo: 'RF-111111', paymentMethod: 'transfer', subtotal: 30000, discount: 3000, total: 27000 }),
      mkOrder({ id: 'c', orderNo: 'RF-222222', paymentMethod: 'card', subtotal: 30000, discount: 0, total: 30000 }),
    ]);
    renderOrders();
    await screen.findByText(/RF-111111/);
    expect(screen.getByText('$27.000')).toBeInTheDocument(); // transfer descontado
    expect(screen.getByText('$30.000')).toBeInTheDocument(); // card full
    expect(screen.queryByText('$3.000')).not.toBeInTheDocument(); // discount no se renderiza
  });
});

describe('Orders — mutación de estado', () => {
  it('TC-ORD-020 (CD-19): un PATCH fallido (422/409) NO surface error y el select revierte', async () => {
    vi.mocked(adminApi.orders).mockResolvedValue([mkOrder({ status: 'paid' })]);
    vi.mocked(adminApi.setOrderStatus).mockRejectedValue(new Error('No se puede revertir un pedido pagado a pendiente'));
    renderOrders();
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement;
    expect(select.value).toBe('paid');

    fireEvent.change(select, { target: { value: 'pending' } });
    // mutate() agenda la mutationFn → esperamos a que dispare el PATCH.
    await waitFor(() => expect(adminApi.setOrderStatus).toHaveBeenCalledWith('o1', 'pending'));

    // El error existe pero NO se muestra: sin onError/toast, y el <select> controlado vuelve a 'paid'.
    expect(select.value).toBe('paid'); // snap-back silencioso
    expect(screen.queryByText(/revertir|stock|error/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('TC-ORD: cambio exitoso invoca setOrderStatus con el nuevo valor', async () => {
    vi.mocked(adminApi.orders).mockResolvedValue([mkOrder({ status: 'pending' })]);
    vi.mocked(adminApi.setOrderStatus).mockResolvedValue(mkOrder({ status: 'paid' }));
    renderOrders();
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'paid' } });
    await waitFor(() => expect(adminApi.setOrderStatus).toHaveBeenCalledWith('o1', 'paid'));
  });
});

describe('Orders — a11y & perf', () => {
  it('TC-ORD-023: el <select> no tiene label/aria-label (gap a11y) y las opciones están en inglés crudo', async () => {
    vi.mocked(adminApi.orders).mockResolvedValue([mkOrder()]);
    renderOrders();
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement;
    // Gap confirmado: sin nombre accesible (ni <label> ni aria-label) → el lector no sabe a qué orden pertenece.
    expect(select).toHaveAccessibleName('');
    // Opciones = enum inglés crudo (inconsistencia i18n con el resto en es-AR).
    const opts = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(opts).toEqual(['pending', 'paid', 'shipped', 'cancelled']);
  });

  it('TC-ORD-022: lista grande (500 órdenes) renderiza sin paginación', async () => {
    const big = Array.from({ length: 500 }, (_, i) =>
      mkOrder({ id: `o${i}`, orderNo: `RF-${String(100000 + i)}` }),
    );
    vi.mocked(adminApi.orders).mockResolvedValue(big);
    renderOrders();
    await screen.findByText(/RF-100000/);
    expect(screen.getAllByRole('combobox')).toHaveLength(500); // todas, sin paginar
  });
});
