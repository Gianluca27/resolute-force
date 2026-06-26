# M6 — Admin Panel: Auth, Products/Cloudinary, Drop, Content, Orders, Metrics

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`. Read the master file first (Global Constraints: admin routes JWT-protected; secrets server-only). Requires M5 (`git tag m5-emails`). This is the final milestone.

**Goal:** A protected `/admin` SPA backed by JWT-authenticated APIs: manage products (CRUD + per-size stock + Cloudinary photo upload), configure the drop countdown and site content, view/advance orders, and a **metrics dashboard** (revenue, orders by status, units sold, top products, 30-day revenue, low stock, visits, conversion) fed by lightweight visit tracking.

**Architecture:** `POST /api/admin/login` issues a 12h JWT (bcrypt-checked). All other `/api/admin/*` routes sit behind `requireAdmin`. Product photos upload through multer (memory) → Cloudinary. Marking a transfer order `paid` reuses `markPaidByOrderNo` (stock + emails). The web admin stores the token in a Zustand store and guards routes with `ProtectedRoute`.

**Tech Stack:** jsonwebtoken, bcryptjs, multer, cloudinary (api) · Zustand, React Router (web).

**Deliverable:** Log in at `/admin`, manage catalog/drop/content/orders, see live metrics. All tests green (Cloudinary/MP/mailer mocked).

---

### Task 1: Admin auth (JWT + bcrypt), seed admin, middleware, login/me

**Files:**
- Modify: `apps/api/src/env.ts`, `apps/api/vitest.config.ts`, `apps/api/prisma/seed.ts`, `apps/api/package.json`, `apps/api/src/app.ts`
- Create: `apps/api/src/lib/jwt.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/routes/admin/index.ts`, `apps/api/tests/helpers/auth.ts`
- Test: `apps/api/tests/admin-auth.test.ts`

**Interfaces:**
- Produces: `signAdmin(claims)`, `verifyAdmin(token)`, `requireAdmin` middleware, `adminToken()` test helper, `POST /api/admin/login`, `GET /api/admin/me`.

- [ ] **Step 1: Install auth deps**

```bash
npm install --workspace @resolute/api jsonwebtoken@^9.0.2 bcryptjs@^2.4.3
npm install --workspace @resolute/api -D @types/jsonwebtoken@^9.0.7 @types/bcryptjs@^2.4.6
```

- [ ] **Step 2: Extend `apps/api/src/env.ts`** (admin + cloudinary; add to schema)

```ts
  ADMIN_EMAIL: z.string().default('admin@resoluteforce.com'),
  ADMIN_PASSWORD: z.string().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
```

- [ ] **Step 3: Add admin creds to test env in `apps/api/vitest.config.ts`**

```ts
    env: { DATABASE_URL: 'file:./test.db', NODE_ENV: 'test', ADMIN_NOTIFY_EMAIL: 'admin@test.com', ADMIN_EMAIL: 'admin@test.com', ADMIN_PASSWORD: 'secret123' },
```

- [ ] **Step 4: Extend `apps/api/prisma/seed.ts`** to seed the admin (add imports + block before the `isMain` runner)

```ts
import bcrypt from 'bcryptjs';
import { env } from '../src/env';
// …inside seed(), after the siteContent upsert:
  if (env.ADMIN_PASSWORD) {
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
    await prisma.adminUser.upsert({ where: { email: env.ADMIN_EMAIL }, update: { passwordHash }, create: { email: env.ADMIN_EMAIL, passwordHash } });
  }
```

- [ ] **Step 5: Write `apps/api/src/lib/jwt.ts`**

```ts
import jwt from 'jsonwebtoken';
import { env } from '../env';

export interface AdminClaims { sub: string; email: string; }
export function signAdmin(claims: AdminClaims): string { return jwt.sign(claims, env.JWT_SECRET, { expiresIn: '12h' }); }
export function verifyAdmin(token: string): AdminClaims { return jwt.verify(token, env.JWT_SECRET) as AdminClaims; }
```

- [ ] **Step 6: Write `apps/api/src/middleware/auth.ts`**

```ts
import type { Request, Response, NextFunction } from 'express';
import { verifyAdmin, type AdminClaims } from '../lib/jwt';

export interface AuthedRequest extends Request { admin?: AdminClaims; }

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  try { req.admin = verifyAdmin(h.slice(7)); next(); }
  catch { return res.status(401).json({ error: 'Sesión inválida o expirada' }); }
}
```

- [ ] **Step 7: Write `apps/api/src/routes/admin/index.ts`** (composes all admin sub-routers; sub-routers from later tasks are imported here as they are created)

```ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../prisma';
import { signAdmin } from '../../lib/jwt';
import { requireAdmin, type AuthedRequest } from '../../middleware/auth';

export const adminRouter = Router();

adminRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Datos inválidos' });
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return res.status(401).json({ error: 'Credenciales inválidas' });
  res.json({ token: signAdmin({ sub: admin.id, email: admin.email }), email: admin.email });
});

adminRouter.use(requireAdmin); // everything below requires a valid token

adminRouter.get('/me', (req: AuthedRequest, res) => res.json({ email: req.admin!.email }));

// Wired in later tasks:
// adminRouter.use('/products', adminProductsRouter);  // Task 2
// adminRouter.use('/orders', adminOrdersRouter);       // Task 3
// adminRouter.use('/config', adminConfigRouter);       // Task 3
// adminRouter.get('/metrics', metricsHandler);          // Task 4
```

- [ ] **Step 8: Mount in `apps/api/src/app.ts`** (`import { adminRouter } …; app.use('/api/admin', adminRouter);` before `notFound`)

- [ ] **Step 9: Write `apps/api/tests/helpers/auth.ts`**

```ts
import { signAdmin } from '../../src/lib/jwt';
export const adminToken = () => signAdmin({ sub: 'admin-test', email: 'admin@test.com' });
export const authHeader = () => ({ Authorization: `Bearer ${adminToken()}` });
```

- [ ] **Step 10: Write the failing test `apps/api/tests/admin-auth.test.ts`**

```ts
import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';
import { authHeader } from './helpers/auth';

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
});
```

- [ ] **Step 11: Run → PASS, then commit**

```bash
npm test --workspace @resolute/api -- admin-auth
git add -A && git commit -m "feat(api): admin JWT auth, bcrypt login, requireAdmin guard, admin seed"
```

---

### Task 2: Admin product CRUD + Cloudinary upload

**Files:**
- Modify: `packages/shared/src/dto.ts`, `packages/shared/src/schemas.ts`, `apps/api/package.json`, `apps/api/src/routes/admin/index.ts`
- Create: `apps/api/src/lib/cloudinary.ts`, `apps/api/src/services/adminProducts.ts`, `apps/api/src/routes/admin/products.ts`
- Test: `apps/api/tests/admin-products.test.ts`

**Interfaces:**
- Produces: `productInputSchema`, `AdminProductDTO` (shared); `listAll/createProduct/updateProduct/deleteProduct/setProductImage`; `uploadImage(buffer)`; routes `GET/POST/PUT/:id/DELETE/:id` + `POST /:id/image`.

- [ ] **Step 1: Extend `packages/shared/src/dto.ts`**

```ts
export interface AdminProductDTO extends ProductDTO { active: boolean; sortOrder: number; imagePublicId: string | null; }
```

- [ ] **Step 2: Extend `packages/shared/src/schemas.ts`**

```ts
export const variantInputSchema = z.object({ size: z.enum(SIZES), stock: z.number().int().min(0) });
export const productInputSchema = z.object({
  slug: z.string().trim().min(1),
  line: z.string().trim().min(1),
  color: z.string().trim().min(1),
  dotColor: z.string().trim().min(1),
  tag: z.string().trim().nullable().optional(),
  price: z.number().int().min(0),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  sizes: z.array(variantInputSchema).min(1),
});
export type ProductInput = z.infer<typeof productInputSchema>;
```

- [ ] **Step 3: Install upload deps**

```bash
npm install --workspace @resolute/api cloudinary@^2.5.1 multer@^1.4.5-lts.1
npm install --workspace @resolute/api -D @types/multer@^1.4.12
```

- [ ] **Step 4: Write `apps/api/src/lib/cloudinary.ts`**

```ts
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../env';

cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET });

export async function uploadImage(buffer: Buffer, folder = 'resolute-force'): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (err, result) => {
      if (err || !result) return reject(err ?? new Error('Cloudinary upload failed'));
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  try { await cloudinary.uploader.destroy(publicId); } catch { /* best effort */ }
}
```

- [ ] **Step 5: Write `apps/api/src/services/adminProducts.ts`**

```ts
import type { AdminProductDTO, ProductInput } from '@resolute/shared';
import { SIZES } from '@resolute/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { deleteImage } from '../lib/cloudinary';

type PWV = Prisma.ProductGetPayload<{ include: { variants: true } }>;
function toDTO(p: PWV): AdminProductDTO {
  const rank = (s: string) => SIZES.indexOf(s as (typeof SIZES)[number]);
  return {
    id: p.id, slug: p.slug, line: p.line, color: p.color, dotColor: p.dotColor, tag: p.tag,
    price: p.price, imageUrl: p.imageUrl, active: p.active, sortOrder: p.sortOrder, imagePublicId: p.imagePublicId,
    sizes: [...p.variants].sort((a, b) => rank(a.size) - rank(b.size)).map((v) => ({ size: v.size, stock: v.stock })),
  };
}

export async function listAll(): Promise<AdminProductDTO[]> {
  const ps = await prisma.product.findMany({ orderBy: { sortOrder: 'asc' }, include: { variants: true } });
  return ps.map(toDTO);
}

export async function createProduct(input: ProductInput): Promise<AdminProductDTO> {
  const p = await prisma.product.create({
    data: {
      slug: input.slug, line: input.line, color: input.color, dotColor: input.dotColor, tag: input.tag ?? null,
      price: input.price, active: input.active, sortOrder: input.sortOrder, imageUrl: '/assets/logo-r.png',
      variants: { create: input.sizes.map((s) => ({ size: s.size, stock: s.stock })) },
    },
    include: { variants: true },
  });
  return toDTO(p);
}

export async function updateProduct(id: string, input: ProductInput): Promise<AdminProductDTO> {
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: { slug: input.slug, line: input.line, color: input.color, dotColor: input.dotColor, tag: input.tag ?? null, price: input.price, active: input.active, sortOrder: input.sortOrder } });
    for (const s of input.sizes) {
      await tx.variant.upsert({ where: { productId_size: { productId: id, size: s.size } }, update: { stock: s.stock }, create: { productId: id, size: s.size, stock: s.stock } });
    }
  });
  const p = await prisma.product.findUniqueOrThrow({ where: { id }, include: { variants: true } });
  return toDTO(p);
}

export async function deleteProduct(id: string): Promise<void> {
  const p = await prisma.product.findUnique({ where: { id } });
  if (p?.imagePublicId) await deleteImage(p.imagePublicId);
  await prisma.product.delete({ where: { id } });
}

export async function setProductImage(id: string, url: string, publicId: string): Promise<AdminProductDTO> {
  const prev = await prisma.product.findUnique({ where: { id } });
  if (prev?.imagePublicId) await deleteImage(prev.imagePublicId);
  const p = await prisma.product.update({ where: { id }, data: { imageUrl: url, imagePublicId: publicId }, include: { variants: true } });
  return toDTO(p);
}
```

> Requires the Prisma compound unique `productId_size` — already defined by `@@unique([productId, size])` on `Variant`.

- [ ] **Step 6: Write `apps/api/src/routes/admin/products.ts`**

```ts
import { Router } from 'express';
import multer from 'multer';
import { productInputSchema } from '@resolute/shared';
import { listAll, createProduct, updateProduct, deleteProduct, setProductImage } from '../../services/adminProducts';
import { uploadImage } from '../../lib/cloudinary';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });
export const adminProductsRouter = Router();

adminProductsRouter.get('/', async (_req, res, next) => { try { res.json(await listAll()); } catch (e) { next(e); } });

adminProductsRouter.post('/', async (req, res, next) => {
  const parsed = productInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Producto inválido', details: parsed.error.flatten() });
  try { res.status(201).json(await createProduct(parsed.data)); } catch (e) { next(e); }
});

adminProductsRouter.put('/:id', async (req, res, next) => {
  const parsed = productInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Producto inválido' });
  try { res.json(await updateProduct(req.params.id, parsed.data)); } catch (e) { next(e); }
});

adminProductsRouter.delete('/:id', async (req, res, next) => {
  try { await deleteProduct(req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});

adminProductsRouter.post('/:id/image', upload.single('image'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Falta la imagen' });
  try {
    const { url, publicId } = await uploadImage(req.file.buffer);
    res.json(await setProductImage(req.params.id, url, publicId));
  } catch (e) { next(e); }
});
```

- [ ] **Step 7: Wire into `apps/api/src/routes/admin/index.ts`** (`import { adminProductsRouter } …; adminRouter.use('/products', adminProductsRouter);`)

- [ ] **Step 8: Write the failing test `apps/api/tests/admin-products.test.ts`** (Cloudinary mocked)

```ts
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/cloudinary', () => ({ uploadImage: vi.fn().mockResolvedValue({ url: 'https://cdn/x.png', publicId: 'rf/x' }), deleteImage: vi.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { createApp } from '../src/app';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';
import { authHeader } from './helpers/auth';

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
});
```

- [ ] **Step 9: Run → PASS, then commit**

```bash
npm test --workspace @resolute/api -- admin-products
git add -A && git commit -m "feat(api): admin product CRUD with per-size stock and Cloudinary uploads"
```

---

### Task 3: Admin orders + drop/content config

**Files:**
- Create: `apps/api/src/routes/admin/orders.ts`, `apps/api/src/routes/admin/config.ts`
- Modify: `apps/api/src/routes/admin/index.ts`, `apps/api/src/services/config.ts`
- Test: `apps/api/tests/admin-orders-config.test.ts`

**Interfaces:**
- Produces: `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status`; `GET/PUT /api/admin/config/drop`, `GET/PUT /api/admin/config/content`; `updateDrop()`, `updateContent()`.

- [ ] **Step 1: Extend `apps/api/src/services/config.ts`** with writers (append)

```ts
import type { DropDTO, ContentDTO } from '@resolute/shared';

export async function updateDrop(input: { targetAt: string; visible: boolean; title: string; teaser: string }): Promise<DropDTO> {
  const d = await prisma.dropConfig.update({ where: { id: 1 }, data: { targetAt: new Date(input.targetAt), visible: input.visible, title: input.title, teaser: input.teaser } });
  return { targetAt: d.targetAt.toISOString(), visible: d.visible, title: d.title, teaser: d.teaser };
}

export async function updateContent(input: ContentDTO): Promise<ContentDTO> {
  await prisma.siteContent.update({
    where: { id: 1 },
    data: {
      marquee: JSON.stringify(input.marquee), heroKicker: input.heroKicker, heroTitle1: input.heroTitle1, heroTitle2: input.heroTitle2, heroSubtitle: input.heroSubtitle,
      transferDiscountPct: input.transferDiscountPct, bankAlias: input.bankAlias, bankCbu: input.bankCbu,
      contactWhatsapp: input.contactWhatsapp, contactInstagram: input.contactInstagram, contactEmail: input.contactEmail, contactLocation: input.contactLocation,
    },
  });
  return getContent();
}
```

- [ ] **Step 2: Write `apps/api/src/routes/admin/config.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { getDrop, getContent, updateDrop, updateContent } from '../../services/config';

export const adminConfigRouter = Router();

const dropSchema = z.object({ targetAt: z.string().min(1), visible: z.boolean(), title: z.string(), teaser: z.string() });
const contentSchema = z.object({
  marquee: z.array(z.string()).min(1), heroKicker: z.string(), heroTitle1: z.string(), heroTitle2: z.string(), heroSubtitle: z.string(),
  transferDiscountPct: z.number().int().min(0).max(90), bankAlias: z.string(), bankCbu: z.string(),
  contactWhatsapp: z.string(), contactInstagram: z.string(), contactEmail: z.string(), contactLocation: z.string(),
});

adminConfigRouter.get('/drop', async (_req, res, next) => { try { res.json(await getDrop()); } catch (e) { next(e); } });
adminConfigRouter.put('/drop', async (req, res, next) => {
  const p = dropSchema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Drop inválido' });
  try { res.json(await updateDrop(p.data)); } catch (e) { next(e); }
});
adminConfigRouter.get('/content', async (_req, res, next) => { try { res.json(await getContent()); } catch (e) { next(e); } });
adminConfigRouter.put('/content', async (req, res, next) => {
  const p = contentSchema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Contenido inválido' });
  try { res.json(await updateContent(p.data)); } catch (e) { next(e); }
});
```

- [ ] **Step 3: Write `apps/api/src/routes/admin/orders.ts`** (mark-paid reuses stock+email logic)

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { markPaidByOrderNo } from '../../services/orders';

export const adminOrdersRouter = Router();

adminOrdersRouter.get('/', async (_req, res, next) => {
  try { res.json(await prisma.order.findMany({ orderBy: { createdAt: 'desc' }, include: { items: true } })); } catch (e) { next(e); }
});

const statusSchema = z.object({ status: z.enum(['pending', 'paid', 'shipped', 'cancelled']) });
adminOrdersRouter.patch('/:id/status', async (req, res, next) => {
  const p = statusSchema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Estado inválido' });
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (p.data.status === 'paid') { await markPaidByOrderNo(order.orderNo, order.mpPaymentId ?? 'manual'); }
    else { await prisma.order.update({ where: { id: order.id }, data: { status: p.data.status } }); }
    res.json(await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } }));
  } catch (e) { next(e); }
});
```

- [ ] **Step 4: Wire both in `apps/api/src/routes/admin/index.ts`**

```ts
import { adminOrdersRouter } from './orders';
import { adminConfigRouter } from './config';
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/config', adminConfigRouter);
```

- [ ] **Step 5: Write the failing test `apps/api/tests/admin-orders-config.test.ts`**

```ts
import { beforeEach, describe, it, expect, vi } from 'vitest';
vi.mock('../src/services/notify', () => ({ notifyOrderPaid: vi.fn().mockResolvedValue(undefined), notifyTransferOrder: vi.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { createApp } from '../src/app';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';
import { authHeader } from './helpers/auth';
import { prisma } from '../src/prisma';
import { createOrder } from '../src/services/orders';

const app = createApp();
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', dir: 'Calle 1', ciudad: 'CABA' };
beforeEach(async () => { await resetDb(); await seed(); });

it('lists orders and marks a transfer order paid (decrementing stock)', async () => {
  const navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
  const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'transfer' });
  const list = await request(app).get('/api/admin/orders').set(authHeader());
  expect(list.body).toHaveLength(1);
  const patched = await request(app).patch(`/api/admin/orders/${order.id}/status`).set(authHeader()).send({ status: 'paid' });
  expect(patched.body.status).toBe('paid');
  const v = await prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } });
  expect(v.stock).toBe(23);
});

it('updates drop and content config', async () => {
  const drop = await request(app).put('/api/admin/config/drop').set(authHeader()).send({ targetAt: '2027-01-01T00:00:00-03:00', visible: false, title: 'X', teaser: 'Y' });
  expect(drop.body.visible).toBe(false);
  const content = await request(app).put('/api/admin/config/content').set(authHeader()).send({
    marquee: ['Uno', 'Dos'], heroKicker: 'k', heroTitle1: 'a', heroTitle2: 'b', heroSubtitle: 's', transferDiscountPct: 15, bankAlias: 'rf.alias', bankCbu: '00011122', contactWhatsapp: '549', contactInstagram: '@x', contactEmail: 'a@b.com', contactLocation: 'BA',
  });
  expect(content.body.transferDiscountPct).toBe(15);
  expect((await request(app).get('/api/content')).body.bankAlias).toBe('rf.alias');
});
```

- [ ] **Step 6: Run → PASS, then commit**

```bash
npm test --workspace @resolute/api -- admin-orders-config
git add -A && git commit -m "feat(api): admin orders management + drop/content config endpoints"
```

---

### Task 4: Metrics dashboard data + visit tracking

**Files:**
- Create: `apps/api/src/services/metrics.ts`, `apps/api/src/routes/track.ts`
- Modify: `apps/api/src/routes/admin/index.ts`, `apps/api/src/app.ts`
- Test: `apps/api/tests/metrics.test.ts`

**Interfaces:**
- Produces: `getMetrics()`; `GET /api/admin/metrics`; `POST /api/track` (public).

- [ ] **Step 1: Write `apps/api/src/services/metrics.ts`**

```ts
import { prisma } from '../prisma';

export interface Metrics {
  revenue: number;
  ordersByStatus: Record<string, number>;
  unitsSold: number;
  avgOrderValue: number;
  topProducts: { label: string; qty: number }[];
  revenueLast30: { date: string; total: number }[];
  lowStock: { line: string; color: string; size: string; stock: number }[];
  visits30: number;
  conversionRate: number;
}

const PAID = ['paid', 'shipped'];

export async function getMetrics(nowMs = Date.now()): Promise<Metrics> {
  const orders = await prisma.order.findMany({ include: { items: true } });
  const paid = orders.filter((o) => PAID.includes(o.status));

  const revenue = paid.reduce((a, o) => a + o.total, 0);
  const ordersByStatus = orders.reduce<Record<string, number>>((acc, o) => { acc[o.status] = (acc[o.status] ?? 0) + 1; return acc; }, {});
  const unitsSold = paid.reduce((a, o) => a + o.items.reduce((s, i) => s + i.qty, 0), 0);
  const avgOrderValue = paid.length ? Math.round(revenue / paid.length) : 0;

  const byProduct = new Map<string, number>();
  for (const o of paid) for (const i of o.items) byProduct.set(`${i.line} · ${i.color}`, (byProduct.get(`${i.line} · ${i.color}`) ?? 0) + i.qty);
  const topProducts = [...byProduct.entries()].map(([label, qty]) => ({ label, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);

  const dayMs = 86400000;
  const revenueLast30: { date: string; total: number }[] = [];
  for (let d = 29; d >= 0; d--) {
    const start = nowMs - d * dayMs;
    const date = new Date(start).toISOString().slice(0, 10);
    const total = paid.filter((o) => o.createdAt.toISOString().slice(0, 10) === date).reduce((a, o) => a + o.total, 0);
    revenueLast30.push({ date, total });
  }

  const variants = await prisma.variant.findMany({ where: { stock: { lte: 5 } }, include: { product: true } });
  const lowStock = variants.map((v) => ({ line: v.product.line, color: v.product.color, size: v.size, stock: v.stock }));

  const visits30 = await prisma.visit.count({ where: { createdAt: { gte: new Date(nowMs - 30 * dayMs) } } });
  const conversionRate = visits30 ? Math.round((paid.length / visits30) * 1000) / 10 : 0;

  return { revenue, ordersByStatus, unitsSold, avgOrderValue, topProducts, revenueLast30, lowStock, visits30, conversionRate };
}
```

- [ ] **Step 2: Write `apps/api/src/routes/track.ts`** (public, lightweight)

```ts
import { Router } from 'express';
import { prisma } from '../prisma';

export const trackRouter = Router();
trackRouter.post('/', async (req, res) => {
  const path = typeof req.body?.path === 'string' ? req.body.path.slice(0, 200) : '/';
  try { await prisma.visit.create({ data: { path } }); } catch { /* non-critical */ }
  res.json({ ok: true });
});
```

- [ ] **Step 3: Wire metrics + track** — in `routes/admin/index.ts`:

```ts
import { getMetrics } from '../../services/metrics';
adminRouter.get('/metrics', async (_req, res, next) => { try { res.json(await getMetrics()); } catch (e) { next(e); } });
```
and in `app.ts`: `import { trackRouter } …; app.use('/api/track', trackRouter);`

- [ ] **Step 4: Write the failing test `apps/api/tests/metrics.test.ts`**

```ts
import { beforeEach, describe, it, expect, vi } from 'vitest';
vi.mock('../src/services/notify', () => ({ notifyOrderPaid: vi.fn().mockResolvedValue(undefined), notifyTransferOrder: vi.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { createApp } from '../src/app';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';
import { authHeader } from './helpers/auth';
import { prisma } from '../src/prisma';
import { createOrder, markPaidByOrderNo } from '../src/services/orders';

const app = createApp();
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', dir: 'Calle 1', ciudad: 'CABA' };
beforeEach(async () => { await resetDb(); await seed(); });

it('tracks a visit and reports revenue/top products/conversion', async () => {
  await request(app).post('/api/track').send({ path: '/' });
  const navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
  const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'card' });
  await markPaidByOrderNo(order.orderNo, 'PAY-1');

  const res = await request(app).get('/api/admin/metrics').set(authHeader());
  expect(res.status).toBe(200);
  expect(res.body.revenue).toBe(60000);
  expect(res.body.unitsSold).toBe(2);
  expect(res.body.topProducts[0].label).toContain('Azul Marino');
  expect(res.body.revenueLast30).toHaveLength(30);
  expect(res.body.visits30).toBe(1);
  expect(res.body.conversionRate).toBeGreaterThan(0);
});

it('guards metrics behind auth', async () => {
  expect((await request(app).get('/api/admin/metrics')).status).toBe(401);
});
```

- [ ] **Step 5: Run → PASS; run the FULL api suite; commit**

```bash
npm test --workspace @resolute/api -- metrics
npm test --workspace @resolute/api
git add -A && git commit -m "feat(api): metrics dashboard data + visit tracking"
```

---

### Task 5: Web admin shell — auth store, admin API, guard, layout, login, visit tracking

**Files:**
- Modify: `apps/web/src/App.tsx`, `apps/web/src/pages/Landing.tsx`
- Create: `apps/web/src/store/auth.ts`, `apps/web/src/lib/adminApi.ts`, `apps/web/src/components/admin/ProtectedRoute.tsx`, `apps/web/src/pages/admin/AdminLayout.tsx`, `apps/web/src/pages/admin/Login.tsx`
- Test: `apps/web/src/pages/admin/Login.test.tsx`

**Interfaces:**
- Produces: `useAuth` (token,email,setSession,logout), `adminApi.*` (Bearer-authenticated), `<ProtectedRoute/>`, `<AdminLayout/>`, `<Login/>`.

- [ ] **Step 1: Write `apps/web/src/store/auth.ts`**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthStore { token: string | null; email: string | null; setSession: (token: string, email: string) => void; logout: () => void; }
export const useAuth = create<AuthStore>()(
  persist((set) => ({ token: null, email: null, setSession: (token, email) => set({ token, email }), logout: () => set({ token: null, email: null }) }), { name: 'rf-admin' }),
);
```

- [ ] **Step 2: Write `apps/web/src/lib/adminApi.ts`**

```ts
import type { AdminProductDTO, ProductInput, DropDTO, ContentDTO } from '@resolute/shared';
import { useAuth } from '../store/auth';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
function auth() { const t = useAuth.getState().token; return t ? { Authorization: `Bearer ${t}` } : {}; }

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...auth() }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) { useAuth.getState().logout(); throw new Error('Sesión expirada'); }
  if (!res.ok) { const e = (await res.json().catch(() => ({}))) as { error?: string }; throw new Error(e.error ?? `Error ${res.status}`); }
  return (await res.json()) as T;
}

export const adminApi = {
  login: (email: string, password: string) => req<{ token: string; email: string }>('POST', '/api/admin/login', { email, password }),
  products: () => req<AdminProductDTO[]>('GET', '/api/admin/products'),
  createProduct: (p: ProductInput) => req<AdminProductDTO>('POST', '/api/admin/products', p),
  updateProduct: (id: string, p: ProductInput) => req<AdminProductDTO>('PUT', `/api/admin/products/${id}`, p),
  deleteProduct: (id: string) => req<{ ok: true }>('DELETE', `/api/admin/products/${id}`),
  uploadImage: async (id: string, file: File) => {
    const fd = new FormData(); fd.append('image', file);
    const res = await fetch(`${BASE}/api/admin/products/${id}/image`, { method: 'POST', headers: { ...auth() }, body: fd });
    if (!res.ok) throw new Error('No se pudo subir la imagen');
    return (await res.json()) as AdminProductDTO;
  },
  orders: () => req<any[]>('GET', '/api/admin/orders'),
  setOrderStatus: (id: string, status: string) => req<any>('PATCH', `/api/admin/orders/${id}/status`, { status }),
  getDrop: () => req<DropDTO>('GET', '/api/admin/config/drop'),
  putDrop: (d: DropDTO) => req<DropDTO>('PUT', '/api/admin/config/drop', d),
  getContent: () => req<ContentDTO>('GET', '/api/admin/config/content'),
  putContent: (c: ContentDTO) => req<ContentDTO>('PUT', '/api/admin/config/content', c),
  metrics: () => req<any>('GET', '/api/admin/metrics'),
};
```

- [ ] **Step 3: Write `apps/web/src/components/admin/ProtectedRoute.tsx`**

```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/admin/login" replace />;
}
```

- [ ] **Step 4: Write `apps/web/src/pages/admin/AdminLayout.tsx`**

```tsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';

const link = ({ isActive }: { isActive: boolean }) => `block px-4 py-3 font-display font-semibold tracking-[0.1em] uppercase text-[14px] rounded-[2px] ${isActive ? 'bg-red text-white' : 'text-mut hover:text-tx'}`;

export default function AdminLayout() {
  const nav = useNavigate();
  const logout = useAuth((s) => s.logout);
  return (
    <div className="min-h-screen bg-bg text-tx font-body flex">
      <aside className="w-[230px] border-r border-line p-4 flex flex-col gap-1 sticky top-0 h-screen">
        <div className="font-display font-extrabold text-[18px] tracking-[0.2em] uppercase px-2 py-4">Resolute<span className="text-red">·</span>Admin</div>
        <NavLink to="/admin" end className={link}>Métricas</NavLink>
        <NavLink to="/admin/productos" className={link}>Productos</NavLink>
        <NavLink to="/admin/pedidos" className={link}>Pedidos</NavLink>
        <NavLink to="/admin/drop" className={link}>Drop</NavLink>
        <NavLink to="/admin/contenido" className={link}>Contenido</NavLink>
        <button onClick={() => { logout(); nav('/admin/login'); }} className="mt-auto text-left px-4 py-3 font-display font-semibold tracking-[0.1em] uppercase text-[14px] text-mut hover:text-red">Salir</button>
      </aside>
      <main className="flex-1 p-6 md:p-10 max-w-[1100px]"><Outlet /></main>
    </div>
  );
}
```

- [ ] **Step 5: Write the failing test `apps/web/src/pages/admin/Login.test.tsx`**

```tsx
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { useAuth } from '../../store/auth';

vi.mock('../../lib/adminApi', () => ({ adminApi: { login: vi.fn().mockResolvedValue({ token: 'jwt-123', email: 'admin@test.com' }) } }));

beforeEach(() => useAuth.setState({ token: null, email: null }));

it('logs in and stores the session', async () => {
  render(<MemoryRouter><Login /></MemoryRouter>);
  fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'admin@test.com' } });
  fireEvent.change(screen.getByPlaceholderText(/contraseña/i), { target: { value: 'secret123' } });
  fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));
  await waitFor(() => expect(useAuth.getState().token).toBe('jwt-123'));
});
```

- [ ] **Step 6: Run (fail), then write `apps/web/src/pages/admin/Login.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { useAuth } from '../../store/auth';

export default function Login() {
  const nav = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { const r = await adminApi.login(email, password); setSession(r.token, r.email); nav('/admin'); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Error'); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-bg text-tx font-body flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-[360px] bg-card border border-line rounded-[6px] p-7 flex flex-col gap-4">
        <div className="font-display font-extrabold text-[22px] tracking-[0.2em] uppercase text-center">Resolute<span className="text-red">·</span>Admin</div>
        {err && <div className="text-red text-[13px] font-display uppercase tracking-[0.06em]">{err}</div>}
        <input className="bg-bg border border-line2 rounded-[3px] text-tx px-[14px] py-[13px] outline-none focus:border-gold" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className="bg-bg border border-line2 rounded-[3px] text-tx px-[14px] py-[13px] outline-none focus:border-gold" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button disabled={busy} className="bg-red text-white border-0 rounded-[2px] p-[14px] font-display font-bold tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Ingresar</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Add admin routes + visit tracking** — in `apps/web/src/App.tsx` add the admin route tree (page components land in Task 6; import them now or stub):

```tsx
import ProtectedRoute from './components/admin/ProtectedRoute';
import AdminLayout from './pages/admin/AdminLayout';
import Login from './pages/admin/Login';
import Metrics from './pages/admin/Metrics';
import AdminProducts from './pages/admin/Products';
import ProductForm from './pages/admin/ProductForm';
import Orders from './pages/admin/Orders';
import DropConfig from './pages/admin/DropConfig';
import ContentConfig from './pages/admin/ContentConfig';
// inside <Routes>:
<Route path="/admin/login" element={<Login />} />
<Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
  <Route index element={<Metrics />} />
  <Route path="productos" element={<AdminProducts />} />
  <Route path="productos/nuevo" element={<ProductForm />} />
  <Route path="productos/:id" element={<ProductForm />} />
  <Route path="pedidos" element={<Orders />} />
  <Route path="drop" element={<DropConfig />} />
  <Route path="contenido" element={<ContentConfig />} />
</Route>
```

- [ ] **Step 8: Track a visit on landing mount** — in `apps/web/src/pages/Landing.tsx` add:

```tsx
import { useEffect } from 'react';
// inside Landing(), top of body:
useEffect(() => { const base = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'; fetch(`${base}/api/track`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/' }) }).catch(() => {}); }, []);
```

- [ ] **Step 9: Run the Login test → PASS, commit (after Task 6 lands the page components so the build compiles).**

---

### Task 6: Web admin pages — Metrics, Products, ProductForm, Orders, Drop, Content

**Files:**
- Create: `apps/web/src/pages/admin/Metrics.tsx`, `Products.tsx`, `ProductForm.tsx`, `Orders.tsx`, `DropConfig.tsx`, `ContentConfig.tsx`
- Test: `apps/web/src/pages/admin/ProductForm.test.tsx`

**Interfaces:**
- Consumes: `adminApi.*`, `money`, `SIZES`.
- Produces: the six admin pages mounted in Task 5's route tree.

- [ ] **Step 1: Write `apps/web/src/pages/admin/Metrics.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/adminApi';
import { money } from '../../lib/money';

function Card({ label, value }: { label: string; value: string }) {
  return <div className="bg-card border border-line rounded-[4px] p-5"><div className="text-mut text-[12px] font-display tracking-[0.14em] uppercase">{label}</div><div className="font-display font-black text-[28px] mt-1">{value}</div></div>;
}

export default function Metrics() {
  const { data, isLoading } = useQuery({ queryKey: ['metrics'], queryFn: adminApi.metrics });
  if (isLoading || !data) return <div className="text-mut">Cargando métricas…</div>;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display font-black text-[34px] uppercase">Métricas</h1>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        <Card label="Ingresos" value={money(data.revenue)} />
        <Card label="Unidades vendidas" value={String(data.unitsSold)} />
        <Card label="Ticket promedio" value={money(data.avgOrderValue)} />
        <Card label="Visitas (30d)" value={String(data.visits30)} />
        <Card label="Conversión" value={`${data.conversionRate}%`} />
        <Card label="Pendientes" value={String(data.ordersByStatus.pending ?? 0)} />
        <Card label="Pagados" value={String(data.ordersByStatus.paid ?? 0)} />
        <Card label="Enviados" value={String(data.ordersByStatus.shipped ?? 0)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card border border-line rounded-[4px] p-5">
          <div className="font-display font-bold uppercase tracking-[0.1em] mb-3">Top productos</div>
          {data.topProducts.length === 0 ? <div className="text-mut text-sm">Sin ventas aún.</div> : data.topProducts.map((p: { label: string; qty: number }) => (
            <div key={p.label} className="flex justify-between py-1 text-[14px]"><span>{p.label}</span><span className="text-gold font-bold">{p.qty}</span></div>
          ))}
        </div>
        <div className="bg-card border border-line rounded-[4px] p-5">
          <div className="font-display font-bold uppercase tracking-[0.1em] mb-3">Stock bajo (≤5)</div>
          {data.lowStock.length === 0 ? <div className="text-mut text-sm">Todo con stock.</div> : data.lowStock.map((s: { line: string; color: string; size: string; stock: number }, i: number) => (
            <div key={i} className="flex justify-between py-1 text-[14px]"><span>{s.line} · {s.color} · {s.size}</span><span className="text-red font-bold">{s.stock}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `apps/web/src/pages/admin/Products.tsx`**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { money } from '../../lib/money';
import type { AdminProductDTO } from '@resolute/shared';

export default function Products() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-products'], queryFn: adminApi.products });
  const del = useMutation({ mutationFn: (id: string) => adminApi.deleteProduct(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }) });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <h1 className="font-display font-black text-[34px] uppercase">Productos</h1>
        <Link to="/admin/productos/nuevo" className="bg-red text-white no-underline font-display font-bold text-[14px] tracking-[0.12em] uppercase px-5 py-3 rounded-[2px] hover:bg-redd">+ Nuevo</Link>
      </div>
      <div className="flex flex-col gap-2">
        {(data ?? []).map((p: AdminProductDTO) => (
          <div key={p.id} className="flex items-center gap-4 bg-card border border-line rounded-[4px] p-3">
            <img src={p.imageUrl} alt="" className="w-14 h-14 object-cover rounded-[3px] bg-[#d2d2cf]" />
            <div className="flex-1">
              <div className="font-display font-bold uppercase tracking-[0.04em]">{p.line} · {p.color}</div>
              <div className="text-mut text-[13px]">{money(p.price)} · {p.sizes.map((s) => `${s.size}:${s.stock}`).join('  ')} · {p.active ? 'activo' : 'inactivo'}</div>
            </div>
            <Link to={`/admin/productos/${p.id}`} className="text-gold no-underline font-display uppercase text-[13px] tracking-[0.1em]">Editar</Link>
            <button onClick={() => confirm('¿Borrar producto?') && del.mutate(p.id)} className="text-mut hover:text-red font-display uppercase text-[13px] tracking-[0.1em] bg-transparent border-0 cursor-pointer">Borrar</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the failing test `apps/web/src/pages/admin/ProductForm.test.tsx`**

```tsx
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductForm from './ProductForm';

const createProduct = vi.fn().mockResolvedValue({ id: 'new1' });
vi.mock('../../lib/adminApi', () => ({ adminApi: { createProduct: (...a: unknown[]) => createProduct(...a), uploadImage: vi.fn() } }));

beforeEach(() => createProduct.mockClear());

it('creates a product with sizes', async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ProductForm /></MemoryRouter></QueryClientProvider>);
  fireEvent.change(screen.getByPlaceholderText('Slug'), { target: { value: 'pressure-negro' } });
  fireEvent.change(screen.getByPlaceholderText('Línea'), { target: { value: 'Pressure' } });
  fireEvent.change(screen.getByPlaceholderText('Color'), { target: { value: 'Negro' } });
  fireEvent.change(screen.getByPlaceholderText('Precio (ARS)'), { target: { value: '52000' } });
  fireEvent.change(screen.getByLabelText('stock-M'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
  await waitFor(() => expect(createProduct).toHaveBeenCalled());
  expect(createProduct.mock.calls[0][0]).toMatchObject({ slug: 'pressure-negro', line: 'Pressure', price: 52000 });
});
```

- [ ] **Step 4: Run (fail), then write `apps/web/src/pages/admin/ProductForm.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SIZES } from '@resolute/shared';
import type { ProductInput } from '@resolute/shared';
import { adminApi } from '../../lib/adminApi';

const inputCls = 'bg-card border border-line2 rounded-[3px] text-tx px-[14px] py-[12px] outline-none focus:border-gold';

export default function ProductForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState<ProductInput>({ slug: '', line: '', color: '', dotColor: '#101013', tag: null, price: 0, active: true, sortOrder: 0, sizes: SIZES.map((size) => ({ size, stock: 0 })) });
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    adminApi.products().then((all) => { const p = all.find((x) => x.id === id); if (p) setForm({ slug: p.slug, line: p.line, color: p.color, dotColor: p.dotColor, tag: p.tag, price: p.price, active: p.active, sortOrder: p.sortOrder, sizes: SIZES.map((size) => ({ size, stock: p.sizes.find((s) => s.size === size)?.stock ?? 0 })) }); }).catch(() => {});
  }, [id]);

  function setStock(size: string, stock: number) { setForm((f) => ({ ...f, sizes: f.sizes.map((s) => (s.size === size ? { ...s, stock } : s)) })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const saved = id ? await adminApi.updateProduct(id, form) : await adminApi.createProduct(form);
      if (file) await adminApi.uploadImage(saved.id, file);
      nav('/admin/productos');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error'); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 max-w-[560px]">
      <h1 className="font-display font-black text-[30px] uppercase">{id ? 'Editar' : 'Nuevo'} producto</h1>
      {err && <div className="text-red text-[13px] uppercase font-display">{err}</div>}
      <input className={inputCls} placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
      <input className={inputCls} placeholder="Línea" value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} />
      <input className={inputCls} placeholder="Color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
      <div className="flex gap-3">
        <input className={`${inputCls} flex-1`} placeholder="Tag (opcional)" value={form.tag ?? ''} onChange={(e) => setForm({ ...form, tag: e.target.value || null })} />
        <input className={`${inputCls} w-[120px]`} type="color" value={form.dotColor} onChange={(e) => setForm({ ...form, dotColor: e.target.value })} />
      </div>
      <input className={inputCls} type="number" placeholder="Precio (ARS)" value={form.price || ''} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
      <div className="grid grid-cols-4 gap-2">
        {form.sizes.map((s) => (
          <label key={s.size} className="flex flex-col gap-1 text-mut text-[12px] font-display uppercase">{s.size}
            <input aria-label={`stock-${s.size}`} className={inputCls} type="number" value={s.stock} onChange={(e) => setStock(s.size, Number(e.target.value))} />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Activo</label>
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-mut text-[13px]" />
      <button disabled={busy} className="bg-red text-white border-0 rounded-[2px] p-[14px] font-display font-bold tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Guardar</button>
    </form>
  );
}
```

- [ ] **Step 5: Write `apps/web/src/pages/admin/Orders.tsx`**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/adminApi';
import { money } from '../../lib/money';

const STATUSES = ['pending', 'paid', 'shipped', 'cancelled'];

export default function Orders() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-orders'], queryFn: adminApi.orders });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => adminApi.setOrderStatus(id, status), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-orders'] }) });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display font-black text-[34px] uppercase">Pedidos</h1>
      <div className="flex flex-col gap-2">
        {(data ?? []).map((o: any) => (
          <div key={o.id} className="bg-card border border-line rounded-[4px] p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="font-display font-bold">{o.orderNo} · {o.customerName}</div>
              <div className="font-display font-black">{money(o.total)}</div>
            </div>
            <div className="text-mut text-[13px]">{o.customerEmail} · {o.customerPhone ?? '—'} · {o.address}, {o.city} · {o.paymentMethod}</div>
            <div className="text-[13px]">{o.items.map((i: any) => `${i.line} ${i.color} ${i.size} x${i.qty}`).join('  ·  ')}</div>
            <select value={o.status} onChange={(e) => setStatus.mutate({ id: o.id, status: e.target.value })} className="bg-bg border border-line2 rounded-[2px] text-tx px-3 py-2 w-[160px]">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `apps/web/src/pages/admin/DropConfig.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi';
import type { DropDTO } from '@resolute/shared';

const inputCls = 'bg-card border border-line2 rounded-[3px] text-tx px-[14px] py-[12px] outline-none focus:border-gold';

export default function DropConfig() {
  const [d, setD] = useState<DropDTO | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { adminApi.getDrop().then(setD).catch(() => {}); }, []);
  if (!d) return <div className="text-mut">Cargando…</div>;
  return (
    <form onSubmit={async (e) => { e.preventDefault(); await adminApi.putDrop(d); setMsg('Guardado ✓'); }} className="flex flex-col gap-4 max-w-[520px]">
      <h1 className="font-display font-black text-[30px] uppercase">Drop / countdown</h1>
      {msg && <div className="text-gold text-[13px] uppercase font-display">{msg}</div>}
      <label className="flex flex-col gap-1 text-mut text-[12px] uppercase font-display">Fecha objetivo
        <input className={inputCls} type="datetime-local" value={new Date(d.targetAt).toISOString().slice(0, 16)} onChange={(e) => setD({ ...d, targetAt: new Date(e.target.value).toISOString() })} />
      </label>
      <input className={inputCls} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Título" />
      <textarea className={inputCls} value={d.teaser} onChange={(e) => setD({ ...d, teaser: e.target.value })} placeholder="Teaser" rows={3} />
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={d.visible} onChange={(e) => setD({ ...d, visible: e.target.checked })} /> Mostrar sección</label>
      <button className="bg-red text-white border-0 rounded-[2px] p-[14px] font-display font-bold tracking-[0.13em] uppercase hover:bg-redd">Guardar</button>
    </form>
  );
}
```

- [ ] **Step 7: Write `apps/web/src/pages/admin/ContentConfig.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi';
import type { ContentDTO } from '@resolute/shared';

const inputCls = 'bg-card border border-line2 rounded-[3px] text-tx px-[14px] py-[12px] outline-none focus:border-gold';

export default function ContentConfig() {
  const [c, setC] = useState<ContentDTO | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { adminApi.getContent().then(setC).catch(() => {}); }, []);
  if (!c) return <div className="text-mut">Cargando…</div>;
  const f = (k: keyof ContentDTO) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: e.target.value } as ContentDTO);
  return (
    <form onSubmit={async (e) => { e.preventDefault(); await adminApi.putContent(c); setMsg('Guardado ✓'); }} className="flex flex-col gap-3 max-w-[560px]">
      <h1 className="font-display font-black text-[30px] uppercase">Contenido del sitio</h1>
      {msg && <div className="text-gold text-[13px] uppercase font-display">{msg}</div>}
      <label className="text-mut text-[12px] uppercase font-display">Marquee (una frase por línea)</label>
      <textarea className={inputCls} rows={4} value={c.marquee.join('\n')} onChange={(e) => setC({ ...c, marquee: e.target.value.split('\n').filter(Boolean) })} />
      <input className={inputCls} value={c.heroTitle1} onChange={f('heroTitle1')} placeholder="Hero línea 1" />
      <input className={inputCls} value={c.heroTitle2} onChange={f('heroTitle2')} placeholder="Hero línea 2" />
      <input className={inputCls} value={c.heroSubtitle} onChange={f('heroSubtitle')} placeholder="Hero subtítulo" />
      <label className="text-mut text-[12px] uppercase font-display">Descuento transferencia (%)</label>
      <input className={inputCls} type="number" value={c.transferDiscountPct} onChange={(e) => setC({ ...c, transferDiscountPct: Number(e.target.value) })} />
      <input className={inputCls} value={c.bankAlias} onChange={f('bankAlias')} placeholder="Alias bancario" />
      <input className={inputCls} value={c.bankCbu} onChange={f('bankCbu')} placeholder="CBU" />
      <input className={inputCls} value={c.contactWhatsapp} onChange={f('contactWhatsapp')} placeholder="WhatsApp (54911…)" />
      <input className={inputCls} value={c.contactInstagram} onChange={f('contactInstagram')} placeholder="Instagram" />
      <input className={inputCls} value={c.contactEmail} onChange={f('contactEmail')} placeholder="Email" />
      <input className={inputCls} value={c.contactLocation} onChange={f('contactLocation')} placeholder="Ubicación" />
      <button className="bg-red text-white border-0 rounded-[2px] p-[14px] font-display font-bold tracking-[0.13em] uppercase hover:bg-redd">Guardar</button>
    </form>
  );
}
```

- [ ] **Step 8: Run the web suite + build**

Run: `npm test --workspace @resolute/web` then `npm run build --workspace @resolute/web`
Expected: green; admin route tree compiles.

- [ ] **Step 9: Manual admin smoke**

Start api + web. Visit `/admin/login`, log in with `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Create a product with a Cloudinary photo (needs real `CLOUDINARY_*`), confirm it appears on the public landing; place an order, mark it shipped; edit the drop date and watch the public countdown change; edit the marquee/contact content; open Métricas.

- [ ] **Step 10: Final commit + tag**

```bash
npm test            # full monorepo
npm run build
git add -A && git commit -m "feat(web): admin pages — metrics, products, orders, drop, content (M6)"
git tag m6-admin
```

---

## M6 done when

- `/admin` requires login; the panel manages products (with photos + stock), the drop, site content, and orders; the metrics dashboard shows revenue/units/top-products/low-stock/visits/conversion.
- Full `npm test` is green and `npm run build` succeeds across the monorepo.
- `git tag m6-admin` exists. **The project is feature-complete** — see the master file's "Deployment notes" for going live.
