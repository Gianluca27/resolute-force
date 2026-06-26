# M1 — Backend: Data Model + Catalog/Drop/Content API

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`. Read the master file first (owns schema, DTOs, copy strings, Global Constraints). Requires M0 complete (`git tag m0-scaffold`).

**Goal:** Implement the Prisma schema + migration + idempotent seed (4 products with per-size stock, drop config, site content), and expose `GET /api/products`, `GET /api/products/:slug`, `GET /api/drop`, `GET /api/content`. Add the pure pricing helper.

**Architecture:** Routes are thin; logic lives in `src/services/*` and is unit/integration-tested with Vitest + Supertest against a dedicated `test.db` (schema pushed in a global setup; `fileParallelism:false` so the single SQLite file is never hit concurrently).

**Tech Stack:** Prisma 5 + SQLite, Express 4, Zod, Vitest, Supertest.

**Deliverable:** `npm run seed` populates the DB; the four read endpoints return correctly-shaped data; all api tests green.

---

### Task 1: Prisma schema, migration, client singleton, test harness

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (add all models), `apps/api/vitest.config.ts`
- Create: `apps/api/src/prisma.ts`, `apps/api/tests/globalSetup.ts`, `apps/api/tests/helpers/db.ts`
- Test: `apps/api/tests/prisma.test.ts`

**Interfaces:**
- Produces: `prisma` (PrismaClient singleton), `resetDb()` helper, the full schema from the master "Data Model" section.

- [ ] **Step 1: Replace `apps/api/prisma/schema.prisma` with the full model set**

Copy the entire `schema.prisma` from the master plan's "Data Model" section (generator + datasource + `Product`, `Variant`, `Order`, `OrderItem`, `DropConfig`, `SiteContent`, `AdminUser`, `Visit`).

- [ ] **Step 2: Create the first migration and generate the client**

```bash
cd apps/api
npx prisma migrate dev --name init
```
Expected: creates `prisma/migrations/<ts>_init/`, applies it to `dev.db`, and runs `prisma generate` (emits `@prisma/client`). Output ends with `Your database is now in sync with your schema.`

- [ ] **Step 3: Write `apps/api/src/prisma.ts`**

```ts
import { PrismaClient } from '@prisma/client';

declare global { var __prisma__: PrismaClient | undefined; }

export const prisma = globalThis.__prisma__ ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__prisma__ = prisma;
```

- [ ] **Step 4: Update `apps/api/vitest.config.ts` to use a test DB + global setup**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/globalSetup.ts'],
    env: { DATABASE_URL: 'file:./test.db', NODE_ENV: 'test' },
    fileParallelism: false,
  },
});
```

- [ ] **Step 5: Write `apps/api/tests/globalSetup.ts`**

```ts
import { execSync } from 'node:child_process';

export default function setup() {
  execSync('npx prisma db push --force-reset --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}
```

- [ ] **Step 6: Write `apps/api/tests/helpers/db.ts`** (FK-safe truncation)

```ts
import { prisma } from '../../src/prisma';

export async function resetDb() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.dropConfig.deleteMany();
  await prisma.siteContent.deleteMany();
  await prisma.adminUser.deleteMany();
}
```

- [ ] **Step 7: Write the failing test `apps/api/tests/prisma.test.ts`**

```ts
import { beforeAll, describe, it, expect } from 'vitest';
import { prisma } from '../src/prisma';
import { resetDb } from './helpers/db';

beforeAll(resetDb);

describe('prisma schema', () => {
  it('creates a product with a variant and reads it back', async () => {
    const p = await prisma.product.create({
      data: {
        slug: 't-smoke', line: 'Champion Mentality', color: 'Negro',
        dotColor: '#101013', price: 30000, imageUrl: '/assets/tile-black.png',
        variants: { create: [{ size: 'M', stock: 10 }] },
      },
      include: { variants: true },
    });
    expect(p.variants).toHaveLength(1);
    expect(p.variants[0]!.stock).toBe(10);
  });
});
```

- [ ] **Step 8: Run the test to verify it fails (then passes)**

Run: `npm test --workspace @resolute/api`
Expected first run BEFORE Steps 1–2 would fail to generate; with the schema migrated and client generated, this test PASSES. If the client is stale, run `npx prisma generate` in `apps/api` and re-run.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(api): full prisma schema, migration, client singleton, test harness"
```

---

### Task 2: Idempotent seed (products, drop, content)

**Files:**
- Create: `apps/api/prisma/seed.ts`
- Test: `apps/api/tests/seed.test.ts`

**Interfaces:**
- Consumes: `prisma` singleton.
- Produces: `seed()` — idempotent; safe to import (auto-runs only when executed directly via `tsx prisma/seed.ts`).

- [ ] **Step 1: Write the failing test `apps/api/tests/seed.test.ts`**

```ts
import { beforeAll, describe, it, expect } from 'vitest';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';
import { prisma } from '../src/prisma';

beforeAll(async () => { await resetDb(); await seed(); });

describe('seed', () => {
  it('creates 4 active products, each with S/M/L/XL variants', async () => {
    const products = await prisma.product.findMany({ include: { variants: true }, orderBy: { sortOrder: 'asc' } });
    expect(products).toHaveLength(4);
    expect(products.every(p => p.active)).toBe(true);
    for (const p of products) expect(p.variants).toHaveLength(4);
    expect(products[0]!.color).toBe('Azul Marino');
    expect(products[0]!.tag).toBe('Más vendida');
    expect(products[3]!.line).toBe('Stop At Nothing');
  });

  it('creates singleton drop + content (6-item marquee, 10% transfer)', async () => {
    const drop = await prisma.dropConfig.findUnique({ where: { id: 1 } });
    expect(drop?.visible).toBe(true);
    const content = await prisma.siteContent.findUnique({ where: { id: 1 } });
    expect(JSON.parse(content!.marquee)).toHaveLength(6);
    expect(content!.transferDiscountPct).toBe(10);
  });

  it('is idempotent (running twice keeps 4 products)', async () => {
    await seed();
    expect(await prisma.product.count()).toBe(4);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @resolute/api -- seed`
Expected: FAIL — `Cannot find module '../prisma/seed'`.

- [ ] **Step 3: Write `apps/api/prisma/seed.ts`**

```ts
import { pathToFileURL } from 'node:url';
import { prisma } from '../src/prisma';

const SIZES = ['S', 'M', 'L', 'XL'] as const;

const products = [
  { slug: 'champion-mentality-azul-marino', line: 'Champion Mentality', color: 'Azul Marino', dotColor: '#1f2a44', tag: 'Más vendida' as string | null, image: '/assets/tile-navy.png', sortOrder: 0 },
  { slug: 'champion-mentality-negro', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, image: '/assets/tile-black.png', sortOrder: 1 },
  { slug: 'champion-mentality-verde-militar', line: 'Champion Mentality', color: 'Verde Militar', dotColor: '#4a5235', tag: null, image: '/assets/tile-olive.png', sortOrder: 2 },
  { slug: 'stop-at-nothing-blanco', line: 'Stop At Nothing', color: 'Blanco', dotColor: '#e9e9ea', tag: 'Nuevo', image: '/assets/tile-white.png', sortOrder: 3 },
];

export async function seed() {
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: { line: p.line, color: p.color, dotColor: p.dotColor, tag: p.tag, price: 30000, imageUrl: p.image, sortOrder: p.sortOrder, active: true },
      create: {
        slug: p.slug, line: p.line, color: p.color, dotColor: p.dotColor, tag: p.tag,
        price: 30000, imageUrl: p.image, sortOrder: p.sortOrder, active: true,
        variants: { create: SIZES.map(size => ({ size, stock: 25 })) },
      },
    });
  }

  await prisma.dropConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      targetAt: new Date('2026-08-15T20:00:00-03:00'),
      visible: true,
      title: 'Algo se está forjando',
      teaser: 'Un nuevo drop está entrando al fuego. Hoodies, oversize y la línea Pressure. Preparate.',
    },
  });

  await prisma.siteContent.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      marquee: JSON.stringify(['Envíos a todo el país', 'Champion Mentality', '3 cuotas sin interés', 'Stop at Nothing', 'Calidad premium', 'The Resolute Standard']),
      heroKicker: 'Est. 2024 · Indumentaria de alto rendimiento',
      heroTitle1: 'Champion',
      heroTitle2: 'Mentality',
      heroSubtitle: 'No vendemos remeras. Forjamos una mentalidad. Indumentaria deportiva para los que entrenan bajo presión y no se detienen ante nada.',
      transferDiscountPct: 10,
      bankAlias: '',
      bankCbu: '',
      contactWhatsapp: '5493413213723',
      contactInstagram: '@resolute.force',
      contactEmail: 'resolutecontacto@gmail.com',
      contactLocation: 'Buenos Aires · Envíos a todo el país',
    },
  });
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  seed()
    .then(() => { console.log('[seed] done'); return prisma.$disconnect(); })
    .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace @resolute/api -- seed`
Expected: PASS (3 tests).

- [ ] **Step 5: Seed the real dev database (manual verification)**

```bash
cd apps/api && npm run seed
```
Expected: `[seed] done`. Re-running keeps 4 products (idempotent).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(api): idempotent seed for products, drop config, and site content"
```

---

### Task 3: Catalog service + products routes + DTO extension + error middleware

**Files:**
- Modify: `packages/shared/src/dto.ts` (add `DropDTO`, `ContentDTO`), `apps/api/src/app.ts`
- Create: `apps/api/src/services/catalog.ts`, `apps/api/src/routes/products.ts`, `apps/api/src/middleware/error.ts`
- Test: `apps/api/tests/products.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ProductDTO`, `SIZES`.
- Produces: `listProducts()`, `getProductBySlug(slug)`, `productsRouter`, `notFound`, `errorHandler`, plus `DropDTO`/`ContentDTO` shared types.

- [ ] **Step 1: Extend `packages/shared/src/dto.ts`** (append)

```ts
export interface DropDTO { targetAt: string; visible: boolean; title: string; teaser: string; }
export interface ContentDTO {
  marquee: string[]; heroKicker: string; heroTitle1: string; heroTitle2: string; heroSubtitle: string;
  transferDiscountPct: number; bankAlias: string; bankCbu: string;
  contactWhatsapp: string; contactInstagram: string; contactEmail: string; contactLocation: string;
}
```

- [ ] **Step 2: Confirm shared tests still pass**

Run: `npm test --workspace @resolute/shared`
Expected: PASS (unchanged).

- [ ] **Step 3: Write the failing test `apps/api/tests/products.test.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test --workspace @resolute/api -- products`
Expected: FAIL — `Cannot find module '../src/services/catalog'` (and route not mounted).

- [ ] **Step 5: Write `apps/api/src/services/catalog.ts`**

```ts
import type { Prisma } from '@prisma/client';
import type { ProductDTO } from '@resolute/shared';
import { SIZES } from '@resolute/shared';
import { prisma } from '../prisma';

type ProductWithVariants = Prisma.ProductGetPayload<{ include: { variants: true } }>;

function toDTO(p: ProductWithVariants): ProductDTO {
  const rank = (s: string) => SIZES.indexOf(s as (typeof SIZES)[number]);
  return {
    id: p.id, slug: p.slug, line: p.line, color: p.color, dotColor: p.dotColor,
    tag: p.tag, price: p.price, imageUrl: p.imageUrl,
    sizes: [...p.variants].sort((a, b) => rank(a.size) - rank(b.size)).map(v => ({ size: v.size, stock: v.stock })),
  };
}

export async function listProducts(): Promise<ProductDTO[]> {
  const products = await prisma.product.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, include: { variants: true } });
  return products.map(toDTO);
}

export async function getProductBySlug(slug: string): Promise<ProductDTO | null> {
  const p = await prisma.product.findUnique({ where: { slug }, include: { variants: true } });
  return p ? toDTO(p) : null;
}
```

- [ ] **Step 6: Write `apps/api/src/middleware/error.ts`**

```ts
import type { Request, Response, NextFunction } from 'express';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : 'Internal error';
  if (process.env.NODE_ENV !== 'test') console.error('[api error]', err);
  res.status(500).json({ error: message });
}
```

- [ ] **Step 7: Write `apps/api/src/routes/products.ts`**

```ts
import { Router } from 'express';
import { listProducts, getProductBySlug } from '../services/catalog';

export const productsRouter = Router();

productsRouter.get('/', async (_req, res, next) => {
  try { res.json(await listProducts()); } catch (e) { next(e); }
});

productsRouter.get('/:slug', async (req, res, next) => {
  try {
    const product = await getProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(product);
  } catch (e) { next(e); }
});
```

- [ ] **Step 8: Update `apps/api/src/app.ts` to mount products + error handlers**

```ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env';
import { productsRouter } from './routes/products';
import { notFound, errorHandler } from './middleware/error';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.PUBLIC_WEB_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/products', productsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test --workspace @resolute/api -- products`
Expected: PASS (3 tests). Health test still PASS.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(api): GET /api/products(+:slug), catalog DTO mapping, error middleware"
```

---

### Task 4: Drop + Content services and routes

**Files:**
- Create: `apps/api/src/services/config.ts`, `apps/api/src/routes/drop.ts`, `apps/api/src/routes/content.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/config.test.ts`

**Interfaces:**
- Consumes: `prisma`, `DropDTO`, `ContentDTO`.
- Produces: `getDrop()`, `getContent()`, `dropRouter`, `contentRouter`.

- [ ] **Step 1: Write the failing test `apps/api/tests/config.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @resolute/api -- config`
Expected: FAIL — drop/content routes return 404 (not mounted).

- [ ] **Step 3: Write `apps/api/src/services/config.ts`**

```ts
import type { DropDTO, ContentDTO } from '@resolute/shared';
import { prisma } from '../prisma';

export async function getDrop(): Promise<DropDTO> {
  const d = await prisma.dropConfig.findUnique({ where: { id: 1 } });
  if (!d) throw new Error('DropConfig no inicializado — corré el seed');
  return { targetAt: d.targetAt.toISOString(), visible: d.visible, title: d.title, teaser: d.teaser };
}

export async function getContent(): Promise<ContentDTO> {
  const c = await prisma.siteContent.findUnique({ where: { id: 1 } });
  if (!c) throw new Error('SiteContent no inicializado — corré el seed');
  return {
    marquee: JSON.parse(c.marquee) as string[],
    heroKicker: c.heroKicker, heroTitle1: c.heroTitle1, heroTitle2: c.heroTitle2, heroSubtitle: c.heroSubtitle,
    transferDiscountPct: c.transferDiscountPct, bankAlias: c.bankAlias, bankCbu: c.bankCbu,
    contactWhatsapp: c.contactWhatsapp, contactInstagram: c.contactInstagram,
    contactEmail: c.contactEmail, contactLocation: c.contactLocation,
  };
}
```

- [ ] **Step 4: Write `apps/api/src/routes/drop.ts` and `apps/api/src/routes/content.ts`**

```ts
// drop.ts
import { Router } from 'express';
import { getDrop } from '../services/config';
export const dropRouter = Router();
dropRouter.get('/', async (_req, res, next) => { try { res.json(await getDrop()); } catch (e) { next(e); } });
```

```ts
// content.ts
import { Router } from 'express';
import { getContent } from '../services/config';
export const contentRouter = Router();
contentRouter.get('/', async (_req, res, next) => { try { res.json(await getContent()); } catch (e) { next(e); } });
```

- [ ] **Step 5: Mount both in `apps/api/src/app.ts`** (add imports + `app.use` lines before `notFound`)

```ts
import { dropRouter } from './routes/drop';
import { contentRouter } from './routes/content';
// …inside createApp(), after the products mount:
app.use('/api/drop', dropRouter);
app.use('/api/content', contentRouter);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test --workspace @resolute/api -- config`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(api): GET /api/drop and /api/content endpoints"
```

---

### Task 5: Pricing helper (pure) + milestone wrap-up

**Files:**
- Create: `apps/api/src/services/pricing.ts`
- Test: `apps/api/tests/pricing.test.ts`

**Interfaces:**
- Produces: `computeTotals(subtotal, transferPct)` → `{ subtotal, transferDiscount, totalTransfer, totalCard }`. M3's `/api/checkout/quote` and M4's payment flow consume this.

- [ ] **Step 1: Write the failing test `apps/api/tests/pricing.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { computeTotals } from '../src/services/pricing';

describe('computeTotals', () => {
  it('applies the transfer discount; card stays at subtotal', () => {
    expect(computeTotals(30000, 10)).toEqual({ subtotal: 30000, transferDiscount: 3000, totalTransfer: 27000, totalCard: 30000 });
  });
  it('rounds the discount to integer pesos', () => {
    expect(computeTotals(29999, 10).transferDiscount).toBe(3000);
  });
  it('handles 0% discount', () => {
    expect(computeTotals(50000, 0)).toEqual({ subtotal: 50000, transferDiscount: 0, totalTransfer: 50000, totalCard: 50000 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @resolute/api -- pricing`
Expected: FAIL — `Cannot find module '../src/services/pricing'`.

- [ ] **Step 3: Write `apps/api/src/services/pricing.ts`**

```ts
export interface Totals { subtotal: number; transferDiscount: number; totalTransfer: number; totalCard: number; }

export function computeTotals(subtotal: number, transferPct: number): Totals {
  const transferDiscount = Math.round(subtotal * (transferPct / 100));
  return { subtotal, transferDiscount, totalTransfer: subtotal - transferDiscount, totalCard: subtotal };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace @resolute/api -- pricing`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full api suite + typecheck**

Run: `npm test --workspace @resolute/api` then `npm run typecheck --workspace @resolute/api`
Expected: all green (prisma, seed, products, config, pricing, health), no type errors.

- [ ] **Step 6: Commit + tag**

```bash
git add -A && git commit -m "feat(api): pure computeTotals pricing helper (M1)"
git tag m1-catalog-api
```

---

## M1 done when

- `npm run seed` (in `apps/api`) populates 4 products, drop config, and site content.
- `GET /api/products`, `/api/products/:slug`, `/api/drop`, `/api/content` return master-spec-shaped JSON.
- `git tag m1-catalog-api` exists. Proceed to `…-m2-frontend-port.md` (faithful React+Tailwind landing consuming these endpoints).
