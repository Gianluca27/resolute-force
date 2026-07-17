import { describe, it, expect, vi, beforeEach } from 'vitest';

const { paymentCreateMock } = vi.hoisted(() => ({
  paymentCreateMock: vi.fn().mockResolvedValue({ id: 1, status: 'approved', status_detail: 'accredited' }),
}));

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: vi.fn(),
  Payment: vi.fn().mockImplementation(() => ({ create: paymentCreateMock, get: vi.fn() })),
  Preference: vi.fn().mockImplementation(() => ({ create: vi.fn() })),
  PaymentRefund: vi.fn().mockImplementation(() => ({ create: vi.fn() })),
}));

import { createCardPayment } from '../src/lib/mp.js';

const base = { amount: 30000, token: 'tok', installments: 1, paymentMethodId: 'master', payerEmail: 'ana@x.com', orderNo: 'RF-100' };

describe('createCardPayment', () => {
  beforeEach(() => { paymentCreateMock.mockClear(); });

  it('forwards deviceId as X-Meli-Session-Id via requestOptions.meliSessionId when provided', async () => {
    await createCardPayment({ ...base, deviceId: 'device-abc-123' });
    expect(paymentCreateMock).toHaveBeenCalledWith(expect.objectContaining({ requestOptions: { meliSessionId: 'device-abc-123' } }));
  });

  it('omits requestOptions when deviceId is not provided', async () => {
    await createCardPayment(base);
    const callArg = paymentCreateMock.mock.calls[0]![0];
    expect(callArg.requestOptions).toBeUndefined();
  });
});
