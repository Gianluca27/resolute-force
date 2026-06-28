// QA Módulo 7 — Emails: capa de transporte (mailer.ts) con SMTP REAL deshabilitado.
// Archivo de corrida QA (no set permanente). SMTP no configurado en el env de test
// (vitest.config.ts no setea SMTP_HOST/USER) → transporter === null.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendMail } from '../src/lib/mailer.js';

afterEach(() => vi.restoreAllMocks());

describe('Módulo 7 — mailer transport (SMTP deshabilitado)', () => {
  // TC-MAIL-001 / TC-MAIL-002: enabled = Boolean(HOST && USER). Sin SMTP → no-op (resuelve).
  it('TC-MAIL-001: sendMail no-opea (resuelve undefined) cuando SMTP no está configurado', async () => {
    await expect(sendMail({ to: 'x@y.com', subject: 'hi', html: '<p>hi</p>' })).resolves.toBeUndefined();
  });

  // TC-MAIL-006 (rama !opts.to): destinatario vacío → return temprano, sin error.
  it('TC-MAIL-006: sendMail no-opea con destinatario vacío', async () => {
    await expect(sendMail({ to: '', subject: 'hi', html: '<p>hi</p>' })).resolves.toBeUndefined();
  });

  // TC-MAIL-007: el log [mail:skipped] está gateado por NODE_ENV !== 'test'. Acá NODE_ENV==='test'.
  it('TC-MAIL-007: bajo NODE_ENV=test NO imprime [mail:skipped]', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await sendMail({ to: 'x@y.com', subject: 'hi', html: '<p>hi</p>' });
    const skipped = spy.mock.calls.some((c) => String(c[0]).includes('[mail:skipped]'));
    expect(skipped).toBe(false);
  });
});
