import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('undici', () => ({ request: vi.fn() }));
// Credenciales de prueba inyectadas; los tests de "deshabilitado" mutan este objeto y lo restauran.
vi.mock('../src/env.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/env.js')>();
  return { ...mod, env: { ...mod.env, PAQAR_BASE_URL: 'https://paqar.test/paqar', PAQAR_API_KEY: 'test-key', PAQAR_AGREEMENT: '18017' } };
});

import { request } from 'undici';
import { env } from '../src/env.js';
import {
  paqarEnabled, validateAuth, createShipmentOrder, cancelShipmentOrder,
  getLabels, getTracking, getAgencies, PaqarError, PaqarDisabledError,
} from '../src/lib/paqar.js';

const mockRequest = vi.mocked(request);

function respond(statusCode: number, body: unknown = null) {
  mockRequest.mockResolvedValueOnce({ statusCode, body: { text: async () => (body === null ? '' : JSON.stringify(body)) } } as never);
}

beforeEach(() => {
  mockRequest.mockReset();
  (env as { PAQAR_API_KEY: string }).PAQAR_API_KEY = 'test-key';
});

describe('paqar client', () => {
  it('sends Apikey + agreement headers to the right URL', async () => {
    respond(204);
    await validateAuth();
    const [url, opts] = mockRequest.mock.calls[0]!;
    expect(String(url)).toBe('https://paqar.test/paqar/v1/auth');
    expect((opts as { headers: Record<string, string> }).headers).toMatchObject({ authorization: 'Apikey test-key', agreement: '18017' });
  });

  it('validateAuth: 204 → true, 401 → false', async () => {
    respond(204);
    expect(await validateAuth()).toBe(true);
    respond(401, { status: 401, error: 'Unauthorized', message: 'Account not found by apiKey' });
    expect(await validateAuth()).toBe(false);
  });

  it('createShipmentOrder posts the payload and returns the assigned tracking number', async () => {
    respond(200, { idSeller: '1', trackingNumber: '3333007773' });
    const payload = { order: { deliveryType: 'homeDelivery' } };
    const r = await createShipmentOrder(payload as never);
    expect(r.trackingNumber).toBe('3333007773');
    const [url, opts] = mockRequest.mock.calls[0]!;
    expect(String(url)).toBe('https://paqar.test/paqar/v1/orders');
    expect((opts as { method: string }).method).toBe('POST');
    expect(JSON.parse((opts as { body: string }).body)).toEqual(payload);
  });

  it('maps API error bodies to PaqarError with the original message', async () => {
    respond(400, { status: 400, error: 'Bad request', message: 'tipoEntrega invalido' });
    await expect(createShipmentOrder({} as never)).rejects.toThrowError(new PaqarError(400, 'tipoEntrega invalido'));
  });

  it('throws PaqarDisabledError when credentials are missing', async () => {
    (env as { PAQAR_API_KEY: string }).PAQAR_API_KEY = '';
    expect(paqarEnabled()).toBe(false);
    await expect(validateAuth()).rejects.toBeInstanceOf(PaqarDisabledError);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('cancelShipmentOrder PATCHes /v1/orders/{tn}/cancel', async () => {
    respond(200, { codigo: 200, mensaje: 'Pedido Cancelado' });
    await cancelShipmentOrder('TN123');
    const [url, opts] = mockRequest.mock.calls[0]!;
    expect(String(url)).toBe('https://paqar.test/paqar/v1/orders/TN123/cancel');
    expect((opts as { method: string }).method).toBe('PATCH');
  });

  it('getLabels POSTs the batch with labelFormat as query param', async () => {
    respond(200, [{ trackingNumber: 'TN1', fileBase64: 'QUJD', fileName: 'a.pdf', result: 'OK' }]);
    const r = await getLabels([{ sellerId: '', trackingNumber: 'TN1' }], '10x15');
    expect(r[0]!.result).toBe('OK');
    const [url, opts] = mockRequest.mock.calls[0]!;
    expect(String(url)).toBe('https://paqar.test/paqar/v1/labels?labelFormat=10x15');
    expect(JSON.parse((opts as { body: string }).body)).toEqual([{ sellerId: '', trackingNumber: 'TN1' }]);
  });

  it('getTracking sends a GET with the tracking numbers as JSON body', async () => {
    respond(200, [{ trackingNumber: 'TN1', quantity: 1, event: [] }]);
    const r = await getTracking(['TN1']);
    expect(r[0]!.trackingNumber).toBe('TN1');
    const [url, opts] = mockRequest.mock.calls[0]!;
    expect(String(url)).toBe('https://paqar.test/paqar/v1/tracking');
    expect((opts as { method: string }).method).toBe('GET');
    expect(JSON.parse((opts as { body: string }).body)).toEqual([{ trackingNumber: 'TN1' }]);
  });

  it('getAgencies passes filters as snake_case query params', async () => {
    respond(200, [{ agency_id: 'SCQ' }]);
    await getAgencies({ stateId: 'S', pickupAvailability: true });
    const [url] = mockRequest.mock.calls[0]!;
    const u = new URL(String(url));
    expect(u.pathname).toBe('/paqar/v1/agencies');
    expect(u.searchParams.get('stateId')).toBe('S');
    expect(u.searchParams.get('pickup_availability')).toBe('true');
    expect(u.searchParams.get('package_reception')).toBeNull();
  });
});
