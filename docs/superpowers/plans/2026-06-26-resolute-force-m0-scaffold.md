# M0 — Monorepo Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`. Read the master file `2026-06-26-resolute-force-webapp.md` first (it owns the Global Constraints, file tree, and env vars this milestone realizes).

**Goal:** Stand up the npm-workspaces monorepo (`packages/shared`, `apps/api`, `apps/web`) with TypeScript, Vitest, Tailwind tokens, env validation, and a green test in every package.

**Architecture:** Three workspaces. `shared` is imported as TS source (no build step). `api` runs on `tsx` (dev and prod). `web` runs on Vite. Tests use Vitest everywhere; api adds Supertest, web adds React Testing Library + jsdom.

**Tech Stack:** Node 20, TypeScript 5.6 strict, Vitest 2, Express 4, Vite 5, Tailwind 3.4, Zod 3.

**Deliverable:** `npm install` at the root succeeds; `npm test` runs all three workspaces' tests green; initial git history exists.

---

### Task 0: Repository & root configuration

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `README.md`
- Move: `Resolute Force(1).html` → `_source/`, `Sitio web Resolute Force.zip` → `_source/`

**Interfaces:**
- Produces: workspace roots `apps/*`, `packages/*`; root scripts `test`, `dev:api`, `dev:web`, `typecheck`.

- [ ] **Step 1: Initialize git and move the source export aside**

```bash
cd "/home/Gianluca/Documentos/VSCODE/resolute-force"
git init
mkdir -p _source apps packages
git mv "Resolute Force(1).html" _source/ 2>/dev/null || mv "Resolute Force(1).html" _source/
mv "Sitio web Resolute Force.zip" _source/
```

- [ ] **Step 2: Write the root `package.json`**

```json
{
  "name": "resolute-force",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "dev:api": "npm run dev --workspace apps/api",
    "dev:web": "npm run dev --workspace apps/web",
    "build": "npm run build --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 3: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": false,
    "declaration": false,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Write `.gitignore`**

```gitignore
node_modules/
dist/
build/
.env
.env.*
!.env.example
*.db
*.db-journal
apps/api/prisma/dev.db*
coverage/
.DS_Store
*.log
```

- [ ] **Step 5: Copy `.env.example` from the master plan**

Create `.env.example` at the repo root with the exact contents of the master plan's "Environment Variables" section (both the api and web blocks, separated by a comment header). This documents required secrets without committing them.

- [ ] **Step 6: Write a minimal `README.md`**

```markdown
# Resolute Force

Monorepo: `apps/web` (React+Vite+Tailwind), `apps/api` (Express+Prisma/SQLite), `packages/shared` (Zod DTOs).

## Dev
1. `npm install`
2. Copy `.env.example` → `apps/api/.env` and `apps/web/.env`, fill values.
3. `npm run dev:api` and `npm run dev:web`.

## Test
`npm test`
```

- [ ] **Step 7: Commit (after the workspaces exist — return here at end of Task 4).** No standalone commit; Task 0 has no test. Proceed to Task 1.

---

### Task 1: `packages/shared` — DTOs + Zod schemas

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`, `packages/shared/src/dto.ts`, `packages/shared/src/schemas.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/tests/schemas.test.ts`

**Interfaces:**
- Produces: package `@resolute/shared` exporting `cartLineSchema`, `customerSchema`, and types `CartLineInput`, `CustomerInput`, `ProductDTO`, `QuoteResult` (see master "Shared DTOs").

- [ ] **Step 1: Write `packages/shared/package.json`**

```json
{
  "name": "@resolute/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "vitest": "^2.1.4", "typescript": "^5.6.3" }
}
```

- [ ] **Step 2: Write `packages/shared/tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "tests"] }
```

- [ ] **Step 3: Write `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node' } });
```

- [ ] **Step 4: Write `packages/shared/src/dto.ts`** (copy the DTO interfaces from the master "Shared DTOs / Interfaces" section verbatim)

```ts
export interface CartLineInput { productId: string; size: string; qty: number; }
export interface CustomerInput { nombre: string; email: string; tel?: string; dir: string; ciudad: string; }
export interface QuoteLine { productId: string; line: string; color: string; size: string; unitPrice: number; qty: number; lineTotal: number; }
export interface QuoteResult { lines: QuoteLine[]; subtotal: number; transferDiscount: number; totalTransfer: number; totalCard: number; }
export interface ProductVariantDTO { size: string; stock: number; }
export interface ProductDTO { id: string; slug: string; line: string; color: string; dotColor: string; tag: string | null; price: number; imageUrl: string; sizes: ProductVariantDTO[]; }
export const SIZES = ['S', 'M', 'L', 'XL'] as const;
export type Size = (typeof SIZES)[number];
```

- [ ] **Step 5: Write the failing test `packages/shared/tests/schemas.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { cartLineSchema, customerSchema } from '../src/index';

describe('cartLineSchema', () => {
  it('accepts a valid line', () => {
    expect(cartLineSchema.parse({ productId: 'p1', size: 'M', qty: 2 }))
      .toEqual({ productId: 'p1', size: 'M', qty: 2 });
  });
  it('rejects qty < 1', () => {
    expect(cartLineSchema.safeParse({ productId: 'p1', size: 'M', qty: 0 }).success).toBe(false);
  });
  it('rejects an unknown size', () => {
    expect(cartLineSchema.safeParse({ productId: 'p1', size: 'XXL', qty: 1 }).success).toBe(false);
  });
});

describe('customerSchema', () => {
  it('requires a valid email and non-empty address', () => {
    expect(customerSchema.safeParse({ nombre: 'A', email: 'bad', dir: 'x', ciudad: 'y' }).success).toBe(false);
    expect(customerSchema.parse({ nombre: 'Ana', email: 'a@b.com', dir: 'Calle 1', ciudad: 'CABA' }).nombre).toBe('Ana');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm install` (root, first time) then `npm test --workspace @resolute/shared`
Expected: FAIL — `Cannot find module '../src/index'` / `cartLineSchema is not exported`.

- [ ] **Step 7: Write `packages/shared/src/schemas.ts`**

```ts
import { z } from 'zod';
import { SIZES } from './dto';

export const cartLineSchema = z.object({
  productId: z.string().min(1),
  size: z.enum(SIZES),
  qty: z.number().int().min(1).max(20),
});

export const customerSchema = z.object({
  nombre: z.string().trim().min(1),
  email: z.string().trim().email(),
  tel: z.string().trim().optional(),
  dir: z.string().trim().min(1),
  ciudad: z.string().trim().min(1),
});

export const checkoutQuoteSchema = z.object({ items: z.array(cartLineSchema).min(1) });
```

- [ ] **Step 8: Write `packages/shared/src/index.ts`**

```ts
export * from './dto';
export * from './schemas';
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test --workspace @resolute/shared`
Expected: PASS (5 tests).

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(shared): zod schemas and DTO contract for cart/customer/product"
```

---

### Task 2: `apps/api` — Express skeleton + health check

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/.env`, `apps/api/src/env.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/prisma/schema.prisma`
- Test: `apps/api/tests/health.test.ts`

**Interfaces:**
- Consumes: `@resolute/shared`.
- Produces: `createApp()` (Express app factory used by tests and `index.ts`), validated `env` object.

- [ ] **Step 1: Write `apps/api/package.json`**

```json
{
  "name": "@resolute/api",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@resolute/shared": "*",
    "@prisma/client": "^5.22.0",
    "cors": "^2.8.5",
    "express": "^4.21.1",
    "helmet": "^8.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^22.9.0",
    "@types/supertest": "^6.0.2",
    "prisma": "^5.22.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write `apps/api/tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "types": ["node"] }, "include": ["src", "tests", "prisma"] }
```

- [ ] **Step 3: Write `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/**/*.test.ts'] } });
```

- [ ] **Step 4: Write `apps/api/.env`** (local, git-ignored — copy from `.env.example` api block; for M0 only these are needed)

```
DATABASE_URL="file:./dev.db"
PORT=4000
PUBLIC_WEB_URL="http://localhost:5173"
JWT_SECRET="dev-secret-change-me"
```

- [ ] **Step 5: Write `apps/api/src/env.ts`** (Zod-validated, with defaults so tests need no real secrets)

```ts
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('file:./dev.db'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().default('dev-secret-change-me'),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
```

- [ ] **Step 6: Write `apps/api/prisma/schema.prisma`** (datasource + generator only; models arrive in M1)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 7: Write the failing test `apps/api/tests/health.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /api/health', () => {
  it('returns { ok: true }', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npm install` (root) then `npm test --workspace @resolute/api`
Expected: FAIL — `Cannot find module '../src/app'`.

- [ ] **Step 9: Write `apps/api/src/app.ts`**

```ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.PUBLIC_WEB_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  return app;
}
```

- [ ] **Step 10: Write `apps/api/src/index.ts`**

```ts
import { createApp } from './app';
import { env } from './env';

createApp().listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}`);
});
```

- [ ] **Step 11: Run the test to verify it passes**

Run: `npm test --workspace @resolute/api`
Expected: PASS (1 test).

- [ ] **Step 12: Commit**

```bash
git add -A && git commit -m "feat(api): express app factory with health check and validated env"
```

---

### Task 3: `apps/web` — Vite + React + Tailwind tokens + smoke test

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/tsconfig.node.json`, `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`, `apps/web/postcss.config.js`, `apps/web/tailwind.config.ts`, `apps/web/index.html`, `apps/web/src/index.css`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/test/setup.ts`
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Produces: Tailwind theme exposing brand tokens (`bg`,`panel`,`card`,`tx`,`mut`,`red`,`redd`,`gold`,`line`,`line2`), fonts (`font-display`,`font-body`), and animations (`animate-marquee`, `animate-fade`, `animate-slidein`, `animate-rise`, `animate-toast`, `animate-ember`, `animate-float`). M2 consumes all of these.

- [ ] **Step 1: Write `apps/web/package.json`**

```json
{
  "name": "@resolute/web",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@resolute/shared": "*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"], "types": ["vitest/globals", "@testing-library/jest-dom"] },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `apps/web/tsconfig.node.json`**

```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "composite": true, "types": ["node"] }, "include": ["vite.config.ts"] }
```

- [ ] **Step 4: Write `apps/web/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

- [ ] **Step 5: Write `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { globals: true, environment: 'jsdom', setupFiles: './src/test/setup.ts' },
});
```

- [ ] **Step 6: Write `apps/web/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 7: Write `apps/web/postcss.config.js`**

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 8: Write `apps/web/tailwind.config.ts`** (brand tokens + the 7 source keyframes/animations)

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0b', panel: '#0e0e10', card: '#161619',
        tx: '#f4f4f3', mut: '#97979d',
        red: '#e4322b', redd: '#bb211c', gold: '#e8b53e',
        line: 'rgba(255,255,255,0.08)', line2: 'rgba(255,255,255,0.16)',
      },
      fontFamily: {
        display: ['"Saira Condensed"', 'system-ui', 'sans-serif'],
        body: ['"Barlow"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        slidein: { from: { opacity: '0', transform: 'translateX(36px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        rise: { from: { opacity: '0', transform: 'translateY(24px) scale(.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        toast: { '0%': { opacity: '0', transform: 'translate(-50%,16px)' }, '12%': { opacity: '1', transform: 'translate(-50%,0)' }, '88%': { opacity: '1', transform: 'translate(-50%,0)' }, '100%': { opacity: '0', transform: 'translate(-50%,16px)' } },
        ember: { '0%,100%': { opacity: '.45', transform: 'scale(1)' }, '50%': { opacity: '.85', transform: 'scale(1.08)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(8px)' } },
      },
      animation: {
        marquee: 'marquee 32s linear infinite',
        fade: 'fade .25s ease both',
        slidein: 'slidein .3s cubic-bezier(.2,.7,.2,1) both',
        rise: 'rise .3s cubic-bezier(.2,.7,.2,1) both',
        toast: 'toast 2.4s ease both',
        ember: 'ember 4s ease-in-out infinite',
        float: 'float 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 9: Write `apps/web/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: dark; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: #0a0a0b; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
::selection { background: #e4322b; color: #fff; }
input::placeholder { color: #5c5c63; }
```

- [ ] **Step 10: Write `apps/web/index.html`** (Google Fonts per master Design System)

```html
<!doctype html>
<html lang="es-AR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Resolute Force · Champion Mentality</title>
    <link rel="icon" href="/assets/logo-r.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Saira+Condensed:wght@500;600;700;800;900&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 11: Write the failing test `apps/web/src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

it('renders the Resolute Force wordmark', () => {
  render(<App />);
  expect(screen.getByText(/resolute/i)).toBeInTheDocument();
});
```

- [ ] **Step 12: Run the test to verify it fails**

Run: `npm install` (root) then `npm test --workspace @resolute/web`
Expected: FAIL — `Cannot find module './App'`.

- [ ] **Step 13: Write `apps/web/src/App.tsx`** (placeholder; M2 replaces it with the real landing)

```tsx
export default function App() {
  return (
    <main className="min-h-screen bg-bg text-tx font-body flex items-center justify-center">
      <h1 className="font-display font-extrabold tracking-[0.2em] uppercase text-2xl">
        Resolute<span className="text-red">·</span>Force
      </h1>
    </main>
  );
}
```

- [ ] **Step 14: Write `apps/web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 15: Run the test to verify it passes**

Run: `npm test --workspace @resolute/web`
Expected: PASS (1 test).

- [ ] **Step 16: Verify the dev build boots (manual smoke)**

Run: `npm run build --workspace @resolute/web`
Expected: Vite build completes with no TypeScript errors and emits `apps/web/dist/`.

- [ ] **Step 17: Commit**

```bash
git add -A && git commit -m "feat(web): vite+react+tailwind scaffold with brand tokens and smoke test"
```

---

### Task 4: Root verification & baseline commit

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite from the root**

Run: `npm test`
Expected: all three workspaces report PASS (shared 5, api 1, web 1).

- [ ] **Step 2: Run typecheck across workspaces**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Tag the scaffold baseline**

```bash
git add -A && git commit -m "chore: monorepo scaffold complete (M0)" --allow-empty
git tag m0-scaffold
```

---

## M0 done when

- `npm install` at root resolves the workspace graph (`@resolute/shared` linked into api and web).
- `npm test` is green across all three packages.
- `git tag m0-scaffold` exists. Proceed to `…-m1-catalog-api.md`.
