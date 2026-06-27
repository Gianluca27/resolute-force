import { beforeEach, it, expect, vi } from 'vitest';
vi.mock('../src/services/notify.js', () => ({ notifyOrderPaid: vi.fn().mockResolvedValue(undefined), notifyTransferOrder: vi.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import { prisma } from '../src/prisma.js';
import { createOrder } from '../src/services/orders.js';

const app = createApp();
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', dir: 'Calle 1', ciudad: 'CABA' };
beforeEach(async () => { await resetDb(); await seed(); });

it('lists orders and marks a transfer order paid (decrementing stock)', async () => {
  const navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
  const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' });
  const list = await request(app).get('/api/admin/orders').set(authHeader());
  expect(list.body).toHaveLength(1);
  const patched = await request(app).patch(`/api/admin/orders/${order.id}/status`).set(authHeader()).send({ status: 'paid' });
  expect(patched.body.status).toBe('paid');
  const v = await prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } });
  expect(v.stock).toBe(23);
});

it('updates drop and content config', async () => {
  const drop = await request(app).put('/api/admin/config/drop').set(authHeader()).send({ targetAt: '2027-01-01T00:00:00-03:00', visible: false, title: 'X', teaser: 'Y' });
  expect(drop.body.visible).toBe(false);
  const content = await request(app).put('/api/admin/config/content').set(authHeader()).send({
    marquee: ['Uno', 'Dos'], heroKicker: 'k', heroTitle1: 'a', heroTitle2: 'b', heroSubtitle: 's', transferDiscountPct: 15, bankAlias: 'rf.alias', bankCbu: '00011122', contactWhatsapp: '549', contactInstagram: '@x', contactEmail: 'a@b.com', contactLocation: 'BA',
  });
  expect(content.body.transferDiscountPct).toBe(15);
  expect((await request(app).get('/api/content')).body.bankAlias).toBe('rf.alias');
});
