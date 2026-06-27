import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { resetDb } from './helpers/db.js';

const app = createApp();
beforeEach(async () => { await resetDb(); });

describe('admin login rate limiting', () => {
  it('returns 429 after too many login attempts from the same client', async () => {
    const attempt = () => request(app).post('/api/admin/login').send({ email: 'attacker@x.com', password: 'guess' });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await attempt()).status);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    expect(statuses[statuses.length - 1]).toBe(429);
  });
});
