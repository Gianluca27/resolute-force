import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/adminApi', () => ({
  adminApi: {
    orders: vi.fn(), setOrderStatus: vi.fn(), createShipment: vi.fn(),
    getShippingConfig: vi.fn(), agencies: vi.fn(),
  },
}));

import { adminApi } from '../../lib/adminApi';
import Orders from './Orders';

const paidOrder = {
  id: 'o1', orderNo: 'RF-123456', customerName: 'Ana', customerEmail: 'ana@x.com', customerPhone: '11',
  address: 'Calle 1 100', city: 'CABA', paymentMethod: 'transfer', total: 54000, status: 'paid',
  shippingStreet: 'Calle 1', shippingStreetNumber: '100', shippingFloor: null, shippingApartment: null,
  shippingZip: 'C1425ABC', shippingProvince: 'C', shipment: null,
  items: [{ line: 'Champion Mentality', color: 'Azul Marino', size: 'M', qty: 2 }],
};

function renderOrders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Orders /></QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(adminApi.orders).mockReset().mockResolvedValue([paidOrder]);
  vi.mocked(adminApi.createShipment).mockReset().mockResolvedValue({ id: 's1', trackingNumber: 'TN-001', status: 'created' });
  vi.mocked(adminApi.getShippingConfig).mockReset().mockResolvedValue({
    senderName: 'RF', senderStreet: 'Av. Corrientes', senderStreetNumber: '1234', senderCity: 'CABA', senderProvince: 'C', senderZip: 'C1043AAZ',
    senderEmail: '', senderPhone: '', senderFloor: '', senderApartment: '',
    defaultWeightGrams: 500, defaultHeightCm: 10, defaultWidthCm: 30, defaultDepthCm: 40, defaultServiceType: 'CP', labelFormat: '10x15',
  });
  vi.mocked(adminApi.agencies).mockReset().mockResolvedValue([]);
});

it('opens the shipment modal prefilled from the order and creates the shipment', async () => {
  renderOrders();
  fireEvent.click(await screen.findByRole('button', { name: /generar envío/i }));
  // Prefill: dirección estructurada del pedido + defaults de config.
  expect(await screen.findByLabelText('Calle')).toHaveValue('Calle 1');
  expect(screen.getByLabelText('Altura')).toHaveValue('100');
  expect(screen.getByLabelText('Código postal')).toHaveValue('C1425ABC');
  // Los defaults del paquete llegan con la query de config (async).
  await waitFor(() => expect(screen.getByLabelText('Peso (g)')).toHaveValue(500));
  expect(screen.getByLabelText('Valor declarado')).toHaveValue(54000);
  fireEvent.click(screen.getByRole('button', { name: /confirmar envío/i }));
  await waitFor(() => expect(adminApi.createShipment).toHaveBeenCalled());
  const [orderId, body] = vi.mocked(adminApi.createShipment).mock.calls[0]!;
  expect(orderId).toBe('o1');
  expect(body).toMatchObject({
    deliveryType: 'homeDelivery', weightGrams: 500, declaredValue: 54000, serviceType: 'CP',
    shipping: { street: 'Calle 1', streetNumber: '100', zip: 'C1425ABC', province: 'C', city: 'CABA' },
  });
});

it('shows the tracking number instead of the button when the order already has a shipment', async () => {
  vi.mocked(adminApi.orders).mockResolvedValue([{ ...paidOrder, shipment: { id: 's1', trackingNumber: 'TN-001', status: 'created' } }]);
  renderOrders();
  expect(await screen.findByText(/TN-001/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /generar envío/i })).not.toBeInTheDocument();
});

it('hides the shipment button for pending orders', async () => {
  vi.mocked(adminApi.orders).mockResolvedValue([{ ...paidOrder, status: 'pending' }]);
  renderOrders();
  await screen.findByText(/RF-123456/);
  expect(screen.queryByRole('button', { name: /generar envío/i })).not.toBeInTheDocument();
});
