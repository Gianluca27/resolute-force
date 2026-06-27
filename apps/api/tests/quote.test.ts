import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';
import { prisma } from '../src/prisma';

const app = createApp();
let navyId = '';
beforeAll(async () => {
  await resetDb();
  await seed();
  navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
});

describe('POST /api/checkout/quote', () => {
  it('recomputes totals from the DB (ignores any client price)', async () => {
    const res = await request(app).post('/api/checkout/quote').send({ items: [{ productId: navyId, size: 'M', qty: 2 }] });
    expect(res.status).toBe(200);
    expect(res.body.subtotal).toBe(60000);
    expect(res.body.transferDiscount).toBe(6000);
    expect(res.body.totalTransfer).toBe(54000);
    expect(res.body.totalCard).toBe(60000);
    expect(res.body.lines[0].unitPrice).toBe(30000);
  });

  it('ignores a forged client price and re-prices strictly from the DB', async () => {
    // Attacker sends price:1 / unitPrice:1 — the server must discard them and use the catalog price.
    const res = await request(app).post('/api/checkout/quote').send({ items: [{ productId: navyId, size: 'M', qty: 1, price: 1, unitPrice: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.subtotal).toBe(30000);
    expect(res.body.lines[0].unitPrice).toBe(30000);
  });

  it('400s on a malformed body', async () => {
    const res = await request(app).post('/api/checkout/quote').send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('409s when stock is insufficient', async () => {
    const res = await request(app).post('/api/checkout/quote').send({ items: [{ productId: navyId, size: 'M', qty: 999 }] });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/stock/i);
  });

  it('200s when the size is valid and in stock', async () => {
    const res = await request(app).post('/api/checkout/quote').send({ items: [{ productId: navyId, size: 'S', qty: 1 }] });
    expect(res.status).toBe(200);
  });

  it('400s on an unknown size (not in enum)', async () => {
    const res = await request(app).post('/api/checkout/quote').send({ items: [{ productId: navyId, size: 'XXS', qty: 1 }] });
    expect(res.status).toBe(400);
  });

  it('409s when the requested size has no variant', async () => {
    // Create a product with only M variant — no 'S' stock
    const p = await prisma.product.create({ data: { slug: 'test-no-s', line: 'Test', color: 'Test', dotColor: '#000', price: 10000, imageUrl: '/x.png', sortOrder: 99, active: true } });
    await prisma.variant.create({ data: { productId: p.id, size: 'M', stock: 5 } });
    const res = await request(app).post('/api/checkout/quote').send({ items: [{ productId: p.id, size: 'S', qty: 1 }] });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/talle/i);
    await prisma.variant.deleteMany({ where: { productId: p.id } });
    await prisma.product.delete({ where: { id: p.id } });
  });
});
