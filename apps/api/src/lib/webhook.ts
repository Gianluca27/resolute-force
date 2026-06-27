import crypto from 'node:crypto';

/**
 * Validate a MercadoPago webhook HMAC signature.
 * Manifest format: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` signed with the webhook secret.
 * When no secret is configured (dev/local), verification is skipped (returns true).
 */
export function verifyWebhookSignature(p: { signature?: string; requestId?: string; dataId: string; secret: string }): boolean {
  if (!p.secret) return true;
  if (!p.signature) return false;

  const parts: Record<string, string> = {};
  for (const kv of p.signature.split(',')) {
    const i = kv.indexOf('=');
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const manifest = `id:${p.dataId};request-id:${p.requestId ?? ''};ts:${ts};`;
  const expected = crypto.createHmac('sha256', p.secret).update(manifest).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
