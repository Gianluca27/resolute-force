import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/paqar.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/lib/paqar.js')>();
  return {
    ...mod,
    paqarEnabled: vi.fn(() => true),
    createShipmentOrder: vi.fn(),
    cancelShipmentOrder: vi.fn(),
    getLabels: vi.fn(),
    getTracking: vi.fn(),
  };
});

import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { prisma } from '../src/prisma.js';
import { createOrder } from '../src/services/orders.js';
import { createShipmentOrder, cancelShipmentOrder, getLabels, getTracking } from '../src/lib/paqar.js';
import {
  formatPaqarDate, buildPaqarOrder, updateShippingConfig, getShippingConfig,
  createShipmentForOrder, cancelShipment, getShipmentLabel, getShipmentTracking, listShipments,
  ShipmentExistsError, ConfigMissingError, InvalidShipmentStateError, LabelError,
  type ShipmentInput,
} from '../src/services/shipping.js';

const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', calle: 'Calle 1', altura: '100', pisoDepto: '3 B', cp: 'C1425ABC', provincia: 'C', ciudad: 'CABA' };
const configInput = {
  senderName: 'Resolute Force', senderEmail: 'ventas@rf.com', senderPhone: '1155550000',
  senderStreet: 'Av. Corrientes', senderStreetNumber: '1234', senderFloor: '', senderApartment: '',
  senderCity: 'CABA', senderProvince: 'C', senderZip: 'C1043AAZ',
  defaultWeightGrams: 500, defaultHeightCm: 10, defaultWidthCm: 30, defaultDepthCm: 40,
  defaultServiceType: 'CP', labelFormat: '10x15',
};
const shipmentInput: ShipmentInput = {
  deliveryType: 'homeDelivery', weightGrams: 700, heightCm: 10, widthCm: 30, depthCm: 40,
  declaredValue: 54000, serviceType: 'CP',
  shipping: { street: 'Calle 1', streetNumber: '100', floor: '3 B', city: 'CABA', province: 'C', zip: 'C1425ABC' },
};

let navyId = '';
beforeEach(async () => {
  vi.mocked(createShipmentOrder).mockReset().mockResolvedValue({ trackingNumber: 'TN-001', raw: { trackingNumber: 'TN-001' } });
  vi.mocked(cancelShipmentOrder).mockReset().mockResolvedValue({ codigo: 200 });
  await resetDb();
  await seed();
  navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
});

async function mkOrder() {
  return (await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' })).order;
}

describe('formatPaqarDate', () => {
  it('formats to Argentina local time with the fixed -03:00 offset', () => {
    expect(formatPaqarDate(new Date('2026-07-06T03:14:11Z'))).toBe('2026-07-06T00:14:11-03:00');
    expect(formatPaqarDate(new Date('2026-07-06T01:30:00Z'))).toBe('2026-07-05T22:30:00-03:00'); // cruza medianoche
  });
});

describe('shipping config', () => {
  it('returns null before the sender is configured, then round-trips', async () => {
    expect(await getShippingConfig()).toBeNull();
    await updateShippingConfig(configInput);
    const cfg = await getShippingConfig();
    expect(cfg?.senderName).toBe('Resolute Force');
    await updateShippingConfig({ ...configInput, senderName: 'RF SRL' });
    expect((await getShippingConfig())?.senderName).toBe('RF SRL');
  });
});

describe('buildPaqarOrder', () => {
  it('maps sender from config, recipient from input and parcel as strings', async () => {
    await updateShippingConfig(configInput);
    const order = await mkOrder();
    const cfg = (await getShippingConfig())!;
    const p = buildPaqarOrder(order, cfg, shipmentInput);
    expect(p.order.senderData.businessName).toBe('Resolute Force');
    expect(p.order.senderData.address.state).toBe('C');
    expect(p.order.shippingData.name).toBe('Ana');
    expect(p.order.shippingData.address).toEqual({
      streetName: 'Calle 1', streetNumber: '100', cityName: 'CABA', floor: '3 B', department: '', state: 'C', zipCode: 'C1425ABC',
    });
    expect(p.order.parcels).toEqual([{
      dimensions: { height: '10', width: '30', depth: '40' },
      productWeight: '700', productCategory: 'Indumentaria', declaredValue: '54000',
    }]);
    expect(p.order.deliveryType).toBe('homeDelivery');
    expect(p.order.agencyId).toBe('');
    expect(p.order.serviceType).toBe('CP');
    expect(p.order.shipmentClientId).toBe(order.orderNo);
    expect(p.order.saleDate).toBe(formatPaqarDate(order.createdAt));
  });
});

describe('createShipmentForOrder', () => {
  it('creates the PAQ.AR order, persists the shipment and updates the order address fields', async () => {
    await updateShippingConfig(configInput);
    const order = await mkOrder();
    const s = await createShipmentForOrder(order.id, { ...shipmentInput, shipping: { ...shipmentInput.shipping, street: 'Otra Calle' } });
    expect(s?.trackingNumber).toBe('TN-001');
    expect(s?.status).toBe('created');
    expect(vi.mocked(createShipmentOrder)).toHaveBeenCalledOnce();
    const reread = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(reread.shippingStreet).toBe('Otra Calle'); // el admin puede corregir la dirección al despachar
  });

  it('returns null for an unknown order and throws without sender config', async () => {
    expect(await createShipmentForOrder('nope', shipmentInput)).toBeNull();
    const order = await mkOrder();
    await expect(createShipmentForOrder(order.id, shipmentInput)).rejects.toBeInstanceOf(ConfigMissingError);
  });

  it('rejects a second shipment while one is active, but reuses the row after cancellation', async () => {
    await updateShippingConfig(configInput);
    const order = await mkOrder();
    const first = await createShipmentForOrder(order.id, shipmentInput);
    await expect(createShipmentForOrder(order.id, shipmentInput)).rejects.toBeInstanceOf(ShipmentExistsError);

    await cancelShipment(first!.id);
    vi.mocked(createShipmentOrder).mockResolvedValue({ trackingNumber: 'TN-002', raw: {} });
    const second = await createShipmentForOrder(order.id, shipmentInput);
    expect(second?.trackingNumber).toBe('TN-002');
    expect(second?.status).toBe('created');
    expect(await prisma.shipment.count()).toBe(1); // misma fila reutilizada
  });
});

describe('cancelShipment', () => {
  it('cancels an active shipment via PAQ.AR and rejects a second cancellation', async () => {
    await updateShippingConfig(configInput);
    const order = await mkOrder();
    const s = await createShipmentForOrder(order.id, shipmentInput);
    const cancelled = await cancelShipment(s!.id);
    expect(cancelled?.status).toBe('cancelled');
    expect(vi.mocked(cancelShipmentOrder)).toHaveBeenCalledWith('TN-001');
    await expect(cancelShipment(s!.id)).rejects.toBeInstanceOf(InvalidShipmentStateError);
    expect(await cancelShipment('nope')).toBeNull();
  });
});

describe('labels + tracking + listing', () => {
  it('returns the label base64 on OK and throws LabelError on ERROR results', async () => {
    await updateShippingConfig(configInput);
    const order = await mkOrder();
    const s = await createShipmentForOrder(order.id, shipmentInput);
    vi.mocked(getLabels).mockResolvedValueOnce([{ trackingNumber: 'TN-001', fileBase64: 'QUJD', fileName: 'a.pdf', result: 'OK' }]);
    const label = await getShipmentLabel(s!.id);
    expect(label).toEqual({ fileName: 'a.pdf', fileBase64: 'QUJD' });
    expect(vi.mocked(getLabels)).toHaveBeenCalledWith([{ sellerId: '', trackingNumber: 'TN-001' }], '10x15');

    vi.mocked(getLabels).mockResolvedValueOnce([{ trackingNumber: 'TN-001', fileBase64: '', fileName: '', result: 'ERROR: TN inexistente' }]);
    await expect(getShipmentLabel(s!.id)).rejects.toBeInstanceOf(LabelError);
  });

  it('returns tracking events for the shipment', async () => {
    await updateShippingConfig(configInput);
    const order = await mkOrder();
    const s = await createShipmentForOrder(order.id, shipmentInput);
    vi.mocked(getTracking).mockResolvedValueOnce([
      { id: null, quantity: 1, countryId: null, serviceType: null, trackingNumber: 'TN-001', event: [{ facility: 'CORREO', facilityCode: 'GCL', statusId: 'PRE', status: 'PREIMPOSICION', date: '2026-07-06 10:00', sign: '' }] },
    ]);
    const t = await getShipmentTracking(s!.id);
    expect(t?.trackingNumber).toBe('TN-001');
    expect(t?.event[0]!.statusId).toBe('PRE');
  });

  it('lists shipments with order summary, newest first', async () => {
    await updateShippingConfig(configInput);
    const order = await mkOrder();
    await createShipmentForOrder(order.id, shipmentInput);
    const list = await listShipments();
    expect(list).toHaveLength(1);
    expect(list[0]!.order.orderNo).toBe(order.orderNo);
    expect(list[0]!.order.customerName).toBe('Ana');
  });
});
