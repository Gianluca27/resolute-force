import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';

const app = createApp();
beforeAll(async () => { await resetDb(); await seed(); });

describe('GET /api/drop', () => {
  it('returns ISO targetAt, visible flag, title, teaser', async () => {
    const res = await request(app).get('/api/drop');
    expect(res.status).toBe(200);
    expect(res.body.visible).toBe(true);
    expect(new Date(res.body.targetAt).getUTCFullYear()).toBe(2026);
    expect(res.body.title).toMatch(/forjando/i);
  });
});

describe('GET /api/content', () => {
  it('returns marquee array and contact info', async () => {
    const res = await request(app).get('/api/content');
    expect(res.status).toBe(200);
    expect(res.body.marquee).toContain('Champion Mentality');
    expect(res.body.contactInstagram).toBe('@resolute.force');
    expect(res.body.transferDiscountPct).toBe(10);
  });
});
