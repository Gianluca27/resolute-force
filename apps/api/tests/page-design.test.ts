import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { DEFAULT_PAGE_DESIGN, type PageDesignDoc } from '@resolute/shared';
import { createApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';
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

describe('lazy init when the row is missing (fresh prod deploy, seed never ran)', () => {
  beforeEach(async () => { await prisma.pageDesign.deleteMany(); });

  it('admin GET creates the row from defaults + SiteContent instead of 500', async () => {
    const res = await request(app).get('/api/admin/page-design').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.dirty).toBe(false);
    expect(res.body.draft.version).toBe(1);
    const hero = res.body.draft.sections.find((s: { type: string }) => s.type === 'hero');
    expect(hero.props.title1).toBe('Champion'); // carried over from SiteContent
  });

  it('public GET also self-heals', async () => {
    const res = await request(app).get('/api/page-design');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
  });
});

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

describe('version history /api/admin/page-design/versions', () => {
  it('rejects unauthenticated access', async () => {
    expect((await request(app).get('/api/admin/page-design/versions')).status).toBe(401);
    expect((await request(app).post('/api/admin/page-design/versions/1/restore')).status).toBe(401);
  });

  it('each publish snapshots a version, listed newest first', async () => {
    await request(app).post('/api/admin/page-design/publish').set(authHeader());
    await request(app).put('/api/admin/page-design').set(authHeader()).send({ doc: editedDoc() });
    await request(app).post('/api/admin/page-design/publish').set(authHeader());

    const res = await request(app).get('/api/admin/page-design/versions').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.versions).toHaveLength(2);
    expect(res.body.versions[0].id).toBeGreaterThan(res.body.versions[1].id);
    expect(typeof res.body.versions[0].publishedAt).toBe('string');
    // list is light — no full docs over the wire
    expect(res.body.versions[0].doc).toBeUndefined();
  });

  it('restore copies the version into the draft without touching published', async () => {
    await request(app).post('/api/admin/page-design/publish').set(authHeader()); // v1: accent default
    await request(app).put('/api/admin/page-design').set(authHeader()).send({ doc: editedDoc() });
    await request(app).post('/api/admin/page-design/publish').set(authHeader()); // v2: accent #3366ff

    const list = await request(app).get('/api/admin/page-design/versions').set(authHeader());
    const oldest = list.body.versions[1];

    const res = await request(app).post(`/api/admin/page-design/versions/${oldest.id}/restore`).set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.draft.theme.colors.accent).toBe('#e4322b'); // draft = v1 again
    expect(res.body.dirty).toBe(true); // published untouched (still v2)

    const pub = await request(app).get('/api/page-design');
    expect(pub.body.theme.colors.accent).toBe('#3366ff');
  });

  it('unknown version id → 404', async () => {
    const res = await request(app).post('/api/admin/page-design/versions/99999/restore').set(authHeader());
    expect(res.status).toBe(404);
  });

  it('keeps at most 20 versions', async () => {
    for (let i = 0; i < 22; i++) {
      const doc = editedDoc();
      doc.theme.shapes.radius = i % 24;
      await request(app).put('/api/admin/page-design').set(authHeader()).send({ doc });
      await request(app).post('/api/admin/page-design/publish').set(authHeader());
    }
    const res = await request(app).get('/api/admin/page-design/versions').set(authHeader());
    expect(res.body.versions).toHaveLength(20);
  });
});
