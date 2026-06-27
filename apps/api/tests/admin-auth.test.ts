import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';

const app = createApp();
beforeEach(async () => { await resetDb(); await seed(); });

describe('admin auth', () => {
  it('logs in with the seeded admin and rejects bad passwords', async () => {
    const ok = await request(app).post('/api/admin/login').send({ email: 'admin@test.com', password: 'secret123' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    const bad = await request(app).post('/api/admin/login').send({ email: 'admin@test.com', password: 'wrong' });
    expect(bad.status).toBe(401);
  });

  it('guards /me — 401 without token, 200 with', async () => {
    expect((await request(app).get('/api/admin/me')).status).toBe(401);
    const res = await request(app).get('/api/admin/me').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@test.com');
  });

  it('rejects a tampered / malformed bearer token', async () => {
    expect((await request(app).get('/api/admin/me').set({ Authorization: 'Bearer not.a.valid.jwt' })).status).toBe(401);
    expect((await request(app).get('/api/admin/me').set({ Authorization: 'Basic abc' })).status).toBe(401);
  });
});
