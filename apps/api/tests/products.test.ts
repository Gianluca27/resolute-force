import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';

const app = createApp();
beforeAll(async () => { await resetDb(); await seed(); });

describe('GET /api/products', () => {
  it('returns 4 products by sortOrder, each with ordered sizes + stock', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body[0].color).toBe('Azul Marino');
    expect(res.body[0].price).toBe(30000);
    expect(res.body[0].sizes.map((s: { size: string }) => s.size)).toEqual(['S', 'M', 'L', 'XL']);
  });
});

describe('GET /api/products/:slug', () => {
  it('returns one product', async () => {
    const res = await request(app).get('/api/products/champion-mentality-negro');
    expect(res.status).toBe(200);
    expect(res.body.color).toBe('Negro');
  });
  it('404s on unknown slug', async () => {
    const res = await request(app).get('/api/products/nope');
    expect(res.status).toBe(404);
  });
});
