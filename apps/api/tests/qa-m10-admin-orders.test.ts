// QA Módulo 10 — Admin orders (docs/qa/10-admin-orders.md). Ejecuta los casos de capa API:
// listado (TC-ORD-001..004), transiciones de estado y reglas de stock (TC-ORD-005..014),
// validación/errores (TC-ORD-015..016), flujos (TC-ORD-017..019) y seguridad (TC-ORD-021).
// Los casos puramente de UI (TC-ORD-020 silent-fail, TC-ORD-022 perf, TC-ORD-023 a11y) van en
// el archivo web qa-m10-admin-orders.test.tsx. Archivo de corrida QA, no set permanente.
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

// El path de reserva (markPaidByOrderNo) dispara notifyOrderPaid vía import dinámico fire-and-forget.
// Lo mockeamos para observar el efecto email sin SMTP real.
vi.mock('../src/services/notify.js', () => ({
  notifyOrderPaid: vi.fn().mockResolvedValue(undefined),
  notifyTransferOrder: vi.fn().mockResolvedValue(undefined),
  notifyOrderReversed: vi.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import { prisma } from '../src/prisma.js';
import { createOrder } from '../src/services/orders.js';
import { notifyOrderPaid } from '../src/services/notify.js';

const app = createApp();
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', calle: 'Calle 1', altura: '100', cp: '1425', provincia: 'C', ciudad: 'CABA' };

let navyId = '';
let negroId = '';

beforeEach(async () => {
  await resetDb();
  await seed();
  navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
  negroId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-negro' } })).id;
  vi.mocked(notifyOrderPaid).mockClear();
});
afterEach(() => vi.clearAllMocks());

const patch = (id: string, status: string) =>
  request(app).patch(`/api/admin/orders/${id}/status`).set(authHeader()).send({ status });
const stockOf = (productId: string, size: string) =>
  prisma.variant.findFirstOrThrow({ where: { productId, size } }).then((v) => v.stock);
// El notify es fire-and-forget (void import().then()): dejamos correr los microtasks antes de aseverar.
const flush = () => new Promise((r) => setTimeout(r, 20));

// ───────────────────────── Listado ─────────────────────────
describe('Orders list', () => {
  it('TC-ORD-001: lista todas las órdenes, más nuevas primero, con los datos de la card', async () => {
    const a = (await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' })).order;
    const b = (await createOrder({ items: [{ productId: negroId, size: 'L', qty: 1 }], customer, method: 'card' })).order;
    // createdAt determinístico: a más viejo, b más nuevo.
    await prisma.order.update({ where: { id: a.id }, data: { createdAt: new Date('2026-01-01T00:00:00Z') } });
    await prisma.order.update({ where: { id: b.id }, data: { createdAt: new Date('2026-02-01T00:00:00Z') } });

    const r = await request(app).get('/api/admin/orders').set(authHeader());
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(2);
    expect(r.body.map((o: any) => o.id)).toEqual([b.id, a.id]); // createdAt desc
    const card = r.body[1];
    expect(card.orderNo).toMatch(/^RF-\d{6}$/);
    expect(card.customerName).toBe('Ana');
    expect(card.items[0]).toMatchObject({ line: 'Champion Mentality', color: 'Azul Marino', size: 'M', qty: 2 });
  });

  it('TC-ORD-002: cada campo de la card mapea a los datos correctos (DTO sin campos internos)', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' });
    const r = await request(app).get('/api/admin/orders').set(authHeader());
    const o = r.body.find((x: any) => x.id === order.id);
    expect(o).toMatchObject({
      orderNo: order.orderNo,
      customerName: 'Ana',
      customerEmail: 'ana@x.com',
      customerPhone: '11',
      address: 'Calle 1 100',
      city: 'CABA',
      paymentMethod: 'transfer',
      total: 54000, // 60000 − 10%
    });
    // H-05 fixed: el DTO ya no expone campos internos de pago/precio.
    expect(o.subtotal).toBeUndefined();
    expect(o.discount).toBeUndefined();
    expect(o.mpPaymentId).toBeUndefined();
    expect(o.mpPreferenceId).toBeUndefined();
    expect(o.items[0]).toMatchObject({ line: 'Champion Mentality', color: 'Azul Marino', size: 'M', unitPrice: 30000, qty: 2 });
  });

  it('TC-ORD-003: teléfono nulo se guarda como null (la card muestra "—")', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer: { ...customer, tel: '' }, method: 'transfer' });
    const r = await request(app).get('/api/admin/orders').set(authHeader());
    expect(r.body.find((x: any) => x.id === order.id).customerPhone).toBeNull();
  });

  it('TC-ORD-004: lista vacía → 200 [] sin crash', async () => {
    const r = await request(app).get('/api/admin/orders').set(authHeader());
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });
});

// ───────────────────────── Transiciones de estado ─────────────────────────
describe('Status transitions', () => {
  it('TC-ORD-005: pending → paid decrementa stock y dispara email; mpPaymentId=manual', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' });
    const r = await patch(order.id, 'paid');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('paid');
    expect(await stockOf(navyId, 'M')).toBe(23); // 25 − 2
    expect(r.body.mpPaymentId).toBe('manual');
    await flush();
    expect(notifyOrderPaid).toHaveBeenCalledWith(order.orderNo, 'paid');
  });

  it('TC-ORD-006: pending → shipped decrementa stock y dispara email', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' });
    const r = await patch(order.id, 'shipped');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('shipped');
    expect(await stockOf(navyId, 'M')).toBe(23);
    await flush();
    // markPaidByOrderNo recibe `to='shipped'` → el header del email muestra el estado final (H-05).
    expect(notifyOrderPaid).toHaveBeenCalledWith(order.orderNo, 'shipped');
  });

  it('TC-ORD-007: paid → shipped no cambia stock ni reenvía email', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' });
    await patch(order.id, 'paid');
    await flush();
    vi.mocked(notifyOrderPaid).mockClear();
    const r = await patch(order.id, 'shipped');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('shipped');
    expect(await stockOf(navyId, 'M')).toBe(23); // sin cambio (ambos held)
    await flush();
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it('TC-ORD-008: paid → cancelled restockea inventario', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' });
    await patch(order.id, 'paid');
    expect(await stockOf(navyId, 'M')).toBe(23);
    const r = await patch(order.id, 'cancelled');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('cancelled');
    expect(await stockOf(navyId, 'M')).toBe(25); // 23 + 2
  });

  it('TC-ORD-009: shipped → cancelled restockea inventario', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' });
    await patch(order.id, 'shipped');
    expect(await stockOf(navyId, 'M')).toBe(23);
    const r = await patch(order.id, 'cancelled');
    expect(r.status).toBe(200);
    expect(await stockOf(navyId, 'M')).toBe(25);
  });

  it('TC-ORD-010: paid → pending y shipped → pending → 422 (nunca revierte)', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, method: 'transfer' });
    await patch(order.id, 'paid');
    const r1 = await patch(order.id, 'pending');
    expect(r1.status).toBe(422);
    expect(r1.body).toEqual({ error: 'No se puede revertir un pedido pagado a pendiente' });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('paid');
    expect(await stockOf(navyId, 'M')).toBe(24); // sin cambio

    await patch(order.id, 'shipped');
    const r2 = await patch(order.id, 'pending');
    expect(r2.status).toBe(422);
  });

  it('TC-ORD-011: mismo estado es no-op (sin doble decremento, sin email)', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' });
    const r = await patch(order.id, 'pending');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('pending');
    expect(await stockOf(navyId, 'M')).toBe(25); // intacto
    await flush();
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it('TC-ORD-012: cancelled → paid re-decrementa stock', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' });
    await patch(order.id, 'paid');     // 25 → 23
    await patch(order.id, 'cancelled'); // 23 → 25
    const r = await patch(order.id, 'paid'); // 25 → 23
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('paid');
    expect(await stockOf(navyId, 'M')).toBe(23);
  });

  it('TC-ORD-013: cancelled → paid sin stock → 409, queda cancelled', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' });
    await patch(order.id, 'paid');
    await patch(order.id, 'cancelled');
    // El stock se agota entre la cancelación y el re-pago.
    await prisma.variant.updateMany({ where: { productId: navyId, size: 'M' }, data: { stock: 0 } });
    const r = await patch(order.id, 'paid');
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/Sin stock al confirmar/);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('cancelled');
    expect(await stockOf(navyId, 'M')).toBe(0); // sin oversell
  });

  it('TC-ORD-014: mark paid con stock insuficiente → 409, sin decremento parcial', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 3 }], customer, method: 'transfer' });
    await prisma.variant.updateMany({ where: { productId: navyId, size: 'M' }, data: { stock: 1 } }); // qty 3 > stock 1
    const r = await patch(order.id, 'paid');
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/Sin stock al confirmar/);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('pending');
    expect(await stockOf(navyId, 'M')).toBe(1); // exactamente igual: ni negativo ni parcial
  });

  it('TC-ORD-015: status inválido → 400 Estado inválido (varias formas)', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, method: 'transfer' });
    for (const body of [{ status: 'refunded' }, {}, { status: '' }, { status: 123 }]) {
      const r = await request(app).patch(`/api/admin/orders/${order.id}/status`).set(authHeader()).send(body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.body).toEqual({ error: 'Estado inválido' });
    }
  });

  it('TC-ORD-016: id inexistente con status válido → 404 Orden no encontrada', async () => {
    const r = await patch('does-not-exist', 'paid');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: 'Orden no encontrada' });
  });
});

// ───────────────────────── Flujos & edge cases ─────────────────────────
describe('Edge cases & flows', () => {
  it('TC-ORD-017: confirmación manual de transferencia (pending → paid, mpPaymentId=manual)', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, method: 'transfer' });
    expect(order.mpPaymentId).toBeNull();
    const r = await patch(order.id, 'paid');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('paid');
    expect(r.body.mpPaymentId).toBe('manual');
    expect(await stockOf(navyId, 'M')).toBe(24);
    await flush();
    expect(notifyOrderPaid).toHaveBeenCalledWith(order.orderNo, 'paid');
  });

  it('TC-ORD-018: producto borrado (productId NULL) — muestra snapshot y mark-paid saltea esa línea', async () => {
    const { order } = await createOrder({
      items: [
        { productId: navyId, size: 'M', qty: 2 },  // se borrará el producto → línea huérfana
        { productId: negroId, size: 'M', qty: 1 },  // línea válida, debe decrementar
      ],
      customer, method: 'transfer',
    });
    // Simula borrado del producto: el snapshot (line/color/size/qty) queda, productId → NULL.
    await prisma.orderItem.updateMany({ where: { orderId: order.id, productId: navyId }, data: { productId: null } });

    // El snapshot sigue visible en la card.
    const list = await request(app).get('/api/admin/orders').set(authHeader());
    const o = list.body.find((x: any) => x.id === order.id);
    const orphan = o.items.find((i: any) => i.productId === null);
    expect(orphan).toMatchObject({ line: 'Champion Mentality', color: 'Azul Marino', size: 'M', qty: 2 });

    const r = await patch(order.id, 'paid');
    expect(r.status).toBe(200); // sin crash, sin 409 falso
    expect(r.body.status).toBe('paid');
    expect(await stockOf(navyId, 'M')).toBe(25); // línea huérfana salteada → stock intacto
    expect(await stockOf(negroId, 'M')).toBe(24); // línea válida decrementa
  });

  it('TC-ORD-019: el total transfer ya viene con el descuento aplicado (subtotal/discount no se exponen)', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, method: 'transfer' });
    const cardOrder = (await createOrder({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, method: 'card' })).order;
    const r = await request(app).get('/api/admin/orders').set(authHeader());
    const t = r.body.find((x: any) => x.id === order.id);
    const c = r.body.find((x: any) => x.id === cardOrder.id);
    expect(t.total).toBe(27000); // transfer: 30000 − 10%
    expect(c.total).toBe(30000); // card: full
    // H-05 fixed: subtotal/discount no van en el DTO.
    expect(t.subtotal).toBeUndefined();
    expect(t.discount).toBeUndefined();
    expect(c.discount).toBeUndefined();
  });
});

// ───────────────────────── Seguridad ─────────────────────────
describe('Security', () => {
  it('TC-ORD-021: endpoints rechazan acceso no autorizado → 401 (auth precede validación)', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, method: 'transfer' });

    const getNoTok = await request(app).get('/api/admin/orders');
    expect(getNoTok.status).toBe(401);
    expect(getNoTok.body).toEqual({ error: 'No autorizado' });

    const patchNoTok = await request(app).patch(`/api/admin/orders/${order.id}/status`).send({ status: 'paid' });
    expect(patchNoTok.status).toBe(401);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('pending'); // no mutó
    expect(await stockOf(navyId, 'M')).toBe(25);

    const badTok = await request(app).get('/api/admin/orders').set('Authorization', 'Bearer garbage');
    expect(badTok.status).toBe(401);
    expect(badTok.body).toEqual({ error: 'Sesión inválida o expirada' });

    // Body inválido sin token → igual 401 (auth antes que zod).
    const patchBadBody = await request(app).patch(`/api/admin/orders/${order.id}/status`).send({ status: 'nonsense' });
    expect(patchBadBody.status).toBe(401);
  });
});
