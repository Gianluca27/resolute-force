import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { DEFAULT_PAGE_DESIGN, type PageDesignDoc } from '@resolute/shared';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';

const app = createApp();
beforeEach(async () => { await resetDb(); await seed(); });

const editedDoc = (): PageDesignDoc => {
  const doc: PageDesignDoc = JSON.parse(JSON.stringify(DEFAULT_PAGE_DESIGN));
  doc.theme.colors.accent = '#3366ff';
  doc.sections = [...doc.sections].reverse();
  return doc;
};

describe('GET /api/page-design (public)', () => {
  it('returns the published document seeded from defaults + SiteContent', async () => {
    const res = await request(app).get('/api/page-design');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(res.body.theme.colors.accent).toBe('#e4322b');
    const hero = res.body.sections.find((s: { type: string }) => s.type === 'hero');
    expect(hero.props.title1).toBe('Champion'); // carried over from SiteContent seed
  });
});

describe('admin /api/admin/page-design', () => {
  it('rejects unauthenticated access', async () => {
    expect((await request(app).get('/api/admin/page-design')).status).toBe(401);
    expect((await request(app).put('/api/admin/page-design').send({})).status).toBe(401);
    expect((await request(app).post('/api/admin/page-design/publish')).status).toBe(401);
    expect((await request(app).post('/api/admin/uploads')).status).toBe(401);
  });

  it('saves a draft without touching the published doc, then publishes atomically', async () => {
    const put = await request(app).put('/api/admin/page-design').set(authHeader()).send({ doc: editedDoc() });
    expect(put.status).toBe(200);
    expect(put.body.dirty).toBe(true);
    expect(put.body.draft.theme.colors.accent).toBe('#3366ff');

    // public still sees the old published version
    const pub = await request(app).get('/api/page-design');
    expect(pub.body.theme.colors.accent).toBe('#e4322b');

    const published = await request(app).post('/api/admin/page-design/publish').set(authHeader());
    expect(published.body.dirty).toBe(false);
    const pub2 = await request(app).get('/api/page-design');
    expect(pub2.body.theme.colors.accent).toBe('#3366ff');
  });

  it('discard restores the draft from the published doc', async () => {
    await request(app).put('/api/admin/page-design').set(authHeader()).send({ doc: editedDoc() });
    const res = await request(app).post('/api/admin/page-design/discard').set(authHeader());
    expect(res.body.dirty).toBe(false);
    expect(res.body.draft.theme.colors.accent).toBe('#e4322b');
  });

  it('rejects a stale optimistic-lock token with 409', async () => {
    const current = await request(app).get('/api/admin/page-design').set(authHeader());
    await request(app).put('/api/admin/page-design').set(authHeader()).send({ doc: editedDoc() });
    const stale = await request(app)
      .put('/api/admin/page-design').set(authHeader())
      .send({ doc: editedDoc(), updatedAt: current.body.updatedAt });
    expect(stale.status).toBe(409);
  });

  it('rejects malformed documents with 400', async () => {
    const badType = { ...editedDoc(), sections: [{ id: 'x', type: 'nope', visible: true, props: {} }] };
    expect((await request(app).put('/api/admin/page-design').set(authHeader()).send({ doc: badType })).status).toBe(400);

    const badColor = editedDoc();
    (badColor.theme.colors as Record<string, string>).accent = 'rojo';
    expect((await request(app).put('/api/admin/page-design').set(authHeader()).send({ doc: badColor })).status).toBe(400);

    expect((await request(app).put('/api/admin/page-design').set(authHeader()).send({})).status).toBe(400);
  });

  it('rejects an upload without a file', async () => {
    const res = await request(app).post('/api/admin/uploads').set(authHeader());
    expect(res.status).toBe(400);
  });
});
