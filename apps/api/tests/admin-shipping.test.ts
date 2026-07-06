import { beforeEach, describe, it, expect, vi } from 'vitest';

const paqarState = { enabled: true };
vi.mock('../src/lib/paqar.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/lib/paqar.js')>();
  return {
    ...mod,
    paqarEnabled: vi.fn(() => paqarState.enabled),
    validateAuth: vi.fn(),
    createShipmentOrder: vi.fn(),
    cancelShipmentOrder: vi.fn(),
    getLabels: vi.fn(),
    getTracking: vi.fn(),
    getAgencies: vi.fn(),
  };
});

import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import { prisma } from '../src/prisma.js';
import { createOrder } from '../src/services/orders.js';
import { validateAuth, createShipmentOrder, cancelShipmentOrder, getLabels, getTracking, getAgencies } from '../src/lib/paqar.js';

const app = createApp();
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', calle: 'Calle 1', altura: '100', cp: '1425', provincia: 'C', ciudad: 'CABA' };
const configBody = {
  senderName: 'Resolute Force', senderEmail: 'ventas@rf.com', senderPhone: '1155550000',
  senderStreet: 'Av. Corrientes', senderStreetNumber: '1234', senderFloor: '', senderApartment: '',
  senderCity: 'CABA', senderProvince: 'C', senderZip: 'C1043AAZ',
  defaultWeightGrams: 500, defaultHeightCm: 10, defaultWidthCm: 30, defaultDepthCm: 40,
  defaultServiceType: 'CP', labelFormat: '10x15',
};
const shipmentBody = {
  deliveryType: 'homeDelivery', weightGrams: 700, heightCm: 10, widthCm: 30, depthCm: 40,
  declaredValue: 54000, serviceType: 'CP',
  shipping: { street: 'Calle 1', streetNumber: '100', city: 'CABA', province: 'C', zip: '1425' },
};

let navyId = '';
beforeEach(async () => {
  paqarState.enabled = true;
  vi.mocked(createShipmentOrder).mockReset().mockResolvedValue({ trackingNumber: 'TN-001', raw: { trackingNumber: 'TN-001' } });
  vi.mocked(cancelShipmentOrder).mockReset().mockResolvedValue({ codigo: 200 });
  vi.mocked(validateAuth).mockReset().mockResolvedValue(true);
  await resetDb();
  await seed();
  navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
});

const mkOrder = async () => (await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' })).order;

describe('feature flag', () => {
  it('reports configured:false and blocks PAQ.AR calls with 503 when credentials are missing', async () => {
    paqarState.enabled = false;
    const status = await request(app).get('/api/admin/shipping/status').set(authHeader());
    expect(status.body).toEqual({ configured: false, valid: null });
    expect((await request(app).get('/api/admin/shipping/agencies').set(authHeader())).status).toBe(503);
    const order = await mkOrder();
    await request(app).put('/api/admin/shipping/config').set(authHeader()).send(configBody);
    expect((await request(app).post(`/api/admin/orders/${order.id}/shipment`).set(authHeader()).send(shipmentBody)).status).toBe(503);
  });

  it('reports valid credentials via /v1/auth', async () => {
    const r = await request(app).get('/api/admin/shipping/status').set(authHeader());
    expect(r.body).toEqual({ configured: true, valid: true });
  });
});

describe('config', () => {
  it('GET returns null before setup; PUT validates and round-trips', async () => {
    expect((await request(app).get('/api/admin/shipping/config').set(authHeader())).body).toBeNull();
    expect((await request(app).put('/api/admin/shipping/config').set(authHeader()).send({ ...configBody, senderProvince: 'I' })).status).toBe(400);
    const put = await request(app).put('/api/admin/shipping/config').set(authHeader()).send(configBody);
    expect(put.status).toBe(200);
    expect((await request(app).get('/api/admin/shipping/config').set(authHeader())).body.senderName).toBe('Resolute Force');
  });

  it('requires admin auth', async () => {
    expect((await request(app).get('/api/admin/shipping/config')).status).toBe(401);
    expect((await request(app).get('/api/admin/shipping/shipments')).status).toBe(401);
  });
});

describe('agencies', () => {
  it('proxies filters to the PAQ.AR client', async () => {
    vi.mocked(getAgencies).mockResolvedValueOnce([{ agency_id: 'SCQ' }]);
    const r = await request(app).get('/api/admin/shipping/agencies?stateId=S&pickupAvailability=true').set(authHeader());
    expect(r.status).toBe(200);
    expect(r.body).toEqual([{ agency_id: 'SCQ' }]);
    expect(vi.mocked(getAgencies)).toHaveBeenCalledWith({ stateId: 'S', pickupAvailability: true, packageReception: undefined });
  });
});

describe('shipment lifecycle over HTTP', () => {
  it('creates a shipment for an order and surfaces it in the admin orders DTO', async () => {
    await request(app).put('/api/admin/shipping/config').set(authHeader()).send(configBody);
    const order = await mkOrder();
    const r = await request(app).post(`/api/admin/orders/${order.id}/shipment`).set(authHeader()).send(shipmentBody);
    expect(r.status).toBe(201);
    expect(r.body.trackingNumber).toBe('TN-001');

    const list = await request(app).get('/api/admin/orders').set(authHeader());
    expect(list.body[0].shipment).toMatchObject({ trackingNumber: 'TN-001', status: 'created' });
    expect(list.body[0].shippingZip).toBe('1425');

    const dup = await request(app).post(`/api/admin/orders/${order.id}/shipment`).set(authHeader()).send(shipmentBody);
    expect(dup.status).toBe(409);
  });

  it('validates the shipment body (agencyId required outside homeDelivery)', async () => {
    await request(app).put('/api/admin/shipping/config').set(authHeader()).send(configBody);
    const order = await mkOrder();
    const bad = await request(app).post(`/api/admin/orders/${order.id}/shipment`).set(authHeader()).send({ ...shipmentBody, deliveryType: 'agency' });
    expect(bad.status).toBe(400);
    const ok = await request(app).post(`/api/admin/orders/${order.id}/shipment`).set(authHeader()).send({ ...shipmentBody, deliveryType: 'agency', agencyId: 'SCQ' });
    expect(ok.status).toBe(201);
  });

  it('400 without sender config, 404 for unknown order, 502 with the correo message on PAQ.AR errors', async () => {
    const order = await mkOrder();
    expect((await request(app).post(`/api/admin/orders/${order.id}/shipment`).set(authHeader()).send(shipmentBody)).status).toBe(400);
    await request(app).put('/api/admin/shipping/config').set(authHeader()).send(configBody);
    expect((await request(app).post('/api/admin/orders/nope/shipment').set(authHeader()).send(shipmentBody)).status).toBe(404);

    const { PaqarError } = await import('../src/lib/paqar.js');
    vi.mocked(createShipmentOrder).mockRejectedValueOnce(new PaqarError(400, 'tipoEntrega invalido'));
    const r = await request(app).post(`/api/admin/orders/${order.id}/shipment`).set(authHeader()).send(shipmentBody);
    expect(r.status).toBe(502);
    expect(r.body.error).toBe('tipoEntrega invalido');
  });

  it('cancels, fetches label and tracking, and lists shipments', async () => {
    await request(app).put('/api/admin/shipping/config').set(authHeader()).send(configBody);
    const order = await mkOrder();
    const created = await request(app).post(`/api/admin/orders/${order.id}/shipment`).set(authHeader()).send(shipmentBody);
    const sid = created.body.id as string;

    vi.mocked(getLabels).mockResolvedValueOnce([{ trackingNumber: 'TN-001', fileBase64: 'QUJD', fileName: 'a.pdf', result: 'OK' }]);
    const label = await request(app).get(`/api/admin/shipping/shipments/${sid}/label`).set(authHeader());
    expect(label.body).toEqual({ fileName: 'a.pdf', fileBase64: 'QUJD' });

    vi.mocked(getTracking).mockResolvedValueOnce([{ id: null, quantity: 1, countryId: null, serviceType: null, trackingNumber: 'TN-001', event: [{ facility: 'C', statusId: 'PRE', status: 'PREIMPOSICION', date: 'x', sign: '' }] }]);
    const tracking = await request(app).get(`/api/admin/shipping/shipments/${sid}/tracking`).set(authHeader());
    expect(tracking.body.event).toHaveLength(1);

    const list = await request(app).get('/api/admin/shipping/shipments').set(authHeader());
    expect(list.body).toHaveLength(1);
    expect(list.body[0].order.orderNo).toBe(order.orderNo);

    const cancel = await request(app).post(`/api/admin/shipping/shipments/${sid}/cancel`).set(authHeader());
    expect(cancel.body.status).toBe('cancelled');
    expect((await request(app).post(`/api/admin/shipping/shipments/${sid}/cancel`).set(authHeader())).status).toBe(422);
    expect((await request(app).get('/api/admin/shipping/shipments/nope/label').set(authHeader())).status).toBe(404);
  });
});
