# Resolute Force — Full QA Testing Guide

> AR gym-apparel store (Spanish es-AR). React + Vite + Tailwind web · Express + Prisma/SQLite API · MercadoPago payments · admin panel.
> This guide tests **the shipped code**, not the plans. Where code diverges from the original plan, cases say so.

**Goal:** cover **every** scenario — happy paths, negative paths, boundary values, edge cases, concurrency, security, accessibility, and responsive behavior. Not just the happy path.

---

## How to use this guide

1. Read this README (setup + canonical test data + conventions).
2. Pick a module file from the index. Each module has its own coverage checklist and numbered test cases.
3. Execute cases, record results in the **Test Run Report** (template below).
4. File any failure as a bug using the **Bug Report template** (below). Check the **Candidate defects** appendix first — several are pre-identified.

---

## Module index

| # | Module | File | Layer |
|---|--------|------|-------|
| 1 | Catalog API | [01-catalog-api.md](01-catalog-api.md) | Backend |
| 2 | Landing page & UI | [02-landing-ui.md](02-landing-ui.md) | Frontend |
| 3 | Cart | [03-cart.md](03-cart.md) | Frontend |
| 4 | Checkout flow & validation | [04-checkout.md](04-checkout.md) | Full-stack |
| 5 | Payments (Card / Wallet / Transfer) | [05-payments.md](05-payments.md) | Full-stack |
| 6 | Webhook & order lifecycle | [06-webhook-order-lifecycle.md](06-webhook-order-lifecycle.md) | Backend |
| 7 | Emails (admin + customer) | [07-emails.md](07-emails.md) | Backend |
| 8 | Admin authentication | [08-admin-auth.md](08-admin-auth.md) | Full-stack |
| 9 | Admin products CRUD + Cloudinary | [09-admin-products.md](09-admin-products.md) | Full-stack |
| 10 | Admin orders | [10-admin-orders.md](10-admin-orders.md) | Full-stack |
| 11 | Admin drop & site content | [11-admin-config.md](11-admin-config.md) | Full-stack |
| 12 | Admin metrics dashboard | [12-admin-metrics.md](12-admin-metrics.md) | Full-stack |
| 13 | Cross-cutting (security, rate limit, CORS, errors, i18n, perf) | [13-cross-cutting.md](13-cross-cutting.md) | Full-stack |

---

## Environment setup

### Monorepo layout
```
apps/api      @resolute/api   Express 4 + Prisma 5 + SQLite (port 4000)
apps/web      @resolute/web   Vite 5 + React 18 + Tailwind 3.4 (port 5173)
packages/shared  @resolute/shared  Zod schemas + DTOs (imported as TS source)
```
Node >= 20. npm workspaces.

### Commands
| Action | Command |
|--------|---------|
| Install | `npm install` (repo root) |
| Migrate DB | `cd apps/api && npx prisma migrate dev --name init` |
| Seed DB | `cd apps/api && npm run seed` (prints `[seed] done`) |
| Run API | `npm run dev:api` → http://localhost:4000 |
| Run web | `npm run dev:web` → http://localhost:5173 |
| Unit/integration tests | `npm test` (all workspaces) |
| Typecheck | `npm run typecheck` |

### Required env (`apps/api/.env`, copy from `.env.example`)
For manual QA you must set these or whole flows silently no-op:

| Var | Why it matters for QA |
|-----|-----------------------|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | **Admin user is seeded ONLY if `ADMIN_PASSWORD` is non-empty.** Set both, then `npm run seed`, to test the admin panel. |
| `JWT_SECRET` (≥32 chars) | Admin login tokens. In `NODE_ENV=production` the API refuses to boot on the dev default. |
| `MP_ACCESS_TOKEN` / `MP_PUBLIC_KEY` | MercadoPago. Use **TEST** credentials from the MP sandbox. In prod the API refuses to boot on placeholder values. |
| `MP_WEBHOOK_SECRET` | Empty ⇒ webhook signature check is **skipped** (dev). Set it to test 401 rejection. |
| `SMTP_HOST` + `SMTP_USER` | Mailer is enabled only when **both** are non-empty; otherwise every email silently no-ops. |
| `ADMIN_NOTIFY_EMAIL` | Empty ⇒ admin purchase email silently skipped. |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | Empty ⇒ image uploads fail (500). Needed to test product images. |
| `bankAlias` / `bankCbu` | NOT env — set via admin **Contenido**. Empty by default ⇒ transfer instructions/email show no bank data. Set them to test the transfer path fully. |

Web env (`apps/web/.env`): `VITE_API_URL` (default `http://localhost:4000`), `VITE_MP_PUBLIC_KEY`.

### Test accounts & fixtures
- **Admin (automated tests):** `admin@test.com` / `secret123` (vitest env).
- **Admin (manual QA):** whatever you set in `apps/api/.env` then seeded.
- **MercadoPago:** use sandbox test cards (approved / rejected / pending) and a TEST buyer account. See MP docs for the current test-card numbers per outcome.

---

## Canonical seed data (the baseline every test starts from)

Re-seeding is idempotent (`upsert` with `update:{}` on drop/content; products refresh metadata but **not** stock). To fully reset, reset the DB then seed.

### Products — 4 rows, all `price = 30000`, all `active = true`
Each product has 4 variants **S / M / L / XL**, every variant `stock = 25`.

| sortOrder | slug | line | color | dotColor | tag |
|-----------|------|------|-------|----------|-----|
| 0 | `champion-mentality-azul-marino` | Champion Mentality | Azul Marino | `#1f2a44` | `Más vendida` |
| 1 | `champion-mentality-negro` | Champion Mentality | Negro | `#101013` | (none) |
| 2 | `champion-mentality-verde-militar` | Champion Mentality | Verde Militar | `#4a5235` | (none) |
| 3 | `stop-at-nothing-blanco` | Stop at Nothing | Blanco | `#e9e9ea` | `Nuevo` |

> Note: client sends the product **cuid** (`product.id`), not the slug, in cart/checkout payloads.

### DropConfig (singleton id=1)
`targetAt = 2026-08-15T20:00:00-03:00` · `visible = true` · `title = "Algo se está forjando"` · `teaser = "Un nuevo drop está entrando al fuego. Hoodies, oversize y la línea Pressure. Preparate."`

### SiteContent (singleton id=1)
- `marquee` (6): `Envíos a todo el país`, `Champion Mentality`, `3 cuotas sin interés`, `Stop at Nothing`, `Calidad premium`, `The Resolute Standard`
- `heroKicker = "Est. 2024 · Indumentaria de alto rendimiento"`
- `heroTitle1 = "Champion"`, `heroTitle2 = "Mentality"`
- `heroSubtitle = "No vendemos remeras. Forjamos una mentalidad. Indumentaria deportiva para los que entrenan bajo presión y no se detienen ante nada."`
- `transferDiscountPct = 10` · `bankAlias = ""` · `bankCbu = ""` (both empty)
- `contactWhatsapp = "5493413213723"` · `contactInstagram = "@resoluteforceok"` · `contactEmail = "resolutecontacto@gmail.com"` · `contactLocation = "Buenos Aires · Envíos a todo el país"`

### Money & locale
- All money is **integer ARS** (no centavos) everywhere: DB, API, MP.
- Display format: `'$' + n.toLocaleString('es-AR')` → **dot** thousands separator. `30000` → `$30.000`, `27000` → `$27.000`, `60000` → `$60.000`.
- All UI copy is Spanish es-AR; `<html lang="es-AR">`.

### Pricing formulas (server is the source of truth)
`computeTotals(subtotal, transferPct)`:
- `transferDiscount = Math.round(subtotal * transferPct/100)`
- `totalTransfer = subtotal − transferDiscount`
- `totalCard = subtotal`

`transferPct = SiteContent.transferDiscountPct ?? 10`. Worked examples: `30000 → {disc 3000, transfer 27000, card 30000}`; `60000 → {6000, 54000, 60000}`.

### Order status lifecycle
States: `pending | paid | shipped | cancelled`. Stock is reserved **iff** status ∈ `{paid, shipped}` (`STOCK_HELD`). Order number format `RF-` + 6 digits (`/^RF-\d{6}$/`).

---

## Conventions

### Test case format (used in every module)
```
### TC-PREFIX-NNN: Title
- Priority: P0 | P1 | P2 | P3
- Type: Functional | Negative | Boundary | UI | Integration | Security | Accessibility | Responsive | Concurrency
- Preconditions: ...
- Steps → Expected:
  1. <action> → Expected: <result>
- Notes: edge cases, data, divergences
```

### Severity / Priority
| Level | Criteria | Examples |
|-------|----------|----------|
| **P0 / Critical** | Crash, data loss, money/stock wrong, security, payment broken | Oversell, charge kept after stock race, auth bypass |
| **P1 / High** | Major feature broken, no workaround | Checkout can't complete, admin can't edit product |
| **P2 / Medium** | Partial feature, workaround exists | Filter missing, wrong copy, minor validation gap |
| **P3 / Low** | Cosmetic, rare edge | Typo, alignment, casing inconsistency |

### Pass/Fail for a release
- **PASS:** all P0 pass, ≥90% P1 pass, no open Critical bug.
- **FAIL (block release):** any P0 fails, any Critical/security/oversell bug, data-loss scenario.

---

## Regression suites

### Smoke (15–30 min) — run on every build
1. API health `GET /api/health` → `{ok:true}`.
2. Landing loads; marquee, hero, 4 products, countdown, contacto all render.
3. Add product to cart → cart badge increments → drawer opens.
4. Checkout step 0 → valid data → quote → step 1.
5. Transfer order completes → confirmation shows order number `RF-######`.
6. Card payment (approved test card) → success → cart cleared.
7. Admin login → products list loads → metrics load.

### Targeted (per change, 30–60 min)
Run the module(s) touched by the change + the smoke suite. Stock/payment changes → always run Modules 5 & 6 in full.

### Full (2–4 h) — pre-release
Every module, every priority. Plus the concurrency/oversell cases (Module 6) and the security cases (Module 13).

---

## Bug Report template
```
# BUG-NNN: [Module] <specific title: issue when action>
Severity: Critical|High|Medium|Low   Priority: P0|P1|P2|P3   Type: Functional|UI|Security|Perf
Environment: OS / Browser+version / Build commit / API+Web URLs / NODE_ENV
Preconditions: <seed state, env vars set, account>
Steps to reproduce:
  1. ...
Expected: <what should happen — cite the rule/formula>
Actual: <what happened>
Evidence: screenshot / HAR / API response body / server log line / console error
Impact: users affected · frequency (always/sometimes) · workaround
Related: TC-PREFIX-NNN · plan/file path
```

## Test Run Report template
```
# Test Run: <build/commit> — <date> — <tester> — <env>
Totals: executed X / pass / fail / blocked / not-run — pass rate %
By priority: P0 a/b · P1 · P2 · P3
Critical failures: <list with BUG ids>
Blocked: <list + reason>
Go/No-Go recommendation:
```

---

## Appendix — Candidate defects to verify first

These were surfaced while mapping code vs. plan. Each is a ready-made test target; confirm and file if reproduced.

| ID | Area | Suspected issue | Module |
|----|------|-----------------|--------|
| CD-1 | Catalog API | RESOLVED / verify-only — `getProductBySlug` uses `findFirst({ where: { slug, active: true } })`, so an inactive product's slug returns **404** (correct, not a leak). Regression-test that it stays 404 and never exposes inactive products. | 1, 9 |
| CD-2 | Catalog API | Two different 404 bodies: product route `{error:'Producto no encontrado'}` (Spanish) vs global `{error:'Not found'}` (English). | 1, 13 |
| CD-3 | Cart UI | Cart line renders `qty × unitPrice` (e.g. `2 × $30.000`) instead of the line total `$60.000` — diverges from plan/expectation. | 3 |
| CD-4 | Content/Productos | Productos section footer hardcodes "10% OFF" while the checkout transfer badge is computed dynamically from `transferDiscount/subtotal` — they desync if admin changes `transferDiscountPct`. | 4, 11 |
| CD-5 | Admin content | Web `transferDiscountPct` input has **no min/max**; server enforces `0–90`. Submitting 95 or −5 must return 400, not silently apply. | 11 |
| CD-6 | Admin products | Duplicate slug isn't pre-checked → surfaces as **500** (generic) instead of a friendly 400/409. | 9 |
| CD-7 | Admin auth | `ProtectedRoute` checks token **existence only**, not validity/expiry. A 12h-expired/tampered token renders the admin UI until the first API 401 auto-logs-out. | 8 |
| CD-8 | Content XSS | SiteContent fields (marquee/hero/bank/contact) are stored verbatim (API does not sanitize on write). Emails escape them, but verify the **public landing** escapes them too. | 11, 13 |
| CD-9 (resuelto) | Copy | Casing canónico `Stop at Nothing` aplicado al seed de producto, marquee/hero y web — sin inconsistencia. | 1, 2 |
| CD-10 | Admin products | Product update **prunes variants** whose size is absent from the payload (deleteMany size notIn). Concurrent edits are last-write-wins and can drop sizes. | 9 |
| CD-11 | Transfer | With default seed (`bankAlias`/`bankCbu` empty) a transfer order succeeds but shows **no bank details** in UI or email — customer can't pay. | 5, 7, 11 |
| CD-12 | Landing / Drop | Countdown clamps to `00:00:00:00` forever once the target passes — no "launched"/expired state and no auto-hide. | 2 |
| CD-13 | Landing / Drop | A single-word drop `title` double-renders the last word (last-word styling pops an empty remainder). | 2 |
| CD-14 | Landing / a11y | No `prefers-reduced-motion` handling — marquee and countdown animate regardless of OS setting. | 2, 13 |
| CD-15 | Landing | WhatsApp number (`+54 341 321-3723`) and footer year (`© 2026`) are hardcoded in markup — desync from `SiteContent.contactWhatsapp` and real year. | 2 |
| CD-16 | Landing | `GET /api/content` failure gates the **whole** page, while `/api/products` and `/api/drop` failures degrade silently — inconsistent error handling. | 2 |
| CD-17 | Checkout | `Landing.tsx` renders `{checkoutOpen && <CheckoutModal/>}`, so closing the modal **unmounts** it and discards typed customer data; the `setStep(0)` in `close()` is dead code. Reopen ⇒ fields lost (cart survives). | 4 |
| CD-18 | Checkout | The "No se pudo cotizar" friendly fallback is effectively unreachable — a fetch network failure throws a `TypeError`, so the raw browser message ("Failed to fetch") shows instead. | 4 |
| CD-19 | Admin orders | `Orders.tsx` has no error UI — a failed status PATCH (422 revert-guard / 409 oversell) fails **silently**; the admin sees no feedback. | 10 |
| CD-20 | Landing | Toast "success" checkmark is rendered in brand **red** `#e4322b`, not green — reads as an error color for a success message. | 2 |
| CD-9b (resuelto) | Landing | Fuentes normalizadas a `Stop at Nothing` (Manifiesto + checkout taglines); ya no hay tres casings. | 1, 2 |
