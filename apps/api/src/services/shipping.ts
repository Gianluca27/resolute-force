import type { Order, Shipment, ShippingConfig } from '@prisma/client';
import { prisma } from '../prisma.js';
import {
  createShipmentOrder, cancelShipmentOrder, getLabels, getTracking,
  type PaqarOrderPayload, type PaqarTrackingEntry,
} from '../lib/paqar.js';

export class ShipmentExistsError extends Error {
  constructor() { super('El pedido ya tiene un envío activo'); this.name = 'ShipmentExistsError'; }
}
export class ConfigMissingError extends Error {
  constructor() { super('Configurá los datos del remitente antes de generar envíos'); this.name = 'ConfigMissingError'; }
}
export class InvalidShipmentStateError extends Error {
  constructor(msg: string) { super(msg); this.name = 'InvalidShipmentStateError'; }
}
export class LabelError extends Error {
  constructor(msg: string) { super(msg); this.name = 'LabelError'; }
}

export interface ShipmentInput {
  deliveryType: 'homeDelivery' | 'agency' | 'locker';
  agencyId?: string;
  weightGrams: number; heightCm: number; widthCm: number; depthCm: number;
  declaredValue: number; serviceType: string;
  shipping: { street: string; streetNumber: string; floor?: string; apartment?: string; city: string; province: string; zip: string };
}

/** PAQ.AR exige "YYYY-MM-DDTHH:mm:ss-03:00"; Argentina no tiene DST, el offset es fijo. */
export function formatPaqarDate(d: Date): string {
  const ar = new Date(d.getTime() - 3 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${ar.getUTCFullYear()}-${p(ar.getUTCMonth() + 1)}-${p(ar.getUTCDate())}T${p(ar.getUTCHours())}:${p(ar.getUTCMinutes())}:${p(ar.getUTCSeconds())}-03:00`;
}

export function getShippingConfig(): Promise<ShippingConfig | null> {
  return prisma.shippingConfig.findUnique({ where: { id: 1 } });
}

export type ShippingConfigInput = Omit<ShippingConfig, 'id' | 'updatedAt'>;

export function updateShippingConfig(data: ShippingConfigInput): Promise<ShippingConfig> {
  return prisma.shippingConfig.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
}

export function buildPaqarOrder(order: Order, cfg: ShippingConfig, input: ShipmentInput): PaqarOrderPayload {
  return {
    order: {
      senderData: {
        businessName: cfg.senderName, email: cfg.senderEmail, phoneNumber: cfg.senderPhone,
        areaCodePhone: '', areaCodeCellphone: '', cellphoneNumber: '', observation: '',
        address: {
          streetName: cfg.senderStreet, streetNumber: cfg.senderStreetNumber, cityName: cfg.senderCity,
          floor: cfg.senderFloor, department: cfg.senderApartment, state: cfg.senderProvince, zipCode: cfg.senderZip,
        },
      },
      shippingData: {
        name: order.customerName, email: order.customerEmail, phoneNumber: order.customerPhone ?? '',
        areaCodePhone: '', areaCodeCellphone: '', cellphoneNumber: '', observation: '',
        address: {
          streetName: input.shipping.street, streetNumber: input.shipping.streetNumber, cityName: input.shipping.city,
          floor: input.shipping.floor ?? '', department: input.shipping.apartment ?? '', state: input.shipping.province, zipCode: input.shipping.zip,
        },
      },
      // La API solo toma el primer parcel (los demás se ignoran) — un solo bulto por pedido.
      parcels: [{
        dimensions: { height: String(input.heightCm), width: String(input.widthCm), depth: String(input.depthCm) },
        productWeight: String(input.weightGrams), productCategory: 'Indumentaria', declaredValue: String(input.declaredValue),
      }],
      deliveryType: input.deliveryType,
      agencyId: input.agencyId ?? '',
      saleDate: formatPaqarDate(order.createdAt),
      serviceType: input.serviceType,
      shipmentClientId: order.orderNo,
    },
  };
}

/**
 * Alta del envío en Correo Argentino + persistencia local. Devuelve null si la orden no existe.
 * Si existe un shipment cancelado se reutiliza la fila (el TN viejo queda en el historial del correo).
 */
export async function createShipmentForOrder(orderId: string, input: ShipmentInput): Promise<Shipment | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } });
  if (!order) return null;
  if (order.shipment && order.shipment.status !== 'cancelled') throw new ShipmentExistsError();
  const cfg = await getShippingConfig();
  if (!cfg) throw new ConfigMissingError();

  const { trackingNumber, raw } = await createShipmentOrder(buildPaqarOrder(order, cfg, input));

  const data = {
    trackingNumber, status: 'created',
    deliveryType: input.deliveryType, agencyId: input.agencyId || null, serviceType: input.serviceType,
    weightGrams: input.weightGrams, heightCm: input.heightCm, widthCm: input.widthCm, depthCm: input.depthCm,
    declaredValue: input.declaredValue, paqarResponse: raw as object,
  };
  const [shipment] = await prisma.$transaction([
    order.shipment
      ? prisma.shipment.update({ where: { id: order.shipment.id }, data })
      : prisma.shipment.create({ data: { ...data, orderId } }),
    // La dirección que viajó al correo pasa a ser la dirección de la orden (el admin pudo corregirla).
    prisma.order.update({
      where: { id: orderId },
      data: {
        shippingStreet: input.shipping.street, shippingStreetNumber: input.shipping.streetNumber,
        shippingFloor: input.shipping.floor || null, shippingApartment: input.shipping.apartment || null,
        shippingZip: input.shipping.zip, shippingProvince: input.shipping.province, city: input.shipping.city,
        address: `${input.shipping.street} ${input.shipping.streetNumber}${input.shipping.floor ? `, ${input.shipping.floor}` : ''}${input.shipping.apartment ? ` ${input.shipping.apartment}` : ''}`,
      },
    }),
  ]);
  return shipment;
}

/** Cancela la preimposición en el correo y marca el shipment. Null si no existe. */
export async function cancelShipment(shipmentId: string): Promise<Shipment | null> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) return null;
  if (shipment.status !== 'created') throw new InvalidShipmentStateError('El envío ya fue cancelado');
  await cancelShipmentOrder(shipment.trackingNumber);
  return prisma.shipment.update({ where: { id: shipmentId }, data: { status: 'cancelled' } });
}

/** Rótulo PDF en base64. Usa el labelFormat configurado salvo override. */
export async function getShipmentLabel(shipmentId: string, format?: string): Promise<{ fileName: string; fileBase64: string } | null> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) return null;
  const cfg = await getShippingConfig();
  const labels = await getLabels([{ sellerId: '', trackingNumber: shipment.trackingNumber }], format || cfg?.labelFormat || '10x15');
  const label = labels[0];
  if (!label || !label.result?.startsWith('OK')) throw new LabelError(label?.result || 'PAQ.AR no devolvió el rótulo');
  return { fileName: label.fileName, fileBase64: label.fileBase64 };
}

/** Historial de eventos del envío. Null si el shipment no existe. */
export async function getShipmentTracking(shipmentId: string): Promise<PaqarTrackingEntry | null> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) return null;
  const entries = await getTracking([shipment.trackingNumber]);
  return entries[0] ?? { id: null, quantity: 0, countryId: null, serviceType: null, trackingNumber: shipment.trackingNumber, event: [] };
}

export function listShipments() {
  return prisma.shipment.findMany({
    orderBy: { createdAt: 'desc' },
    include: { order: { select: { id: true, orderNo: true, customerName: true, status: true } } },
  });
}
