// QA Módulo 7 — Emails (docs/qa/07-emails.md). Ejecuta TC-MAIL-008..032 de forma
// determinística contra la DB de test, con sendMail mockeado para inspeccionar
// destinatario/asunto/cuerpo y contar envíos. Archivo de corrida QA, no set permanente.
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/mailer.js', () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { prisma } from '../src/prisma.js';
import { sendMail } from '../src/lib/mailer.js';
import { env } from '../src/env.js';
import {
  createOrder, markPaidByOrderNo, changeOrderStatus, reverseOrderIfPaid, OutOfStockError,
} from '../src/services/orders.js';
import { notifyOrderPaid, notifyTransferOrder } from '../src/services/notify.js';

const app = createApp();
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', calle: 'Calle 1', altura: '100', cp: '1425', provincia: 'C', ciudad: 'CABA' };
let navyId = '';

type MailArgs = { to: string; subject: string; html: string };
const calls = (): MailArgs[] => vi.mocked(sendMail).mock.calls.map((c) => c[0] as MailArgs);
const adminMail = () => calls().find((c) => c.to === 'admin@test.com');
const custMail = () => calls().find((c) => c.to === 'ana@x.com');
const tick = () => new Promise((r) => setTimeout(r, 10)); // deja drenar el notify fire-and-forget
const setStockM = (n: number) => prisma.variant.updateMany({ where: { productId: navyId, size: 'M' }, data: { stock: n } });
const mkOrder = (qty: number, method: 'transfer' | 'card' | 'wallet' = 'card', size = 'M', cust = customer) =>
  createOrder({ items: [{ productId: navyId, size, qty }], customer: cust, method }).then((r) => r.order);

beforeEach(async () => {
  await resetDb();
  await seed();
  vi.clearAllMocks();
  navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
});

// ───────────── Triggers — cuándo se disparan los mails "pagado" ─────────────
describe('Triggers', () => {
  it('TC-MAIL-008: card-approved (markPaid) dispara admin+customer; customer SIN bloque banco', async () => {
    const o = await mkOrder(1, 'card');
    await markPaidByOrderNo(o.orderNo, 'PAY-1');
    await tick();
    expect(adminMail()).toBeTruthy();
    expect(custMail()).toBeTruthy();
    expect(custMail()!.html).not.toContain('Para confirmar, transferí'); // card → sin bank block
    expect(custMail()!.html).toContain('Pago: card');
  });

  it('TC-MAIL-010: admin marca pending→paid (changeOrderStatus) dispara ambos mails', async () => {
    const o = await mkOrder(2, 'transfer');
    await changeOrderStatus(o.id, 'paid');
    await tick();
    expect(calls()).toHaveLength(2);
    expect(adminMail()).toBeTruthy();
    expect(custMail()).toBeTruthy();
  });

  it('TC-MAIL-011: admin salta pending→shipped → markPaid dispara los mails una vez; queda shipped', async () => {
    const o = await mkOrder(2, 'transfer');
    await changeOrderStatus(o.id, 'shipped');
    await tick();
    expect(calls()).toHaveLength(2);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('shipped');
  });

  it('TC-MAIL-012: reversa (refunded) notifica al cliente y al admin la cancelación (H-02)', async () => {
    const o = await mkOrder(2, 'card');
    await markPaidByOrderNo(o.orderNo, 'PAY-1');
    await tick();
    vi.clearAllMocks();
    await reverseOrderIfPaid(o.orderNo);
    await tick();
    const c = custMail()!;
    expect(c).toBeTruthy();
    expect(c.subject).toContain('cancelado');
    expect(c.html).toContain('fue cancelado');
    expect(adminMail()).toBeTruthy(); // admin también se entera de la reversa
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('cancelled');
  });

  it('TC-MAIL-012b: reversa repetida (refunded + charged_back) notifica una sola vez', async () => {
    const o = await mkOrder(2, 'card');
    await markPaidByOrderNo(o.orderNo, 'PAY-1');
    await tick();
    vi.clearAllMocks();
    await reverseOrderIfPaid(o.orderNo);
    await reverseOrderIfPaid(o.orderNo); // 2º claim ve count===0 → no re-notifica
    await tick();
    expect(calls()).toHaveLength(2); // 1 admin + 1 customer, no 4
  });

  it('TC-MAIL-013: out-of-stock en captura (markPaid throws) NO envía mail', async () => {
    const o = await mkOrder(1, 'card');
    await setStockM(0); // drenado entre quote y captura
    await expect(markPaidByOrderNo(o.orderNo, 'PAY-X')).rejects.toBeInstanceOf(OutOfStockError);
    await tick();
    expect(sendMail).not.toHaveBeenCalled();
  });
});

// ───────────── Idempotencia — exactamente una vez ─────────────
describe('Idempotencia', () => {
  it('TC-MAIL-014: dispara exactamente una vez en la transición a paid (admin x1, customer x1)', async () => {
    const o = await mkOrder(1, 'card');
    await markPaidByOrderNo(o.orderNo, 'PAY-1');
    await tick();
    expect(calls().filter((c) => c.to === 'admin@test.com')).toHaveLength(1);
    expect(calls().filter((c) => c.to === 'ana@x.com')).toHaveLength(1);
  });

  it('TC-MAIL-015: markPaid repetido (replay) NO envía un segundo mail', async () => {
    const o = await mkOrder(1, 'card');
    await markPaidByOrderNo(o.orderNo, 'PAY-1');
    await markPaidByOrderNo(o.orderNo, 'PAY-1');
    await tick();
    expect(calls()).toHaveLength(2); // sigue 2 (1 admin + 1 customer), no 4
  });

  it('TC-MAIL-016: guardar el mismo status (paid→paid) no dispara mail', async () => {
    const o = await mkOrder(1, 'card');
    await changeOrderStatus(o.id, 'paid');
    await tick();
    vi.clearAllMocks();
    await changeOrderStatus(o.id, 'paid'); // from===to → short-circuit
    await tick();
    expect(sendMail).not.toHaveBeenCalled();
  });
});

// ───────────── Admin email — destinatario, asunto, cuerpo ─────────────
describe('Admin email', () => {
  it('TC-MAIL-017: destinatario, asunto y campos del cuerpo', async () => {
    const o = await mkOrder(1, 'card');
    await prisma.order.update({ where: { id: o.id }, data: { status: 'paid' } }); // header refleja status real
    await notifyOrderPaid(o.orderNo);
    const a = adminMail()!;
    expect(a.to).toBe('admin@test.com');
    expect(a.subject).toBe(`Pedido ${o.orderNo} — Ana ($30.000)`);
    expect(a.html).toContain(`🔥 Nuevo pedido ${o.orderNo}`);
    expect(a.html).toContain('(paid)');
    expect(a.html).toContain('Ana');
    expect(a.html).toContain('ana@x.com');
    expect(a.html).toContain('Calle 1');
    expect(a.html).toContain('CABA');
    expect(a.html).toContain('Pago:</b> card');
    expect(a.html).toContain('Total:</b> $30.000');
  });

  it('TC-MAIL-018: ADMIN_NOTIFY_EMAIL vacío → skip admin, customer igual recibe', async () => {
    const real = env.ADMIN_NOTIFY_EMAIL;
    (env as Record<string, unknown>).ADMIN_NOTIFY_EMAIL = '';
    try {
      const o = await mkOrder(1, 'card');
      await notifyOrderPaid(o.orderNo);
      expect(calls()).toHaveLength(1);
      expect(calls()[0]!.to).toBe('ana@x.com');
    } finally {
      (env as Record<string, unknown>).ADMIN_NOTIFY_EMAIL = real;
    }
  });

  it('TC-MAIL-019: teléfono ausente → placeholder "—"; presente → teléfono real', async () => {
    const noPhone = await mkOrder(1, 'card', 'M', { ...customer, tel: '' });
    await notifyOrderPaid(noPhone.orderNo);
    expect(adminMail()!.html).toContain('ana@x.com · —');
    vi.clearAllMocks();
    const withPhone = await mkOrder(1, 'card', 'L', { ...customer, tel: '3415550000' });
    await notifyOrderPaid(withPhone.orderNo);
    expect(adminMail()!.html).toContain('ana@x.com · 3415550000');
  });
});

// ───────────── Customer email — destinatario, asunto, cuerpo, totales ─────────────
describe('Customer email', () => {
  it('TC-MAIL-020: destinatario, asunto, header, footer', async () => {
    const o = await mkOrder(1, 'card');
    await notifyOrderPaid(o.orderNo);
    const c = custMail()!;
    expect(c.to).toBe('ana@x.com');
    expect(c.subject).toBe(`Resolute Force — Pedido ${o.orderNo}`);
    expect(c.html).toContain('¡Gracias por tu pedido, Ana!');
    expect(c.html).toContain('Champion Mentality. Stop at Nothing');
  });

  it('TC-MAIL-021: totales por método (card 30.000, transfer 27.000, 2u transfer 54.000)', async () => {
    const card = await mkOrder(1, 'card');
    await notifyOrderPaid(card.orderNo);
    expect(card.total).toBe(30000);
    expect(custMail()!.html).toContain('$30.000');

    vi.clearAllMocks();
    const t1 = await mkOrder(1, 'transfer');
    await notifyOrderPaid(t1.orderNo);
    expect(t1.total).toBe(27000);
    expect(custMail()!.html).toContain('$27.000');

    vi.clearAllMocks();
    const t2 = await mkOrder(2, 'transfer');
    await notifyOrderPaid(t2.orderNo);
    expect(t2.total).toBe(54000);
    expect(custMail()!.html).toContain('$54.000');
  });

  it('TC-MAIL-022: tabla de ítems renderiza color/talle/cant/subtotal por línea (en ambos mails)', async () => {
    const o = await createOrder({
      items: [{ productId: navyId, size: 'L', qty: 2 }, { productId: navyId, size: 'M', qty: 1 }],
      customer, method: 'card',
    }).then((r) => r.order);
    await notifyOrderPaid(o.orderNo);
    for (const m of [adminMail()!, custMail()!]) {
      expect(m.html).toContain('<th>Producto</th><th>Color</th><th>Talle</th><th>Cant.</th><th>Subtotal</th>');
      expect(m.html).toContain('Azul Marino');
      expect(m.html).toContain('>L<');
      expect(m.html).toContain('>M<');
      expect(m.html).toContain('$60.000'); // 2 × 30.000
    }
  });
});

// ───────────── Bloque banco (transfer) ─────────────
describe('Bloque banco', () => {
  it('TC-MAIL-023: SIN bloque banco cuando bankAlias está vacío (CD-11)', async () => {
    const o = await mkOrder(1, 'transfer');
    await notifyTransferOrder(o.orderNo, { bankAlias: '', bankCbu: '' });
    expect(custMail()!.html).not.toContain('Para confirmar, transferí');
  });

  it('TC-MAIL-024: CON bloque banco cuando bankAlias seteado (alias + CBU)', async () => {
    const o = await mkOrder(1, 'transfer');
    await notifyTransferOrder(o.orderNo, { bankAlias: 'resolute.mp', bankCbu: '0000003100010000000001' });
    const h = custMail()!.html;
    expect(h).toContain('Para confirmar, transferí');
    expect(h).toContain('alias <b>resolute.mp</b>');
    expect(h).toContain('CBU <b>0000003100010000000001</b>');
  });

  it('TC-MAIL-025: CBU omitido si solo alias; incluido si ambos; sin bloque si solo CBU', async () => {
    const o1 = await mkOrder(1, 'transfer');
    await notifyTransferOrder(o1.orderNo, { bankAlias: 'resolute.mp', bankCbu: '' });
    expect(custMail()!.html).toContain('alias <b>resolute.mp</b>');
    expect(custMail()!.html).not.toContain('CBU');

    vi.clearAllMocks();
    const o2 = await mkOrder(1, 'transfer');
    await notifyTransferOrder(o2.orderNo, { bankAlias: 'resolute.mp', bankCbu: '123' });
    expect(custMail()!.html).toContain('CBU <b>123</b>');

    vi.clearAllMocks();
    const o3 = await mkOrder(1, 'transfer');
    await notifyTransferOrder(o3.orderNo, { bankAlias: '', bankCbu: '123' });
    expect(custMail()!.html).not.toContain('Para confirmar, transferí'); // gate solo en alias
  });

  it('TC-MAIL-026: monto del bloque = total transfer (27.000), no el subtotal bruto (30.000)', async () => {
    const o = await mkOrder(1, 'transfer');
    await notifyTransferOrder(o.orderNo, { bankAlias: 'resolute.mp', bankCbu: '' });
    expect(custMail()!.html).toContain('transferí <b>$27.000</b>');
    expect(custMail()!.html).not.toContain('transferí <b>$30.000</b>');
  });

  it('TC-MAIL-023b (hallazgo): seed default trae bankAlias="resolute.force" → SÍ hay bloque banco', async () => {
    // El route de transfer lee bankAlias/bankCbu de SiteContent (seed) y los pasa a notifyTransferOrder.
    const content = await prisma.siteContent.findUniqueOrThrow({ where: { id: 1 } });
    expect(content.bankAlias).toBe('resolute.force'); // NO '' como afirma la precondición de TC-MAIL-023
    const o = await mkOrder(1, 'transfer');
    await notifyTransferOrder(o.orderNo, { bankAlias: content.bankAlias, bankCbu: content.bankCbu });
    expect(custMail()!.html).toContain('alias <b>resolute.force</b>');
    expect(custMail()!.html).not.toContain('CBU'); // bankCbu='' en seed → segmento omitido
  });
});

// ───────────── Aislamiento de fallos / no bloqueante ─────────────
describe('Aislamiento de fallos', () => {
  it('TC-MAIL-027: un fallo de SMTP no rechaza notifyOrderPaid (allSettled) y ambos se intentan', async () => {
    vi.mocked(sendMail).mockRejectedValue(new Error('smtp down'));
    const o = await mkOrder(1, 'card');
    await expect(notifyOrderPaid(o.orderNo)).resolves.toBeUndefined();
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('TC-MAIL-028: allSettled aísla admin vs customer (falla admin, customer se intenta igual)', async () => {
    vi.mocked(sendMail).mockImplementation(async (opts: MailArgs) => {
      if (opts.to === 'admin@test.com') throw new Error('admin rejected');
    });
    const o = await mkOrder(1, 'card');
    await expect(notifyOrderPaid(o.orderNo)).resolves.toBeUndefined();
    expect(calls().some((c) => c.to === 'ana@x.com')).toBe(true);
    expect(calls().some((c) => c.to === 'admin@test.com')).toBe(true);
  });

  it('TC-MAIL-029: sin reintento — exactamente un intento por destinatario aunque falle', async () => {
    vi.mocked(sendMail).mockRejectedValue(new Error('transient'));
    const o = await mkOrder(1, 'card');
    await notifyOrderPaid(o.orderNo);
    expect(sendMail).toHaveBeenCalledTimes(2); // 1 admin + 1 customer, sin retry
  });
});

// ───────────── Seguridad — escaping ─────────────
describe('Seguridad (escapeHtml)', () => {
  it('TC-MAIL-030: neutraliza inyección HTML/script en campos del cliente', async () => {
    const evil = { nombre: '<script>alert(1)</script>', email: 'ana@x.com', tel: '11', calle: '<img src=x onerror=alert(2)>', altura: '100', cp: '1425', provincia: 'C', ciudad: 'A & B "Co"' };
    const o = await mkOrder(1, 'card', 'M', evil);
    await notifyOrderPaid(o.orderNo);
    const a = adminMail()!;
    expect(a.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(a.html).toContain('&lt;img src=x onerror=alert(2)&gt;');
    expect(a.html).toContain('A &amp; B &quot;Co&quot;');
    expect(a.html).not.toContain('<script>alert(1)');
    expect(a.html).not.toContain('<img src=x');
  });

  it('TC-MAIL-031: los cuatro caracteres se escapan, & primero (sin doble-encoding)', async () => {
    const o = await mkOrder(1, 'card', 'M', { ...customer, nombre: 'Tom & "Jerry" <b>' });
    await notifyOrderPaid(o.orderNo);
    expect(custMail()!.html).toContain('Tom &amp; &quot;Jerry&quot; &lt;b&gt;');
    expect(custMail()!.html).not.toContain('&amp;lt;'); // sin doble-encoding
  });
});

// ───────────── Email inválido bloqueado upstream ─────────────
describe('Validación upstream', () => {
  it('TC-MAIL-032: email inválido → 400 en /transfer y /card; no se crea orden', async () => {
    const bad = { ...customer, email: 'not-an-email' };
    const before = await prisma.order.count();

    const t = await request(app).post('/api/orders/transfer').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer: bad });
    expect(t.status).toBe(400);
    expect(t.body.error).toBe('Datos inválidos');

    const c = await request(app).post('/api/payments/card').send({
      items: [{ productId: navyId, size: 'M', qty: 1 }], customer: bad,
      token: 'tok', installments: 1, paymentMethodId: 'visa', payer: { email: 'ana@x.com' },
    });
    expect(c.status).toBe(400);
    expect(c.body.error).toBe('Datos de pago inválidos');

    expect(await prisma.order.count()).toBe(before); // nada persistido
  });
});

afterEach(() => vi.clearAllMocks());
