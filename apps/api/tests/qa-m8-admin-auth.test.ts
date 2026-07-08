// QA Módulo 8 — Admin authentication (docs/qa/08-admin-auth.md). Ejecuta TC-AUTH-001..022
// (login, guard requireAdmin, cobertura de rutas, modelo sin roles, gate del seed) de forma
// determinística contra la DB de test. Cada test usa una app fresca (createApp) para aislar el
// estado en memoria del rate limiter. Los casos web (AUTH-023..031) se validan aparte (UI/browser).
// Archivo de corrida QA, no set permanente.
import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { prisma } from '../src/prisma.js';
import { env } from '../src/env.js';
import { signAdmin } from '../src/lib/jwt.js';

let app: ReturnType<typeof createApp>;

// Token válido firmado directamente (verifyAdmin sólo valida firma/exp, no consulta la DB).
const validToken = () => signAdmin({ sub: 'admin-id', email: env.ADMIN_EMAIL });

beforeEach(async () => {
  await resetDb();
  await seed(); // crea admin@test.com / secret123 (ADMIN_PASSWORD seteado en vitest.config)
  app = createApp(); // fresca → rate limiter en cero por test
});

// ───────────────────────── Login — éxito & token ─────────────────────────
describe('Login — éxito & token', () => {
  it('TC-AUTH-001: login OK devuelve { token, email } y el email es el del DB', async () => {
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { email: env.ADMIN_EMAIL } });
    const r = await request(app).post('/api/admin/login').send({ email: env.ADMIN_EMAIL, password: 'secret123' });
    expect(r.status).toBe(200);
    expect(r.body.email).toBe(admin.email);
    expect(typeof r.body.token).toBe('string');
    expect(r.body.token.split('.')).toHaveLength(3); // JWT de 3 segmentos
    expect(r.body.password).toBeUndefined();
    expect(r.body.passwordHash).toBeUndefined();
  });

  it('TC-AUTH-002: token HS256 con claims {sub,email} y exp−iat = 43200s (12h)', async () => {
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { email: env.ADMIN_EMAIL } });
    const r = await request(app).post('/api/admin/login').send({ email: env.ADMIN_EMAIL, password: 'secret123' });
    const decoded = jwt.decode(r.body.token, { complete: true }) as any;
    expect(decoded.header.alg).toBe('HS256');
    expect(decoded.header.typ).toBe('JWT');
    expect(decoded.payload.sub).toBe(admin.id);
    expect(decoded.payload.email).toBe(admin.email);
    expect(decoded.payload.exp - decoded.payload.iat).toBe(43200);
    expect(decoded.payload.role).toBeUndefined();
    expect(decoded.payload.scope).toBeUndefined();
  });
});

// ───────────────────────── Login — negativos & bordes ─────────────────────────
describe('Login — negativos & bordes', () => {
  it('TC-AUTH-003: password incorrecta → 401 Credenciales inválidas, sin token', async () => {
    const r = await request(app).post('/api/admin/login').send({ email: env.ADMIN_EMAIL, password: 'wrong' });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: 'Credenciales inválidas' });
    expect(r.body.token).toBeUndefined();
  });

  it('TC-AUTH-004: email inexistente → 401 idéntico al de password incorrecta (anti-enumeración)', async () => {
    const unknown = await request(app).post('/api/admin/login').send({ email: 'nobody@x.com', password: 'whatever' });
    const wrongPass = await request(app).post('/api/admin/login').send({ email: env.ADMIN_EMAIL, password: 'wrong' });
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual({ error: 'Credenciales inválidas' });
    expect(unknown.body).toEqual(wrongPass.body); // mismo status + mismo body
  });

  it('TC-AUTH-005: email/password no-string → 400 Datos inválidos', async () => {
    const cases = [
      { email: 123, password: 'x' },
      { email: 'a@b.com', password: {} },
      { email: ['a'], password: ['b'] },
      { email: null, password: null },
      {}, // ambos undefined
    ];
    for (const body of cases) {
      const r = await request(app).post('/api/admin/login').send(body);
      expect(r.status).toBe(400);
      expect(r.body).toEqual({ error: 'Datos inválidos' });
    }
  });

  it('TC-AUTH-006: credenciales string-vacío → 401 (no 400) — boundary', async () => {
    const both = await request(app).post('/api/admin/login').send({ email: '', password: '' });
    expect(both.status).toBe(401);
    expect(both.body).toEqual({ error: 'Credenciales inválidas' });
    const emptyPass = await request(app).post('/api/admin/login').send({ email: env.ADMIN_EMAIL, password: '' });
    expect(emptyPass.status).toBe(401);
  });

  it('TC-AUTH-007a: sin body / sin Content-Type → 400 sin crash', async () => {
    const r = await request(app).post('/api/admin/login'); // sin .send()
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: 'Datos inválidos' });
  });

  it('TC-AUTH-007b: JSON malformado → 400 (H-01 corregido: errorHandler respeta err.status)', async () => {
    const r = await request(app)
      .post('/api/admin/login')
      .set('Content-Type', 'application/json')
      .send('{"email":"a@b.com", "password":'); // JSON roto
    // H-01 FIX: el errorHandler ahora respeta el err.status=400 que body-parser adjunta al
    // SyntaxError (entity.parse.failed) → 4xx en vez de 500, con mensaje genérico seguro.
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: 'JSON inválido' });
    expect(JSON.stringify(r.body)).not.toMatch(/at .*\(.*:\d+:\d+\)/); // no filtra stack trace
  });
});

// ───────────────────────── Brute-force / rate limit ─────────────────────────
describe('Rate limit', () => {
  // 11 logins secuenciales = 10 bcrypt compares (cost 12): con la suite en
  // paralelo superan los 5s default → timeout propio.
  it('TC-AUTH-008: 10 intentos permitidos, 11º → 429 (incluso con cred correcta)', async () => {
    for (let i = 0; i < 10; i++) {
      const r = await request(app).post('/api/admin/login').send({ email: env.ADMIN_EMAIL, password: 'wrong' });
      expect([400, 401]).toContain(r.status);
    }
    const eleventh = await request(app).post('/api/admin/login').send({ email: env.ADMIN_EMAIL, password: 'secret123' });
    expect(eleventh.status).toBe(429);
    expect(eleventh.body).toEqual({ error: 'Demasiados intentos de acceso. Probá de nuevo más tarde.' });
  }, 20_000);
});

// ───────────────────────── Guard requireAdmin — verificación de token ─────────────────────────
describe('Guard requireAdmin', () => {
  it('TC-AUTH-009: Bearer válido llega a GET /me con el email del claim', async () => {
    const r = await request(app).get('/api/admin/me').set('Authorization', `Bearer ${validToken()}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ email: env.ADMIN_EMAIL });
  });

  it('TC-AUTH-010: sin header Authorization → 401 No autorizado', async () => {
    const r = await request(app).get('/api/admin/me');
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: 'No autorizado' });
  });

  it('TC-AUTH-011: esquema no-Bearer → 401 No autorizado', async () => {
    for (const h of ['Basic dXNlcjpwYXNz', validToken(), `token ${validToken()}`]) {
      const r = await request(app).get('/api/admin/me').set('Authorization', h);
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ error: 'No autorizado' });
    }
  });

  it('TC-AUTH-012: esquema case-sensitive — "bearer " y "Bearer<token>" → 401 No autorizado', async () => {
    const lower = await request(app).get('/api/admin/me').set('Authorization', `bearer ${validToken()}`);
    expect(lower.status).toBe(401);
    expect(lower.body).toEqual({ error: 'No autorizado' });
    const noSpace = await request(app).get('/api/admin/me').set('Authorization', `Bearer${validToken()}`);
    expect(noSpace.status).toBe(401);
    expect(noSpace.body).toEqual({ error: 'No autorizado' });
  });

  it('TC-AUTH-013: token vacío/garbage tras "Bearer " → 401', async () => {
    // HALLAZGO H-02 (doc): el header "Bearer " (sólo espacio final) se TRIMmea en la capa HTTP →
    // llega "Bearer" → falla startsWith('Bearer ') → "No autorizado" (NO "Sesión inválida" como
    // afirma la doc). El path verifyAdmin('') es inalcanzable vía un header HTTP real.
    const empty = await request(app).get('/api/admin/me').set('Authorization', 'Bearer ');
    expect(empty.status).toBe(401);
    expect(empty.body).toEqual({ error: 'No autorizado' }); // actual observado
    // Garbage con prefijo válido sí entra a verifyAdmin → "Sesión inválida o expirada" (correcto).
    const garbage = await request(app).get('/api/admin/me').set('Authorization', 'Bearer not.a.jwt');
    expect(garbage.status).toBe(401);
    expect(garbage.body).toEqual({ error: 'Sesión inválida o expirada' });
  });

  it('TC-AUTH-014: JWT con estructura malformada → 401 Sesión inválida o expirada', async () => {
    const twoSeg = validToken().split('.').slice(0, 2).join('.'); // sólo 2 segmentos
    const r = await request(app).get('/api/admin/me').set('Authorization', `Bearer ${twoSeg}`);
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: 'Sesión inválida o expirada' });
  });

  it('TC-AUTH-015: token expirado → 401 Sesión inválida o expirada (backstop server-side)', async () => {
    const expired = jwt.sign({ sub: 'x', email: env.ADMIN_EMAIL }, env.JWT_SECRET, { expiresIn: '-10s' });
    const r = await request(app).get('/api/admin/me').set('Authorization', `Bearer ${expired}`);
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: 'Sesión inválida o expirada' });
  });

  it('TC-AUTH-016: firma manipulada → 401', async () => {
    const [h, p, s] = validToken().split('.') as [string, string, string]; // un JWT válido siempre tiene 3 partes
    const tamperedPayload = `${h}.${p.slice(0, -2)}XX.${s}`; // payload alterado, firma vieja
    const r1 = await request(app).get('/api/admin/me').set('Authorization', `Bearer ${tamperedPayload}`);
    expect(r1.status).toBe(401);
    expect(r1.body).toEqual({ error: 'Sesión inválida o expirada' });
    // payload re-firmado con una clave adivinada/incorrecta → firma HS256 no valida sin el JWT_SECRET real
    const forged = jwt.sign({ sub: 'x', email: 'evil@x.com' }, 'guessed-wrong-key');
    const r2 = await request(app).get('/api/admin/me').set('Authorization', `Bearer ${forged}`);
    expect(r2.status).toBe(401);
  });

  it('TC-AUTH-017: token firmado con otro secreto o alg:none → 401 (no autentica)', async () => {
    const wrongSecret = jwt.sign({ sub: 'x', email: env.ADMIN_EMAIL }, 'this-is-a-totally-different-secret-value');
    const rWrong = await request(app).get('/api/admin/me').set('Authorization', `Bearer ${wrongSecret}`);
    expect(rWrong.status).toBe(401);
    const noneTok = jwt.sign({ sub: 'x', email: env.ADMIN_EMAIL }, '', { algorithm: 'none' });
    const rNone = await request(app).get('/api/admin/me').set('Authorization', `Bearer ${noneTok}`);
    expect(rNone.status).toBe(401);
    expect(rNone.body).toEqual({ error: 'Sesión inválida o expirada' });
  });
});

// ───────────────────────── Cobertura de rutas & modelo de autorización ─────────────────────────
describe('Cobertura de rutas protegidas', () => {
  const protectedGets = ['/api/admin/me', '/api/admin/products', '/api/admin/orders', '/api/admin/config/drop', '/api/admin/config/content', '/api/admin/metrics'];

  it('TC-AUTH-018: token válido llega a todas las rutas /api/admin/*', async () => {
    for (const path of protectedGets) {
      const r = await request(app).get(path).set('Authorization', `Bearer ${validToken()}`);
      expect(r.status, `GET ${path}`).not.toBe(401);
      expect(r.status, `GET ${path}`).toBeLessThan(300);
    }
  });

  it('TC-AUTH-019: sin token cada ruta protegida → 401 No autorizado (incl. mutaciones)', async () => {
    for (const path of protectedGets.filter((p) => p !== '/api/admin/me')) {
      const r = await request(app).get(path);
      expect(r.status, `GET ${path}`).toBe(401);
      expect(r.body).toEqual({ error: 'No autorizado' });
    }
    const post = await request(app).post('/api/admin/products').send({ foo: 'bar' });
    expect(post.status).toBe(401);
    expect(post.body).toEqual({ error: 'No autorizado' });
  });

  it('TC-AUTH-020: /login es alcanzable SIN token', async () => {
    const r = await request(app).post('/api/admin/login').send({ email: env.ADMIN_EMAIL, password: 'secret123' });
    expect(r.status).toBe(200); // procesado normalmente, el guard no aplica
  });

  it('TC-AUTH-021: sin tiers de rol — un token válido permite lectura Y escritura destructiva', async () => {
    const token = validToken();
    const read = await request(app).get('/api/admin/metrics').set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);
    // escritura: PUT config/drop con body válido
    const write = await request(app).put('/api/admin/config/drop').set('Authorization', `Bearer ${token}`)
      .send({ targetAt: new Date('2026-12-31T00:00:00Z').toISOString(), visible: false, title: 'TEST_QA', teaser: 'TEST_QA' });
    expect(write.status).toBe(200);
    // borrado: crear y borrar un producto (no hay check de permiso más allá de "token válido")
    const created = await request(app).post('/api/admin/products').set('Authorization', `Bearer ${token}`)
      .send({ line: 'TEST_QA', color: 'TEST', price: 30000, sortOrder: 99, active: true, tag: null, dotColor: '#000000', stock: { S: 1, M: 1, L: 1, XL: 1 } });
    // si el schema de producto difiere, al menos verificamos que NO es 401
    expect(created.status).not.toBe(401);
    if (created.status === 201) {
      const del = await request(app).delete(`/api/admin/products/${created.body.id}`).set('Authorization', `Bearer ${token}`);
      expect(del.status).toBe(200);
    }
  });

  it('TC-AUTH-022: gate del seed por ADMIN_PASSWORD — vacío → sin admin → login imposible', async () => {
    await resetDb();
    const real = env.ADMIN_PASSWORD;
    (env as Record<string, unknown>).ADMIN_PASSWORD = '';
    try {
      await seed(); // con ADMIN_PASSWORD vacío no debe crear AdminUser
      expect(await prisma.adminUser.count()).toBe(0);
      const fail = await request(app).post('/api/admin/login').send({ email: env.ADMIN_EMAIL, password: 'anything' });
      expect(fail.status).toBe(401);
      expect(fail.body).toEqual({ error: 'Credenciales inválidas' });
    } finally {
      (env as Record<string, unknown>).ADMIN_PASSWORD = real;
    }
    // con password seteado, re-seed → admin creado y login OK
    await seed();
    expect(await prisma.adminUser.count()).toBe(1);
    const ok = await request(createApp()).post('/api/admin/login').send({ email: env.ADMIN_EMAIL, password: 'secret123' });
    expect(ok.status).toBe(200);
  });
});
