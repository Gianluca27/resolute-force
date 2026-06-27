# Resolute Force — Web App Implementation Plan (MASTER / OVERVIEW)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. This master file holds shared architecture, the data model, the design system, and the milestone roadmap. **Each milestone (M0–M6) is a sibling file** named `2026-06-26-resolute-force-m<N>-<slug>.md` with its own bite-sized `- [ ]` steps. Read this file first, then execute milestones in order.

**Goal:** Turn the static `Resolute Force(1).html` export into a real, production-quality e-commerce site — pixel-faithful React + Tailwind front end, Node/Express + Prisma/SQLite back end, real MercadoPago payments (Card Brick + Wallet), and a full admin panel (products, drop timer, orders, site content, metrics dashboard, order-notification emails).

**Architecture:** npm-workspaces monorepo. `apps/web` = Vite + React + TypeScript + Tailwind SPA (public landing + `/admin`). `apps/api` = Express + TypeScript REST API with Prisma/SQLite, JWT admin auth, MercadoPago SDK, Cloudinary uploads, Nodemailer. `packages/shared` = Zod schemas + TypeScript DTOs shared by both. The **server is the single source of truth for every price, total, and payment status**; the client never dictates money.

**Tech Stack:** Node 20 LTS · TypeScript (strict) · React 18 · Vite 5 · Tailwind CSS 3.4 · React Router 6 · TanStack Query 5 · Zustand 4 · Express 4 · Prisma 5 + SQLite · Zod · MercadoPago SDK (`mercadopago` v2 + `@mercadopago/sdk-react`) · Cloudinary · Nodemailer · jsonwebtoken + bcrypt · Vitest + Supertest + React Testing Library.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Node 20 LTS**, TypeScript `strict: true`, ES modules (`"type":"module"`) in every package.
- **UI copy is Spanish (es-AR)** and must match the source strings verbatim where they exist (see Design System → Copy strings).
- **Money is integer ARS pesos** (no centavos) everywhere — DB, API, MP. Format for display only: `'$' + n.toLocaleString('es-AR')`.
- **Server recomputes all prices/totals** from DB on every checkout/payment request. The client sends only `{ productId, size, qty }[]`; it never sends prices.
- **MercadoPago access token is server-only.** The browser receives only `VITE_MP_PUBLIC_KEY`. The **webhook is the source of truth** for payment status and must be **idempotent**.
- **Never oversell:** stock is validated at order creation and decremented inside a single Prisma `$transaction` when payment is confirmed.
- **Design fidelity is mandatory:** the public site reproduces the source's exact tokens, fonts, spacing, and animations (see Design System). No visual redesign. The admin panel reuses the same tokens for brand consistency.
- **Security:** all `/api/admin/*` and `/api/metrics*` routes require a valid admin JWT. Passwords hashed with bcrypt (cost 12). `helmet`, `cors` (allow-list `PUBLIC_WEB_URL`), and `express-rate-limit` on auth + payment routes.
- **TDD discipline:** every task is red → green → commit with Vitest. Commit messages use Conventional Commits (`feat:`, `test:`, `chore:`…).

---

## Decisions (locked with the user, 2026-06-26)

| Topic | Decision |
|---|---|
| Payments | MercadoPago **Card Payment Brick (embedded) + Wallet button** + manual Transfer (10% off) |
| Database | **SQLite + Prisma** (datasource swappable to Postgres later, code unchanged) |
| Admin scope | Products CRUD+stock · Drop timer · Orders · Site content · **Metrics dashboard** · **Email to admin on every purchase** (items incl. size+color + customer info) |
| Product images | **Cloudinary** (free tier; persists across redeploys) |

---

## Design System (extracted from source — reproduce exactly)

**CSS tokens** (source `data-rf-root` style):

| Token | Value | Token | Value |
|---|---|---|---|
| `bg` | `#0a0a0b` | `tx` | `#f4f4f3` |
| `panel` | `#0e0e10` | `mut` | `#97979d` |
| `card` | `#161619` | `red` | `#e4322b` |
| `line` | `rgba(255,255,255,.08)` | `redd` | `#bb211c` |
| `line2` | `rgba(255,255,255,.16)` | `gold` | `#e8b53e` |

`::selection` = bg `#e4322b` / color `#fff`. Input placeholder color `#5c5c63`.

**Fonts:** display `--fd` = `'Saira Condensed'` (weights 500–900); body `--fb` = `'Barlow'` (weights 400–700). Load via Google Fonts in `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Saira+Condensed:wght@500;600;700;800;900&display=swap" rel="stylesheet">
```

**Keyframes (exact)** — go in `apps/web/src/index.css` and are registered in Tailwind `theme.extend.keyframes`/`animation`:
```css
@keyframes rf-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes rf-fade{from{opacity:0}to{opacity:1}}
@keyframes rf-slidein{from{opacity:0;transform:translateX(36px)}to{opacity:1;transform:translateX(0)}}
@keyframes rf-rise{from{opacity:0;transform:translateY(24px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes rf-toast{0%{opacity:0;transform:translate(-50%,16px)}12%{opacity:1;transform:translate(-50%,0)}88%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,16px)}}
@keyframes rf-ember{0%,100%{opacity:.45;transform:scale(1)}50%{opacity:.85;transform:scale(1.08)}}
@keyframes rf-float{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}
```
Animation usages: `rf-marquee 32s linear infinite`, `rf-fade .25s ease both`, `rf-slidein .3s cubic-bezier(.2,.7,.2,1) both`, `rf-rise .3s cubic-bezier(.2,.7,.2,1) both`, `rf-toast 2.4s ease both`, `rf-ember 4s ease-in-out infinite`, `rf-float 2.6s ease-in-out infinite`.

**Body:** `background:#0a0a0b; -webkit-font-smoothing:antialiased; overflow-x:hidden`. `html{scroll-behavior:smooth}`.

**Assets** (in `Sitio web Resolute Force.zip`, md5-verified mapping):

| File | Role |
|---|---|
| `logo-r.png` | logo — nav, footer, hero watermark, checkout header, drop section |
| `teaser-burst.png` | Manifiesto image (`alt="Atleta… rompiendo el papel"`) |
| `lifestyle-gym.png` | Historia image (`alt="Colección… en el gimnasio"`) |
| `tile-navy/black/olive/white.png` | product-grid cards + cart thumbnails (the 4 seed products) |
| `prod-navy/black/olive/white.png` | hi-res product shots — not in the export; reserved for product zoom/detail |

**Copy strings (verbatim, from source):**
- Marquee: `Envíos a todo el país` · `Champion Mentality` · `3 cuotas sin interés` · `Stop at Nothing` · `Calidad premium` · `The Resolute Standard`
- Nav links: `Productos` `Manifiesto` `Historia` `Contacto` · cart button `Carrito`
- Hero kicker: `Est. 2024 · Indumentaria de alto rendimiento`; titles `Champion` / `Mentality`; subtitle `No vendemos remeras. Forjamos una mentalidad…`; CTAs `Ver colección` / `El manifiesto`.
- Manifiesto: `La presión no te quiebra.` / `Te forja.` + 3 principles (`Champions think under pressure` / `Discipline is the key` / `Stop at nothing`).
- Productos header: `La colección` / `Resolute '26`; footnote `Precios en pesos · 3 cuotas sin interés · 10% OFF pagando por transferencia`.
- Historia stats: `2024` / `+5.000` / `100%`.
- Próximos: kicker `Próximo lanzamiento`, title `Algo se está` / `forjando`, teaser `Un nuevo drop está entrando al fuego. Hoodies, oversize y la línea Pressure. Preparate.`, default target `2026-08-15T20:00:00-03:00`.
- Contacto: WhatsApp `+54 341 321-3723` (`5493413213723`), Instagram `@resoluteforceok`, Email `resolutecontacto@gmail.com`, Ubicación `Buenos Aires · Envíos a todo el país`.
- Checkout steps: `Tus datos` / `Forma de pago` / `Listo`; confirm `¡Pedido confirmado!`; tagline `Stop at nothing 🔥`.

---

## Data Model (Prisma — `apps/api/prisma/schema.prisma`)

SQLite has no native enums; status/method/size are validated strings (Zod enforces). Money fields are integer ARS.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }

model Product {
  id            String      @id @default(cuid())
  slug          String      @unique
  line          String      // e.g. "Champion Mentality"
  color         String      // e.g. "Azul Marino"
  dotColor      String      // hex swatch, e.g. "#1f2a44"
  tag           String?     // "Nuevo" | "Más vendida" | null
  price         Int         // ARS pesos
  imageUrl      String      // Cloudinary URL (or /assets seed path)
  imagePublicId String?     // Cloudinary public_id for deletion
  active        Boolean     @default(true)
  sortOrder     Int         @default(0)
  variants      Variant[]
  orderItems    OrderItem[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model Variant {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  size      String  // "S" | "M" | "L" | "XL"
  stock     Int     @default(0)
  @@unique([productId, size])
}

model Order {
  id             String      @id @default(cuid())
  orderNo        String      @unique // "RF-XXXXXX"
  customerName   String
  customerEmail  String
  customerPhone  String?
  address        String
  city           String
  paymentMethod  String      // "transfer" | "card" | "wallet"
  status         String      @default("pending") // pending|paid|shipped|cancelled
  subtotal       Int
  discount       Int         @default(0)
  total          Int
  mpPaymentId    String?
  mpPreferenceId String?
  items          OrderItem[]
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
}

model OrderItem {
  id        String   @id @default(cuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String?
  product   Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  line      String   // snapshot — survives product edits/deletes
  color     String
  size      String
  unitPrice Int
  qty       Int
}

model DropConfig {
  id        Int      @id @default(1) // singleton row
  targetAt  DateTime
  visible   Boolean  @default(true)
  title     String   @default("Algo se está forjando")
  teaser    String
  updatedAt DateTime @updatedAt
}

model SiteContent {
  id                  Int      @id @default(1) // singleton row
  marquee             String   // JSON string[] 
  heroKicker          String
  heroTitle1          String
  heroTitle2          String
  heroSubtitle        String
  transferDiscountPct Int      @default(10)
  bankAlias           String   @default("")
  bankCbu             String   @default("")
  contactWhatsapp     String
  contactInstagram    String
  contactEmail        String
  contactLocation     String
  updatedAt           DateTime @updatedAt
}

model AdminUser {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}

model Visit {
  id        String   @id @default(cuid())
  path      String
  createdAt DateTime @default(now())
}
```

---

## Monorepo File Structure

```
resolute-force/
├─ package.json                 # workspaces: ["apps/*","packages/*"], shared scripts
├─ tsconfig.base.json
├─ .gitignore  .env.example  README.md
├─ _source/                     # original export, moved here for provenance
│   ├─ Resolute Force(1).html
│   └─ Sitio web Resolute Force.zip
├─ docs/superpowers/plans/      # this file + milestone files
├─ packages/shared/
│   ├─ package.json  tsconfig.json
│   └─ src/{index.ts, dto.ts, schemas.ts}     # Zod + DTO types
└─ apps/
   ├─ api/
   │   ├─ package.json  tsconfig.json  vitest.config.ts  .env
   │   ├─ prisma/{schema.prisma, seed.ts}
   │   ├─ src/
   │   │   ├─ index.ts            # listen()
   │   │   ├─ app.ts              # createApp() — used by tests
   │   │   ├─ env.ts              # Zod-validated process.env
   │   │   ├─ prisma.ts           # PrismaClient singleton
   │   │   ├─ lib/{money.ts, jwt.ts, mp.ts, cloudinary.ts, mailer.ts}
   │   │   ├─ middleware/{auth.ts, error.ts, rateLimit.ts}
   │   │   ├─ services/{pricing.ts, orders.ts, stock.ts, metrics.ts}
   │   │   └─ routes/{products.ts, drop.ts, content.ts, checkout.ts,
   │   │             payments.ts, track.ts, admin/{auth,products,orders,drop,content}.ts, metrics.ts}
   │   └─ tests/                  # mirrors src/, Vitest + Supertest
   └─ web/
       ├─ package.json  tsconfig.json  vite.config.ts
       ├─ tailwind.config.ts  postcss.config.js  vitest.config.ts  index.html
       ├─ public/assets/         # the 11 PNGs + favicon
       └─ src/
           ├─ main.tsx  App.tsx  index.css
           ├─ lib/{api.ts, money.ts, mp.ts, queryClient.ts}
           ├─ store/cart.ts                    # Zustand + localStorage
           ├─ hooks/{useProducts,useDrop,useContent,useCountdown}.ts
           ├─ components/{Marquee,Nav,Hero,Manifiesto,Productos,ProductCard,
           │             Historia,Proximos,Contacto,Footer,CartDrawer,
           │             CheckoutModal,Toast,Field,Money}.tsx
           └─ pages/{Landing.tsx, CheckoutSuccess.tsx, CheckoutFailure.tsx,
                     admin/{AdminLayout,Login,Dashboard,Products,ProductForm,
                            Orders,Drop,Content,Metrics}.tsx}
```

---

## Environment Variables (`.env.example`)

**apps/api/.env**
```
DATABASE_URL="file:./dev.db"
PORT=4000
PUBLIC_WEB_URL="http://localhost:5173"
PUBLIC_API_URL="http://localhost:4000"
JWT_SECRET="change-me-long-random"
ADMIN_EMAIL="resolutecontacto@gmail.com"
ADMIN_PASSWORD="change-me-strong"            # seeds first admin
MP_ACCESS_TOKEN="APP_USR-..."                # server only
MP_PUBLIC_KEY="APP_USR-..."                  # echoed to web build
MP_WEBHOOK_SECRET=""                         # optional MP signature secret
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_USER="resolutecontacto@gmail.com"
SMTP_PASS="gmail-app-password"
MAIL_FROM="Resolute Force <resolutecontacto@gmail.com>"
ADMIN_NOTIFY_EMAIL="resolutecontacto@gmail.com"
```
**apps/web/.env**
```
VITE_API_URL="http://localhost:4000"
VITE_MP_PUBLIC_KEY="APP_USR-..."
```

---

## Shared DTOs / Interfaces (`packages/shared`)

These names are the contract between web and api; every milestone consumes them.

```ts
// CartLineInput — client → server (NO price)
export interface CartLineInput { productId: string; size: string; qty: number; }

// CustomerInput — checkout form
export interface CustomerInput {
  nombre: string; email: string; tel?: string; dir: string; ciudad: string;
}

// QuoteResult — server → client (authoritative money)
export interface QuoteLine { productId: string; line: string; color: string; size: string; unitPrice: number; qty: number; lineTotal: number; }
export interface QuoteResult { lines: QuoteLine[]; subtotal: number; transferDiscount: number; totalTransfer: number; totalCard: number; }

// ProductDTO — catalog
export interface ProductVariantDTO { size: string; stock: number; }
export interface ProductDTO { id: string; slug: string; line: string; color: string; dotColor: string; tag: string|null; price: number; imageUrl: string; sizes: ProductVariantDTO[]; }

// DropDTO / ContentDTO / OrderDTO … (defined in their milestones)
```

---

## Milestone Roadmap & Requirement Coverage

Execute in order. Each milestone ends with **working, testable software**.

| # | File | Delivers | Covers |
|---|---|---|---|
| **M0** | `…-m0-scaffold.md` | Monorepo, workspaces, shared pkg, TS/Vitest/lint, Prisma init, env validation, git. `npm test` green. | foundation |
| **M1** | `…-m1-catalog-api.md` | Prisma schema + migration + seed (4 products, drop, content). Pricing helper. `GET /api/products`, `/api/drop`, `/api/content`. | data model, drop, content |
| **M2** | `…-m2-frontend-port.md` | Pixel-faithful React+Tailwind landing (marquee, nav, hero, manifiesto, productos, historia, **countdown**, contacto, footer), data-driven from API. | "estilo igual", React+Tailwind, drop timer render |
| **M3** | `…-m3-cart-checkout.md` | Zustand cart, cart drawer, checkout modal (datos → pago → confirmado), `POST /api/checkout/quote` server price recompute, transfer order path. | cart/checkout UX, money safety |
| **M4** | `…-m4-mercadopago.md` | Orders API, MP **Card Brick + Wallet**, `POST /api/payments/*`, `/webhook`, stock decrement, success/failure pages. | MercadoPago |
| **M5** | `…-m5-emails.md` | Nodemailer; admin notification + customer confirmation on paid/transfer order (items, size, color, customer). | "email en cada compra" |
| **M6** | `…-m6-admin.md` | JWT auth, `/admin` SPA: products CRUD + Cloudinary, drop config, content, orders mgmt, **metrics dashboard** + visit tracking. | admin, métricas |

**Spec coverage check:** React+Tailwind+Express ✅ (M0–M6) · same style ✅ (M2/M3/M6 reuse tokens) · MercadoPago ✅ (M4) · admin products ✅ (M6) · drop timer ✅ (M1 model + M2 render + M6 config) · "demás"/content ✅ (M1+M2+M6) · metrics ✅ (M6) · purchase email ✅ (M5).

---

## Deployment notes (going live)

- **Single Node host** (Railway / Render / Fly / VPS) runs `apps/api`; serve `apps/web`'s `dist/` as static (either from the same Express via `express.static` in production, or a static host like Netlify/Vercel pointing `VITE_API_URL` at the API).
- **Database:** SQLite file lives on a **persistent volume** (Railway/Render volumes) so `dev.db`/`prod.db` survives redeploys. Run `prisma migrate deploy` on release. To scale later, switch `datasource db { provider }` to `postgresql` and point `DATABASE_URL` at a managed Postgres — application code is unchanged.
- **MercadoPago:** set production `MP_ACCESS_TOKEN`/`MP_PUBLIC_KEY`. The webhook needs a **public HTTPS URL**: set `PUBLIC_API_URL` to the deployed API origin so `notification_url` resolves; register `${PUBLIC_API_URL}/api/payments/webhook` in the MP dashboard. Keep the access token server-only.
- **Cloudinary / SMTP:** set `CLOUDINARY_*` and `SMTP_*` + `ADMIN_NOTIFY_EMAIL`. For Gmail use an App Password.
- **Admin:** set a strong `ADMIN_PASSWORD` and a long random `JWT_SECRET`; run the seed once to create the admin user.
- **CORS:** set `PUBLIC_WEB_URL` to the deployed web origin.

## How to execute

All milestone files (M0–M6) are written and live beside this one in `docs/superpowers/plans/`:

| Order | File | Tag on completion |
|---|---|---|
| 1 | `2026-06-26-resolute-force-m0-scaffold.md` | `m0-scaffold` |
| 2 | `2026-06-26-resolute-force-m1-catalog-api.md` | `m1-catalog-api` |
| 3 | `2026-06-26-resolute-force-m2-frontend-port.md` | `m2-frontend-port` |
| 4 | `2026-06-26-resolute-force-m3-cart-checkout.md` | `m3-cart-checkout` |
| 5 | `2026-06-26-resolute-force-m4-mercadopago.md` | `m4-mercadopago` |
| 6 | `2026-06-26-resolute-force-m5-emails.md` | `m5-emails` |
| 7 | `2026-06-26-resolute-force-m6-admin.md` | `m6-admin` |

1. Read this master file.
2. Run `…-m0-scaffold.md` top-to-bottom (subagent-driven or inline).
3. After each milestone's final commit + tag, proceed to the next file. Each milestone leaves working, testable software.
