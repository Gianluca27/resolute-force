import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/cloudinary.js', () => ({ uploadImage: vi.fn().mockResolvedValue({ url: 'https://cdn/x.png', publicId: 'rf/x' }), deleteImage: vi.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';

const app = createApp();
beforeEach(async () => { await resetDb(); await seed(); });

describe('admin products', () => {
  it('requires auth', async () => {
    expect((await request(app).get('/api/admin/products')).status).toBe(401);
  });

  it('creates, lists, updates stock, uploads image, deletes', async () => {
    const create = await request(app).post('/api/admin/products').set(authHeader()).send({
      slug: 'pressure-hoodie-negro', line: 'Pressure', color: 'Negro', dotColor: '#101013', tag: 'Nuevo', price: 52000, active: true, sortOrder: 9,
      sizes: [{ size: 'M', stock: 10 }, { size: 'L', stock: 4 }],
    });
    expect(create.status).toBe(201);
    const id = create.body.id;
    expect(create.body.sizes).toHaveLength(2);

    const list = await request(app).get('/api/admin/products').set(authHeader());
    expect(list.body.some((p: { id: string }) => p.id === id)).toBe(true);

    const upd = await request(app).put(`/api/admin/products/${id}`).set(authHeader()).send({
      slug: 'pressure-hoodie-negro', line: 'Pressure', color: 'Negro', dotColor: '#101013', tag: null, price: 55000, active: false, sortOrder: 9,
      sizes: [{ size: 'M', stock: 99 }],
    });
    expect(upd.body.price).toBe(55000);
    expect(upd.body.sizes.find((s: { size: string }) => s.size === 'M').stock).toBe(99);

    const img = await request(app).post(`/api/admin/products/${id}/image`).set(authHeader()).attach('image', Buffer.from('fake'), 'p.png');
    expect(img.body.imageUrl).toBe('https://cdn/x.png');

    expect((await request(app).delete(`/api/admin/products/${id}`).set(authHeader())).body.ok).toBe(true);
  });

  it('rejects a non-image file upload', async () => {
    const create = await request(app).post('/api/admin/products').set(authHeader()).send({
      slug: 'img-guard', line: 'L', color: 'C', dotColor: '#101013', price: 1000, active: true, sortOrder: 0, sizes: [{ size: 'M', stock: 1 }],
    });
    const res = await request(app).post(`/api/admin/products/${create.body.id}/image`).set(authHeader()).attach('image', Buffer.from('not an image'), 'malware.txt');
    expect(res.status).toBe(400);
  });
});
