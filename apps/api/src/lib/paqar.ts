import { request } from 'undici';
import { env } from '../env.js';

// Cliente HTTP para la API PAQ.AR de Correo Argentino (apiPaqAr-v2.pdf).
// Se usa undici.request y no fetch porque /v1/tracking es GET con body JSON,
// algo que la spec de fetch prohíbe.

export class PaqarError extends Error {
  constructor(public status: number, msg: string) { super(msg); this.name = 'PaqarError'; }
}
export class PaqarDisabledError extends Error {
  constructor() { super('PAQ.AR no configurado'); this.name = 'PaqarDisabledError'; }
}

export const paqarEnabled = () => Boolean(env.PAQAR_API_KEY && env.PAQAR_AGREEMENT);

export interface PaqarAddress {
  streetName: string; streetNumber: string; cityName: string;
  floor: string; department: string; state: string; zipCode: string;
}
export interface PaqarOrderPayload {
  sellerId?: string;
  trackingNumber?: string;
  order: {
    senderData: {
      businessName: string; email: string; phoneNumber: string;
      areaCodePhone: string; areaCodeCellphone: string; cellphoneNumber: string;
      observation: string; address: PaqarAddress;
    };
    shippingData: {
      name: string; email: string; phoneNumber: string;
      areaCodePhone: string; areaCodeCellphone: string; cellphoneNumber: string;
      observation: string; address: PaqarAddress;
    };
    parcels: { dimensions: { height: string; width: string; depth: string }; productWeight: string; productCategory: string; declaredValue: string }[];
    deliveryType: string; agencyId: string; saleDate: string; serviceType: string; shipmentClientId: string;
  };
}
export interface PaqarLabel { trackingNumber: string; fileBase64: string; fileName: string; result: string; }
export interface PaqarTrackingEvent { facilityId?: string; facilityCode?: string; facility: string; statusId: string; status: string; date: string; sign: string; }
export interface PaqarTrackingEntry { id: string | null; quantity: number; countryId: string | null; serviceType: string | null; trackingNumber: string; event: PaqarTrackingEvent[]; }

async function call(method: 'GET' | 'POST' | 'PATCH', path: string, opts: { body?: unknown; query?: Record<string, string> } = {}) {
  if (!paqarEnabled()) throw new PaqarDisabledError();
  const url = new URL(env.PAQAR_BASE_URL + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const res = await request(url, {
    method,
    headers: { authorization: `Apikey ${env.PAQAR_API_KEY}`, agreement: env.PAQAR_AGREEMENT, 'content-type': 'application/json' },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    headersTimeout: 15_000,
    bodyTimeout: 30_000,
  });
  const text = await res.body.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* cuerpo no-JSON (p. ej. 204 vacío) */ }
  if (res.statusCode >= 400) {
    const e = json as { message?: string; error?: string } | null;
    throw new PaqarError(res.statusCode, e?.message || e?.error || `PAQ.AR HTTP ${res.statusCode}`);
  }
  return json;
}

/** GET /v1/auth — true si las credenciales son válidas; errores de red/5xx se propagan. */
export async function validateAuth(): Promise<boolean> {
  try {
    await call('GET', '/v1/auth');
    return true;
  } catch (e) {
    if (e instanceof PaqarError && e.status < 500) return false;
    throw e;
  }
}

/** POST /v1/orders — devuelve el tracking number que asigna el correo. */
export async function createShipmentOrder(payload: PaqarOrderPayload): Promise<{ trackingNumber: string; raw: unknown }> {
  const raw = await call('POST', '/v1/orders', { body: payload }) as { trackingNumber?: string; order?: { trackingNumber?: string } } | null;
  const trackingNumber = raw?.trackingNumber ?? raw?.order?.trackingNumber;
  if (!trackingNumber) throw new PaqarError(502, 'PAQ.AR no devolvió tracking number');
  return { trackingNumber, raw };
}

/** PATCH /v1/orders/{tn}/cancel */
export async function cancelShipmentOrder(trackingNumber: string): Promise<unknown> {
  return call('PATCH', `/v1/orders/${encodeURIComponent(trackingNumber)}/cancel`);
}

/** POST /v1/labels — rótulos en base64; labelFormat "10x15" | "label" aplica a todo el lote. */
export async function getLabels(items: { sellerId: string; trackingNumber: string }[], labelFormat?: string): Promise<PaqarLabel[]> {
  return (await call('POST', '/v1/labels', { body: items, query: labelFormat ? { labelFormat } : undefined })) as PaqarLabel[];
}

/** GET /v1/tracking — historial de eventos por tracking number (GET con body JSON, sic). */
export async function getTracking(trackingNumbers: string[], extClient?: string): Promise<PaqarTrackingEntry[]> {
  return (await call('GET', '/v1/tracking', {
    body: trackingNumbers.map((tn) => ({ trackingNumber: tn })),
    query: extClient ? { extClient } : undefined,
  })) as PaqarTrackingEntry[];
}

/** GET /v1/agencies — sucursales habilitadas para el agreement. */
export async function getAgencies(f: { stateId?: string; pickupAvailability?: boolean; packageReception?: boolean } = {}): Promise<unknown[]> {
  const query: Record<string, string> = {};
  if (f.stateId) query.stateId = f.stateId;
  if (f.pickupAvailability !== undefined) query.pickup_availability = String(f.pickupAvailability);
  if (f.packageReception !== undefined) query.package_reception = String(f.packageReception);
  return (await call('GET', '/v1/agencies', { query })) as unknown[];
}
