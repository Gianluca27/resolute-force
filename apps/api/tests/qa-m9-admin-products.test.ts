import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/cloudinary.js', () => ({
  uploadImage: vi.fn().mockResolvedValue({ url: 'https://cdn/x.png', publicId: 'rf/x' }),
  deleteImage: vi.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';

const app = createApp();
const base = { line: 'L', color: 'C', dotColor: '#101013', price: 1000, active: true, sortOrder: 0, sizes: [{ size: 'M', stock: 1 }] };
const create = (over: Record<string, unknown> = {}) =>
  request(app).post('/api/admin/products').set(authHeader()).send({ slug: 'm9-prod', ...base, ...over });

beforeEach(async () => { await resetDb(); await seed(); });

describe('QA M9 — admin products fixes', () => {
  // H-02: duplicate slug → 409 friendly, never a raw 500 / Prisma leak (also covers H-05).
  it('H-02/H-05: duplicate slug returns 409 with a safe message', async () => {
    await create({ slug: 'dup-slug' });
    const res = await create({ slug: 'dup-slug' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/slug/i);
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|adminProducts\.ts|invocation/i);
  });

  // H-04: PUT/DELETE on an unknown id → 404, not 500.
  it('H-04: PUT to unknown id returns 404', async () => {
    const res = await request(app).put('/api/admin/products/does-not-exist').set(authHeader()).send({ slug: 'x', ...base });
    expect(res.status).toBe(404);
  });
  it('H-04: DELETE of unknown id returns 404', async () => {
    const res = await request(app).delete('/api/admin/products/does-not-exist').set(authHeader());
    expect(res.status).toBe(404);
  });

  // H-01: optimistic concurrency — a stale token is rejected; the current token (or none) succeeds.
  it('H-01: stale expectedUpdatedAt is rejected with 409', async () => {
    const c = await create({ slug: 'opt-lock' });
    const id = c.body.id;
    const stale = '2000-01-01T00:00:00.000Z';
    const res = await request(app).put(`/api/admin/products/${id}`).set(authHeader())
      .send({ slug: 'opt-lock', ...base, price: 2000, expectedUpdatedAt: stale });
    expect(res.status).toBe(409);
  });
  it('H-01: current expectedUpdatedAt succeeds; omitting it stays backward-compatible', async () => {
    const c = await create({ slug: 'opt-lock2' });
    const id = c.body.id;
    const ok = await request(app).put(`/api/admin/products/${id}`).set(authHeader())
      .send({ slug: 'opt-lock2', ...base, price: 3000, expectedUpdatedAt: c.body.updatedAt });
    expect(ok.status).toBe(200);
    expect(ok.body.price).toBe(3000);
    const noToken = await request(app).put(`/api/admin/products/${id}`).set(authHeader())
      .send({ slug: 'opt-lock2', ...base, price: 4000 });
    expect(noToken.status).toBe(200);
  });

  // H-07: blank/whitespace tag normalizes to null regardless of client.
  it('H-07: empty tag is stored as null', async () => {
    const a = await create({ slug: 'tag-empty', tag: '' });
    expect(a.body.tag).toBeNull();
    const b = await create({ slug: 'tag-ws', tag: '   ' });
    expect(b.body.tag).toBeNull();
  });

  // H-09: oversized string fields are rejected.
  it('H-09: a 200-char slug is rejected with 400', async () => {
    const res = await create({ slug: 'a'.repeat(200) });
    expect(res.status).toBe(400);
  });

  // H-08: an image over the 6MB limit returns 413, not 500.
  it('H-08: oversized image returns 413', async () => {
    const c = await create({ slug: 'big-img' });
    const big = Buffer.alloc(6 * 1024 * 1024 + 1, 1);
    const res = await request(app).post(`/api/admin/products/${c.body.id}/image`).set(authHeader())
      .attach('image', big, 'big.png');
    expect(res.status).toBe(413);
  });
});
