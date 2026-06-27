import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyWebhookSignature } from '../src/lib/webhook.js';

const secret = 'whsec-test';
const sign = (dataId: string, requestId: string, ts: string) =>
  crypto.createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed MercadoPago webhook', () => {
    const ts = '1700000000', dataId = '123', reqId = 'req-abc';
    const v1 = sign(dataId, reqId, ts);
    expect(verifyWebhookSignature({ signature: `ts=${ts},v1=${v1}`, requestId: reqId, dataId, secret })).toBe(true);
  });

  it('rejects a tampered/forged signature', () => {
    expect(verifyWebhookSignature({ signature: 'ts=1700000000,v1=deadbeef', requestId: 'req-abc', dataId: '123', secret })).toBe(false);
  });

  it('rejects when the signature header is missing but a secret is configured', () => {
    expect(verifyWebhookSignature({ signature: undefined, requestId: 'req-abc', dataId: '123', secret })).toBe(false);
  });

  it('skips verification (returns true) when no secret is configured', () => {
    expect(verifyWebhookSignature({ signature: undefined, requestId: undefined, dataId: '123', secret: '' })).toBe(true);
  });
});
