import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/adminApi', () => ({
  adminApi: {
    shippingStatus: vi.fn(), getShippingConfig: vi.fn(), putShippingConfig: vi.fn(),
    agencies: vi.fn(), shipments: vi.fn(), cancelShipment: vi.fn(),
    shipmentLabel: vi.fn(), shipmentTracking: vi.fn(),
  },
}));

import { adminApi } from '../../lib/adminApi';
import Shipping from './Shipping';

const shipment = {
  id: 's1', trackingNumber: 'TN-001', status: 'created', deliveryType: 'homeDelivery',
  serviceType: 'CP', createdAt: '2026-07-06T12:00:00Z',
  order: { id: 'o1', orderNo: 'RF-123456', customerName: 'Ana', status: 'paid' },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Shipping /></QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(adminApi.shippingStatus).mockReset().mockResolvedValue({ configured: true, valid: true });
  vi.mocked(adminApi.shipments).mockReset().mockResolvedValue([shipment]);
  vi.mocked(adminApi.getShippingConfig).mockReset().mockResolvedValue(null);
  vi.mocked(adminApi.agencies).mockReset().mockResolvedValue([]);
});

it('lists shipments with tracking number and order info', async () => {
  renderPage();
  expect(await screen.findByText('TN-001')).toBeInTheDocument();
  expect(screen.getByText(/RF-123456/)).toBeInTheDocument();
});

it('shows the credentials warning when PAQ.AR is not configured', async () => {
  vi.mocked(adminApi.shippingStatus).mockResolvedValue({ configured: false, valid: null });
  renderPage();
  expect(await screen.findByText(/PAQ\.AR no configurado/i)).toBeInTheDocument();
});

it('opens the tracking modal with the event history', async () => {
  vi.mocked(adminApi.shipmentTracking).mockResolvedValue({
    trackingNumber: 'TN-001', quantity: 1,
    event: [{ facility: 'CORREO ARGENTINO', statusId: 'PRE', status: 'PREIMPOSICION', date: '28-06-2026 11:53', sign: '' }],
  });
  renderPage();
  await screen.findByText('TN-001');
  fireEvent.click(screen.getByRole('button', { name: /tracking/i }));
  expect(await screen.findByText('PREIMPOSICION')).toBeInTheDocument();
});

it('saves the sender config from the Configuración tab', async () => {
  vi.mocked(adminApi.putShippingConfig).mockResolvedValue({});
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: /configuración/i }));
  fireEvent.change(await screen.findByLabelText('Nombre / Razón social'), { target: { value: 'Resolute Force' } });
  fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Av. Corrientes' } });
  fireEvent.change(screen.getByLabelText('Altura'), { target: { value: '1234' } });
  fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'CABA' } });
  fireEvent.change(screen.getByLabelText('Provincia'), { target: { value: 'C' } });
  fireEvent.change(screen.getByLabelText('Código postal'), { target: { value: 'C1043AAZ' } });
  fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
  await waitFor(() => expect(adminApi.putShippingConfig).toHaveBeenCalled());
  expect(vi.mocked(adminApi.putShippingConfig).mock.calls[0]![0]).toMatchObject({ senderName: 'Resolute Force', senderProvince: 'C' });
});

it('searches agencies by province from the Sucursales tab', async () => {
  vi.mocked(adminApi.agencies).mockResolvedValue([
    { agency_id: 'SCQ', agency_name: 'SAN GENARO', schedule: 'LUN A VIE 08.00 A 14.30', location: { street_name: 'JUAN LAZARTE', street_number: '1498', city_name: 'SAN GENARO', state_name: 'SANTA FE' } },
  ]);
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: /sucursales/i }));
  fireEvent.change(await screen.findByLabelText('Provincia'), { target: { value: 'S' } });
  fireEvent.click(screen.getByRole('button', { name: /buscar/i }));
  expect(await screen.findByText('SAN GENARO')).toBeInTheDocument();
  expect(adminApi.agencies).toHaveBeenCalledWith(expect.objectContaining({ stateId: 'S' }));
});
