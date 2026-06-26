# M4 — Orders + MercadoPago (Card Brick + Wallet) + Webhook + Stock

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`. Read the master file first (Global Constraints: server is source of truth; webhook is source of truth for payment status; never oversell). Requires M3 (`git tag m3-cart-checkout`).

**Goal:** Persist real orders, charge through MercadoPago — **embedded Card Payment Brick** and **Wallet** — plus a manual **Transfer** path. Confirm payment via a webhook, decrement stock atomically on `paid`, and add `/checkout/success|failure` return pages.

**Architecture:** The API re-quotes every order server-side (ignores client money), creates a `pending` order, then: **card** → `mp.createCardPayment(token)` synchronously (approved ⇒ `paid` + stock decrement); **wallet** → `mp.createPreference()` ⇒ browser pays on MP ⇒ **webhook** finalizes; **transfer** → pending order + bank details by email (M5), admin confirms later. Stock decrements only inside the `markPaid` transaction, guarded by a conditional `updateMany`. The MercadoPago SDK lives behind `src/lib/mp.ts` so tests mock it.

**Tech Stack:** `mercadopago` v2 (server), `@mercadopago/sdk-react` (Brick/Wallet), Express + Zod.

**Deliverable:** A real approved card payment marks the order `paid` and reduces stock; wallet returns through MP; transfer creates a pending order. All api + web tests green (MP mocked).

---

### Task 1: env, MercadoPago wrapper, orders service

**Files:**
- Modify: `apps/api/src/env.ts`, `apps/api/package.json`
- Create: `apps/api/src/lib/mp.ts`, `apps/api/src/services/orders.ts`
- Test: `apps/api/tests/orders.test.ts`

**Interfaces:**
- Consumes: `quote()` (M3), `prisma`.
- Produces: `createOrder({items,customer,method})` → `{ order, quote }`; `markPaidByOrderNo(orderNo, mpPaymentId)` (idempotent, decrements stock); `mp.createCardPayment/createPreference/getPayment`.

- [ ] **Step 1: Install the MercadoPago SDK**

```bash
npm install --workspace @resolute/api mercadopago@^2.0.15
```

- [ ] **Step 2: Extend `apps/api/src/env.ts`** (add MP + public URLs; all default to safe test values)

```ts
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('file:./dev.db'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),
  JWT_SECRET: z.string().default('dev-secret-change-me'),
  MP_ACCESS_TOKEN: z.string().default('TEST-ACCESS-TOKEN'),
  MP_PUBLIC_KEY: z.string().default('TEST-PUBLIC-KEY'),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
```

- [ ] **Step 3: Write `apps/api/src/lib/mp.ts`** (thin wrapper — the only place that imports the SDK)

```ts
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import type { QuoteLine, CustomerInput } from '@resolute/shared';
import { env } from '../env';

const client = new MercadoPagoConfig({ accessToken: env.MP_ACCESS_TOKEN });
const payment = new Payment(client);
const preference = new Preference(client);

export async function createCardPayment(i: {
  amount: number; token: string; installments: number; paymentMethodId: string; issuerId?: string;
  payerEmail: string; identification?: { type: string; number: string }; orderNo: string;
}) {
  const res = await payment.create({
    body: {
      transaction_amount: i.amount, token: i.token, installments: i.installments,
      payment_method_id: i.paymentMethodId, issuer_id: i.issuerId,
      payer: { email: i.payerEmail, identification: i.identification },
      external_reference: i.orderNo, description: `Resolute Force ${i.orderNo}`,
      notification_url: `${env.PUBLIC_API_URL}/api/payments/webhook`,
    },
  });
  return { id: res.id, status: res.status, statusDetail: res.status_detail };
}

export async function createPreference(i: { orderNo: string; customer: CustomerInput; lines: QuoteLine[] }) {
  const res = await preference.create({
    body: {
      items: i.lines.map((l) => ({ id: l.productId, title: `${l.line} · ${l.color} (${l.size})`, quantity: l.qty, unit_price: l.unitPrice, currency_id: 'ARS' })),
      payer: { name: i.customer.nombre, email: i.customer.email },
      external_reference: i.orderNo,
      back_urls: { success: `${env.PUBLIC_WEB_URL}/checkout/success`, failure: `${env.PUBLIC_WEB_URL}/checkout/failure`, pending: `${env.PUBLIC_WEB_URL}/checkout/pending` },
      auto_return: 'approved',
      notification_url: `${env.PUBLIC_API_URL}/api/payments/webhook`,
    },
  });
  return { id: String(res.id), initPoint: String(res.init_point) };
}

export async function getPayment(id: string) {
  const res = await payment.get({ id });
  return { id: res.id, status: res.status, externalReference: res.external_reference };
}
```

- [ ] **Step 4: Write the failing test `apps/api/tests/orders.test.ts`**

```ts
import { beforeEach, describe, it, expect } from 'vitest';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';
import { prisma } from '../src/prisma';
import { createOrder, markPaidByOrderNo } from '../src/services/orders';

const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', dir: 'Calle 1', ciudad: 'CABA' };
let navyId = '';
beforeEach(async () => {
  await resetDb();
  await seed();
  navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
});

describe('createOrder', () => {
  it('persists a pending order with server-priced items', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, method: 'card' });
    expect(order.status).toBe('pending');
    expect(order.total).toBe(60000);
    expect(order.items[0]!.unitPrice).toBe(30000);
    expect(order.orderNo).toMatch(/^RF-\d{6}$/);
  });

  it('applies the transfer discount to the order total', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, method: 'transfer' });
    expect(order.total).toBe(27000);
    expect(order.discount).toBe(3000);
  });
});

describe('markPaidByOrderNo', () => {
  it('marks paid and decrements stock once (idempotent)', async () => {
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 3 }], customer, method: 'card' });
    await markPaidByOrderNo(order.orderNo, 'PAY-1');
    await markPaidByOrderNo(order.orderNo, 'PAY-1'); // second call must not double-decrement
    const v = await prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } });
    expect(v.stock).toBe(22); // 25 − 3
    const reread = await prisma.order.findUniqueOrThrow({ where: { orderNo: order.orderNo } });
    expect(reread.status).toBe('paid');
  });
});
```

- [ ] **Step 5: Run (fail), then write `apps/api/src/services/orders.ts`**

```ts
import type { CartLineInput, CustomerInput } from '@resolute/shared';
import { prisma } from '../prisma';
import { quote } from './quote';

export type PayMethod = 'transfer' | 'card' | 'wallet';

async function uniqueOrderNo(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const no = 'RF-' + Math.floor(100000 + Math.random() * 900000);
    if (!(await prisma.order.findUnique({ where: { orderNo: no } }))) return no;
  }
  throw new Error('No se pudo generar número de orden');
}

export async function createOrder(input: { items: CartLineInput[]; customer: CustomerInput; method: PayMethod }) {
  const q = await quote(input.items); // re-price + stock check, server-side
  const discount = input.method === 'transfer' ? q.transferDiscount : 0;
  const total = input.method === 'transfer' ? q.totalTransfer : q.totalCard;
  const orderNo = await uniqueOrderNo();
  const order = await prisma.order.create({
    data: {
      orderNo,
      customerName: input.customer.nombre, customerEmail: input.customer.email, customerPhone: input.customer.tel ?? null,
      address: input.customer.dir, city: input.customer.ciudad,
      paymentMethod: input.method, status: 'pending', subtotal: q.subtotal, discount, total,
      items: { create: q.lines.map((l) => ({ productId: l.productId, line: l.line, color: l.color, size: l.size, unitPrice: l.unitPrice, qty: l.qty })) },
    },
    include: { items: true },
  });
  return { order, quote: q };
}

export async function markPaidByOrderNo(orderNo: string, mpPaymentId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { orderNo }, include: { items: true } });
    if (!order) throw new Error(`Orden inexistente: ${orderNo}`);
    if (order.status === 'paid' || order.status === 'shipped') return order; // idempotent

    for (const it of order.items) {
      if (!it.productId) continue;
      const r = await tx.variant.updateMany({
        where: { productId: it.productId, size: it.size, stock: { gte: it.qty } },
        data: { stock: { decrement: it.qty } },
      });
      if (r.count !== 1) throw new Error(`Sin stock al confirmar ${it.line} talle ${it.size}`);
    }
    return tx.order.update({ where: { id: order.id }, data: { status: 'paid', mpPaymentId } });
  });
}
```

- [ ] **Step 6: Run → PASS, then commit**

```bash
npm test --workspace @resolute/api -- orders
git add -A && git commit -m "feat(api): orders service (createOrder, idempotent markPaid+stock) and MP wrapper"
```

---

### Task 2: Payment routes (card, preference, transfer, webhook) + public-key

**Files:**
- Create: `apps/api/src/routes/payments.ts`, `apps/api/src/routes/orders.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/payments.test.ts`

**Interfaces:**
- Consumes: `createOrder`, `markPaidByOrderNo`, `mp.*`, `siteContent` (bank data).
- Produces: `POST /api/payments/card|preference|webhook`, `GET /api/payments/public-key`, `POST /api/orders/transfer`.

- [ ] **Step 1: Write the failing test `apps/api/tests/payments.test.ts`** (MP wrapper mocked)

```ts
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/mp', () => ({
  createCardPayment: vi.fn(),
  createPreference: vi.fn().mockResolvedValue({ id: 'PREF-1', initPoint: 'https://mp.test/redirect' }),
  getPayment: vi.fn(),
}));

import request from 'supertest';
import { createApp } from '../src/app';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';
import { prisma } from '../src/prisma';
import * as mp from '../src/lib/mp';

const app = createApp();
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', dir: 'Calle 1', ciudad: 'CABA' };
let navyId = '';
beforeEach(async () => { await resetDb(); await seed(); vi.clearAllMocks(); navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id; });

describe('POST /api/payments/card', () => {
  it('approved → order paid + stock decremented', async () => {
    vi.mocked(mp.createCardPayment).mockResolvedValue({ id: 111, status: 'approved', statusDetail: 'accredited' });
    const res = await request(app).post('/api/payments/card').send({ items: [{ productId: navyId, size: 'M', qty: 2 }], customer, token: 'tok', installments: 3, paymentMethodId: 'visa', payer: { email: 'ana@x.com' } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    const v = await prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } });
    expect(v.stock).toBe(23);
  });

  it('rejected → order not paid, stock untouched', async () => {
    vi.mocked(mp.createCardPayment).mockResolvedValue({ id: 222, status: 'rejected', statusDetail: 'cc_rejected' });
    const res = await request(app).post('/api/payments/card').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, token: 'tok', installments: 1, paymentMethodId: 'visa', payer: { email: 'ana@x.com' } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    const v = await prisma.variant.findFirstOrThrow({ where: { productId: navyId, size: 'M' } });
    expect(v.stock).toBe(25);
  });
});

describe('POST /api/payments/preference', () => {
  it('creates a pending wallet order and returns the preference id', async () => {
    const res = await request(app).post('/api/payments/preference').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer });
    expect(res.status).toBe(200);
    expect(res.body.preferenceId).toBe('PREF-1');
    expect(res.body.orderNo).toMatch(/^RF-/);
    expect(await prisma.order.count({ where: { status: 'pending', paymentMethod: 'wallet' } })).toBe(1);
  });
});

describe('POST /api/payments/webhook', () => {
  it('marks the referenced order paid', async () => {
    const { body } = await request(app).post('/api/payments/preference').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer });
    vi.mocked(mp.getPayment).mockResolvedValue({ id: 999, status: 'approved', externalReference: body.orderNo });
    const res = await request(app).post('/api/payments/webhook?type=payment&data.id=999').send({});
    expect(res.status).toBe(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNo: body.orderNo } });
    expect(order.status).toBe('paid');
  });
});

describe('POST /api/orders/transfer', () => {
  it('creates a pending transfer order with the discounted total', async () => {
    const res = await request(app).post('/api/orders/transfer').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(27000);
    expect(res.body.orderNo).toMatch(/^RF-/);
  });
});
```

- [ ] **Step 2: Run (fail), then write `apps/api/src/routes/payments.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { cartLineSchema, customerSchema } from '@resolute/shared';
import { createOrder, markPaidByOrderNo } from '../services/orders';
import * as mp from '../lib/mp';
import { env } from '../env';
import { prisma } from '../prisma';

export const paymentsRouter = Router();
const base = z.object({ items: z.array(cartLineSchema).min(1), customer: customerSchema });

paymentsRouter.get('/public-key', (_req, res) => res.json({ publicKey: env.MP_PUBLIC_KEY }));

paymentsRouter.post('/card', async (req, res) => {
  const schema = base.extend({
    token: z.string().min(1), installments: z.number().int().min(1), paymentMethodId: z.string().min(1),
    issuerId: z.string().optional(),
    payer: z.object({ email: z.string().email(), identification: z.object({ type: z.string(), number: z.string() }).optional() }),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos de pago inválidos' });

  try {
    const { order } = await createOrder({ items: parsed.data.items, customer: parsed.data.customer, method: 'card' });
    const payment = await mp.createCardPayment({
      amount: order.total, token: parsed.data.token, installments: parsed.data.installments,
      paymentMethodId: parsed.data.paymentMethodId, issuerId: parsed.data.issuerId,
      payerEmail: parsed.data.payer.email, identification: parsed.data.payer.identification, orderNo: order.orderNo,
    });
    if (payment.status === 'approved') {
      await markPaidByOrderNo(order.orderNo, String(payment.id));
      return res.json({ status: 'approved', orderNo: order.orderNo, total: order.total, count: order.items.reduce((a, i) => a + i.qty, 0), name: order.customerName });
    }
    await prisma.order.update({ where: { id: order.id }, data: { mpPaymentId: String(payment.id), status: payment.status === 'in_process' ? 'pending' : 'cancelled' } });
    return res.json({ status: payment.status, orderNo: order.orderNo, detail: payment.statusDetail });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Error de pago' });
  }
});

paymentsRouter.post('/preference', async (req, res) => {
  const parsed = base.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
  try {
    const { order, quote } = await createOrder({ items: parsed.data.items, customer: parsed.data.customer, method: 'wallet' });
    const pref = await mp.createPreference({ orderNo: order.orderNo, customer: parsed.data.customer, lines: quote.lines });
    await prisma.order.update({ where: { id: order.id }, data: { mpPreferenceId: pref.id } });
    return res.json({ preferenceId: pref.id, initPoint: pref.initPoint, orderNo: order.orderNo });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Error creando preferencia' });
  }
});

paymentsRouter.post('/webhook', async (req, res) => {
  try {
    const type = (req.query.type ?? req.body?.type) as string | undefined;
    const id = (req.query['data.id'] ?? req.body?.data?.id) as string | undefined;
    if (type === 'payment' && id) {
      const payment = await mp.getPayment(String(id));
      if (payment.status === 'approved' && payment.externalReference) {
        await markPaidByOrderNo(payment.externalReference, String(payment.id));
      }
    }
  } catch (e) {
    console.error('[webhook]', e);
  }
  res.sendStatus(200); // always 200 so MP stops retrying
});
```

- [ ] **Step 3: Write `apps/api/src/routes/orders.ts`** (transfer path; emails added in M5)

```ts
import { Router } from 'express';
import { z } from 'zod';
import { cartLineSchema, customerSchema } from '@resolute/shared';
import { createOrder } from '../services/orders';
import { prisma } from '../prisma';

export const ordersRouter = Router();
const base = z.object({ items: z.array(cartLineSchema).min(1), customer: customerSchema });

ordersRouter.post('/transfer', async (req, res) => {
  const parsed = base.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
  try {
    const { order } = await createOrder({ items: parsed.data.items, customer: parsed.data.customer, method: 'transfer' });
    const content = await prisma.siteContent.findUnique({ where: { id: 1 } });
    return res.json({
      orderNo: order.orderNo, total: order.total, count: order.items.reduce((a, i) => a + i.qty, 0),
      name: order.customerName, bankAlias: content?.bankAlias ?? '', bankCbu: content?.bankCbu ?? '',
    });
  } catch (e) {
    return res.status(409).json({ error: e instanceof Error ? e.message : 'No se pudo crear el pedido' });
  }
});
```

- [ ] **Step 4: Mount both routers in `apps/api/src/app.ts`** (before `notFound`)

```ts
import { paymentsRouter } from './routes/payments';
import { ordersRouter } from './routes/orders';
// …inside createApp():
app.use('/api/payments', paymentsRouter);
app.use('/api/orders', ordersRouter);
```

- [ ] **Step 5: Run → PASS, then commit**

```bash
npm test --workspace @resolute/api -- payments
git add -A && git commit -m "feat(api): MercadoPago card+wallet+webhook routes and transfer orders"
```

---

### Task 3: Frontend — MP init, API client, Card Brick, Wallet, return pages

**Files:**
- Modify: `apps/web/package.json`, `apps/web/src/main.tsx`, `apps/web/src/lib/api.ts`, `apps/web/src/App.tsx`
- Create: `apps/web/src/components/payment/CardBrick.tsx`, `apps/web/src/components/payment/WalletButton.tsx`, `apps/web/src/pages/CheckoutSuccess.tsx`, `apps/web/src/pages/CheckoutFailure.tsx`
- Test: `apps/web/src/pages/CheckoutSuccess.test.tsx`

**Interfaces:**
- Produces: `api.paymentCard/preference/transferOrder`, `<CardBrick amount onPay/>`, `<WalletButton preferenceId/>`, routes `/checkout/success|failure|pending`.

- [ ] **Step 1: Install the MP React SDK**

```bash
npm install --workspace @resolute/web @mercadopago/sdk-react@^0.0.22
```

- [ ] **Step 2: Initialize MP in `apps/web/src/main.tsx`** (add before `createRoot`)

```tsx
import { initMercadoPago } from '@mercadopago/sdk-react';
initMercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY ?? 'TEST-PUBLIC-KEY', { locale: 'es-AR' });
```

- [ ] **Step 3: Extend `apps/web/src/lib/api.ts`** (append to the `api` object)

```ts
// types
import type { CartLineInput, CustomerInput } from '@resolute/shared';
export interface CardResult { status: string; orderNo: string; total?: number; count?: number; name?: string; detail?: string; }
export interface PrefResult { preferenceId: string; initPoint: string; orderNo: string; }
export interface TransferResult { orderNo: string; total: number; count: number; name: string; bankAlias: string; bankCbu: string; }

// inside `export const api = { … }` add:
  paymentCard: (body: { items: CartLineInput[]; customer: CustomerInput; token: string; installments: number; paymentMethodId: string; issuerId?: string; payer: { email: string; identification?: { type: string; number: string } } }) => post<CardResult>('/api/payments/card', body),
  preference: (body: { items: CartLineInput[]; customer: CustomerInput }) => post<PrefResult>('/api/payments/preference', body),
  transferOrder: (body: { items: CartLineInput[]; customer: CustomerInput }) => post<TransferResult>('/api/orders/transfer', body),
```

- [ ] **Step 4: Write `apps/web/src/components/payment/CardBrick.tsx`**

```tsx
import { CardPayment } from '@mercadopago/sdk-react';

export interface CardFormData {
  token: string; installments: number; payment_method_id: string; issuer_id?: string;
  payer: { email: string; identification?: { type: string; number: string } };
}

export default function CardBrick({ amount, onPay }: { amount: number; onPay: (data: CardFormData) => Promise<void> }) {
  return (
    <div data-testid="card-brick">
      <CardPayment
        initialization={{ amount }}
        customization={{ visual: { style: { theme: 'dark' } } }}
        onSubmit={async (formData) => { await onPay(formData as unknown as CardFormData); }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Write `apps/web/src/components/payment/WalletButton.tsx`**

```tsx
import { Wallet } from '@mercadopago/sdk-react';

export default function WalletButton({ preferenceId }: { preferenceId: string }) {
  return <div data-testid="wallet-button"><Wallet initialization={{ preferenceId }} /></div>;
}
```

- [ ] **Step 6: Write the failing test `apps/web/src/pages/CheckoutSuccess.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckoutSuccess from './CheckoutSuccess';

it('confirms the order from MP return params', () => {
  render(
    <MemoryRouter initialEntries={['/checkout/success?external_reference=RF-123456&status=approved']}>
      <CheckoutSuccess />
    </MemoryRouter>,
  );
  expect(screen.getByText(/pedido confirmado/i)).toBeInTheDocument();
  expect(screen.getByText(/RF-123456/)).toBeInTheDocument();
});
```

- [ ] **Step 7: Run (fail), then write `apps/web/src/pages/CheckoutSuccess.tsx`**

```tsx
import { Link, useSearchParams } from 'react-router-dom';

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const orderNo = params.get('external_reference') ?? '';
  return (
    <main className="min-h-screen bg-bg text-tx font-body flex items-center justify-center px-4">
      <div className="max-w-[440px] text-center flex flex-col items-center gap-4">
        <div className="w-[74px] h-[74px] rounded-full flex items-center justify-center border-2 border-gold" style={{ background: 'radial-gradient(circle,rgba(232,181,62,.25),transparent 70%)' }}>
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#e8b53e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-11" /></svg>
        </div>
        <h1 className="m-0 font-display font-black text-[34px] uppercase">¡Pedido confirmado!</h1>
        <p className="text-mut leading-[1.6]">Tu orden <span className="text-gold font-semibold">{orderNo}</span> está en marcha. Te enviamos los detalles por email.</p>
        <p className="font-display font-bold text-[18px] tracking-[0.08em] uppercase text-red">Stop at nothing 🔥</p>
        <Link to="/" className="bg-tx text-bg no-underline font-display font-bold text-[15px] tracking-[0.12em] uppercase px-[26px] py-[13px] rounded-[2px] hover:bg-gold">Volver al inicio</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Write `apps/web/src/pages/CheckoutFailure.tsx`**

```tsx
import { Link } from 'react-router-dom';

export default function CheckoutFailure() {
  return (
    <main className="min-h-screen bg-bg text-tx font-body flex items-center justify-center px-4">
      <div className="max-w-[440px] text-center flex flex-col items-center gap-4">
        <h1 className="m-0 font-display font-black text-[34px] uppercase text-red">Pago no completado</h1>
        <p className="text-mut leading-[1.6]">No pudimos procesar el pago. No se realizó ningún cargo. Probá de nuevo o escribinos por WhatsApp.</p>
        <Link to="/" className="bg-red text-white no-underline font-display font-bold text-[15px] tracking-[0.12em] uppercase px-[26px] py-[13px] rounded-[2px] hover:bg-redd">Volver a la tienda</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 9: Add routes in `apps/web/src/App.tsx`**

```tsx
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutFailure from './pages/CheckoutFailure';
// inside <Routes>:
<Route path="/checkout/success" element={<CheckoutSuccess />} />
<Route path="/checkout/pending" element={<CheckoutSuccess />} />
<Route path="/checkout/failure" element={<CheckoutFailure />} />
```

- [ ] **Step 10: Run → PASS, then commit**

```bash
npm test --workspace @resolute/web -- CheckoutSuccess
git add -A && git commit -m "feat(web): MP init, payment API client, Card Brick, Wallet, return pages"
```

---

### Task 4: Wire real payments into the CheckoutModal

**Files:**
- Modify: `apps/web/src/components/CheckoutModal.tsx`
- Test: `apps/web/src/components/CheckoutModal.payments.test.tsx`

**Interfaces:**
- Consumes: `api.{transferOrder,preference,paymentCard}`, `CardBrick`, `WalletButton`.
- Produces: the production checkout — transfer creates a pending order (+bank details), card pays via Brick, wallet redirects via Wallet button.

- [ ] **Step 1: Write the failing test `apps/web/src/components/CheckoutModal.payments.test.tsx`**

```tsx
import { beforeEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CheckoutModal from './CheckoutModal';
import { useCart } from '../store/cart';

vi.mock('../lib/api', () => ({
  api: {
    quote: vi.fn().mockResolvedValue({ lines: [{ productId: 'p1', line: 'Champion Mentality', color: 'Negro', size: 'M', unitPrice: 30000, qty: 1, lineTotal: 30000 }], subtotal: 30000, transferDiscount: 3000, totalTransfer: 27000, totalCard: 30000 }),
    transferOrder: vi.fn().mockResolvedValue({ orderNo: 'RF-555000', total: 27000, count: 1, name: 'Ana', bankAlias: 'resolute.mp', bankCbu: '000' }),
    preference: vi.fn().mockResolvedValue({ preferenceId: 'PREF-1', initPoint: 'https://mp/redirect', orderNo: 'RF-1' }),
    paymentCard: vi.fn().mockResolvedValue({ status: 'approved', orderNo: 'RF-777000', total: 30000, count: 1, name: 'Ana' }),
  },
}));
vi.mock('./payment/CardBrick', () => ({ default: ({ onPay }: { onPay: (d: unknown) => Promise<void> }) => <button onClick={() => onPay({ token: 'tok', installments: 1, payment_method_id: 'visa', payer: { email: 'ana@x.com' } })}>pay-card</button> }));
vi.mock('./payment/WalletButton', () => ({ default: () => <div data-testid="wallet-button" /> }));

const product = { id: 'p1', slug: 's', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, price: 30000, imageUrl: '/assets/tile-black.png', sizes: [] } as any;
beforeEach(() => { useCart.setState({ items: [], open: false, checkoutOpen: true }); useCart.getState().add(product, 'M'); });

async function fillDatosAndContinue() {
  fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('tu@email.com'), { target: { value: 'ana@x.com' } });
  fireEvent.change(screen.getByPlaceholderText('Calle y número'), { target: { value: 'Calle 1' } });
  fireEvent.change(screen.getByPlaceholderText('Ciudad, Provincia'), { target: { value: 'CABA' } });
  fireEvent.click(screen.getByRole('button', { name: /continuar al pago/i }));
  await screen.findByText('Forma de pago');
}

it('transfer → creates a pending order and shows bank details', async () => {
  render(<CheckoutModal />);
  await fillDatosAndContinue();
  fireEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }));
  expect(await screen.findByText(/pedido confirmado/i)).toBeInTheDocument();
  expect(screen.getByText(/RF-555000/)).toBeInTheDocument();
});

it('card → Brick pay approved shows confirmation', async () => {
  render(<CheckoutModal />);
  await fillDatosAndContinue();
  fireEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));
  fireEvent.click(await screen.findByRole('button', { name: 'pay-card' }));
  expect(await screen.findByText(/pedido confirmado/i)).toBeInTheDocument();
  expect(screen.getByText(/RF-777000/)).toBeInTheDocument();
});

it('wallet → renders the Wallet button after creating a preference', async () => {
  render(<CheckoutModal />);
  await fillDatosAndContinue();
  fireEvent.click(screen.getByRole('button', { name: 'Mercado Pago' }));
  fireEvent.click(screen.getByRole('button', { name: /pagar con mercadopago/i }));
  await waitFor(() => expect(screen.getByTestId('wallet-button')).toBeInTheDocument());
});
```

- [ ] **Step 2: Run (fail), then replace `apps/web/src/components/CheckoutModal.tsx`** with the real-payment version

```tsx
import { useState } from 'react';
import { customerSchema } from '@resolute/shared';
import type { CartLineInput, CustomerInput, QuoteResult } from '@resolute/shared';
import { api } from '../lib/api';
import { money } from '../lib/money';
import { useCart, cartCount } from '../store/cart';
import CardBrick, { type CardFormData } from './payment/CardBrick';
import WalletButton from './payment/WalletButton';

type PayMethod = 'transfer' | 'card' | 'wallet';
interface Confirmation { orderNo: string; total: number; count: number; pay: PayMethod; name: string; bankAlias?: string; bankCbu?: string; }

const inputCls = 'bg-card border border-line2 rounded-[3px] text-tx px-[14px] py-[13px] text-[15px] outline-none transition focus:border-gold';
const labelCls = 'font-display text-[12.5px] tracking-[0.14em] uppercase text-mut';

export default function CheckoutModal() {
  const { items, setCheckoutOpen, clear } = useCart();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CustomerInput>({ nombre: '', email: '', tel: '', dir: '', ciudad: '' });
  const [method, setMethod] = useState<PayMethod>('transfer');
  const [q, setQ] = useState<QuoteResult | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lineItems: CartLineInput[] = items.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty }));
  const close = () => { setCheckoutOpen(false); setStep(0); };
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const total = method === 'transfer' ? q?.totalTransfer ?? 0 : q?.totalCard ?? 0;

  async function toPago() {
    setErr(null);
    if (!customerSchema.safeParse(form).success) { setErr('Completá tus datos para continuar'); return; }
    setBusy(true);
    try { setQ(await api.quote(lineItems)); setStep(1); }
    catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo cotizar'); }
    finally { setBusy(false); }
  }

  async function confirmTransfer() {
    setBusy(true); setErr(null);
    try {
      const r = await api.transferOrder({ items: lineItems, customer: form });
      setConfirmation({ orderNo: r.orderNo, total: r.total, count: r.count, pay: 'transfer', name: r.name, bankAlias: r.bankAlias, bankCbu: r.bankCbu });
      setStep(2); clear();
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo crear el pedido'); }
    finally { setBusy(false); }
  }

  async function startWallet() {
    setBusy(true); setErr(null);
    try { const r = await api.preference({ items: lineItems, customer: form }); setPreferenceId(r.preferenceId); }
    catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo iniciar el pago'); }
    finally { setBusy(false); }
  }

  async function payCard(data: CardFormData) {
    setErr(null);
    const r = await api.paymentCard({
      items: lineItems, customer: form, token: data.token, installments: data.installments,
      paymentMethodId: data.payment_method_id, issuerId: data.issuer_id, payer: data.payer,
    });
    if (r.status === 'approved') {
      setConfirmation({ orderNo: r.orderNo, total: r.total ?? total, count: r.count ?? cartCount(items), pay: 'card', name: r.name ?? form.nombre });
      setStep(2); clear();
    } else {
      setErr(`Pago ${r.status === 'rejected' ? 'rechazado' : 'pendiente'}. Probá otra tarjeta o medio de pago.`);
    }
  }

  const stepTitle = step === 0 ? 'Tus datos' : step === 1 ? 'Forma de pago' : 'Listo';
  const progress = step === 0 ? '33%' : step === 1 ? '66%' : '100%';

  return (
    <div onClick={close} className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-[4px] flex items-start justify-center px-4 py-[clamp(16px,5vh,60px)] overflow-y-auto animate-fade">
      <div onClick={stop} className="w-[min(540px,100%)] bg-bg border border-line2 rounded-[6px] overflow-hidden animate-rise shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]">
        <div className="px-6 py-5 border-b border-line flex items-center justify-between gap-[14px]">
          <div className="flex items-center gap-[11px]"><img src="/assets/logo-r.png" alt="" width={26} height={26} className="w-[26px] h-[26px] object-contain" /><span className="font-display font-extrabold text-[18px] tracking-[0.1em] uppercase">{stepTitle}</span></div>
          <button aria-label="Cerrar" onClick={close} className="bg-none border border-line rounded-[2px] text-tx w-[34px] h-[34px] flex items-center justify-center cursor-pointer hover:border-red"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </div>
        <div className="h-[3px] bg-line"><div className="h-full bg-red transition-[width] duration-300" style={{ width: progress }} /></div>

        <div className="p-6">
          {err && <div className="mb-3 text-red text-[14px] font-display tracking-[0.06em] uppercase">{err}</div>}

          {step === 0 && (
            <div className="flex flex-col gap-[14px]">
              <Field label="Nombre y apellido"><input className={inputCls} placeholder="Tu nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
              <div className="flex gap-3 flex-wrap">
                <Field className="flex-1 basis-[180px]" label="Email"><input className={inputCls} placeholder="tu@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field className="flex-1 basis-[140px]" label="Teléfono"><input className={inputCls} placeholder="11 1234-5678" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} /></Field>
              </div>
              <Field label="Dirección de envío"><input className={inputCls} placeholder="Calle y número" value={form.dir} onChange={(e) => setForm({ ...form, dir: e.target.value })} /></Field>
              <Field label="Ciudad / Provincia"><input className={inputCls} placeholder="Ciudad, Provincia" value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} /></Field>
              <button disabled={busy} onClick={toPago} className="w-full mt-1 bg-red text-white border-0 rounded-[2px] p-4 cursor-pointer font-display font-bold text-[16px] tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Continuar al pago</button>
            </div>
          )}

          {step === 1 && q && (
            <div className="flex flex-col gap-[14px]">
              <div className="font-display text-[12.5px] tracking-[0.14em] uppercase text-mut">Elegí cómo pagar</div>
              <PayOption active={method === 'transfer'} onClick={() => { setMethod('transfer'); setPreferenceId(null); }} title="Transferencia" sub="Te enviamos los datos por email" badge="10% OFF" />
              <PayOption active={method === 'card'} onClick={() => { setMethod('card'); setPreferenceId(null); }} title="Tarjeta" sub="Hasta 3 cuotas sin interés" />
              <PayOption active={method === 'wallet'} onClick={() => { setMethod('wallet'); setPreferenceId(null); }} title="Mercado Pago" sub="Pagá con tu cuenta de MercadoPago" />

              <div className="flex flex-col gap-2 mt-[6px] pt-[14px] border-t border-line">
                <Row label="Subtotal" value={money(q.subtotal)} />
                {method === 'transfer' && <Row label="Descuento transferencia" value={`− ${money(q.transferDiscount)}`} gold />}
                <Row label="Envío" value="Gratis" gold />
                <div className="flex justify-between items-baseline mt-1"><span className="font-display tracking-[0.1em] uppercase text-[15px]">Total</span><span className="font-display font-black text-[28px]">{money(total)}</span></div>
              </div>

              {method === 'card' && <div className="mt-1"><CardBrick amount={total} onPay={payCard} /></div>}

              {method === 'wallet' && (preferenceId
                ? <WalletButton preferenceId={preferenceId} />
                : <button disabled={busy} onClick={startWallet} className="w-full bg-red text-white border-0 rounded-[2px] p-4 cursor-pointer font-display font-bold text-[16px] tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Pagar con MercadoPago</button>)}

              {method === 'transfer' && (
                <div className="flex gap-[10px] mt-1">
                  <button onClick={() => setStep(0)} className="shrink-0 bg-transparent text-tx border border-line2 rounded-[2px] px-5 py-4 cursor-pointer font-display font-bold text-[15px] tracking-[0.1em] uppercase hover:border-tx">Volver</button>
                  <button disabled={busy} onClick={confirmTransfer} className="flex-1 bg-red text-white border-0 rounded-[2px] p-4 cursor-pointer font-display font-bold text-[16px] tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Confirmar pedido</button>
                </div>
              )}
            </div>
          )}

          {step === 2 && confirmation && (
            <div className="flex flex-col items-center text-center gap-4 pt-[14px] px-[6px] pb-[6px]">
              <div className="w-[74px] h-[74px] rounded-full flex items-center justify-center border-2 border-gold" style={{ background: 'radial-gradient(circle,rgba(232,181,62,.25),transparent 70%)' }}>
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#e8b53e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-11" /></svg>
              </div>
              <h3 className="m-0 font-display font-black text-[32px] tracking-[0.02em] uppercase">¡Pedido confirmado!</h3>
              <p className="m-0 text-mut text-[15.5px] leading-[1.6] max-w-[380px]">Gracias <span className="text-tx font-semibold">{confirmation.name}</span>. Tu orden <span className="text-gold font-semibold">{confirmation.orderNo}</span> está en marcha. Te enviamos los detalles por email.</p>
              {confirmation.pay === 'transfer' && confirmation.bankAlias && (
                <div className="w-full bg-card border border-gold/40 rounded-[4px] px-[18px] py-4 text-left">
                  <div className="font-display text-[12px] tracking-[0.14em] uppercase text-gold mb-2">Datos para transferir</div>
                  <Row label="Alias" value={confirmation.bankAlias} />
                  {confirmation.bankCbu && <Row label="CBU" value={confirmation.bankCbu} />}
                  <Row label="Importe" value={money(confirmation.total)} />
                </div>
              )}
              <div className="w-full bg-card border border-line rounded-[4px] px-[18px] py-4 flex flex-col gap-[9px] mt-1">
                <Row label="Orden" value={confirmation.orderNo} />
                <Row label="Artículos" value={String(confirmation.count)} />
                <Row label="Pago" value={confirmation.pay} />
                <div className="flex justify-between items-baseline pt-[9px] border-t border-line"><span className="text-mut">Total</span><span className="font-display font-black text-[24px]">{money(confirmation.total)}</span></div>
              </div>
              <p className="m-0 font-display font-bold text-[18px] tracking-[0.08em] uppercase text-red">Stop at nothing 🔥</p>
              <button onClick={close} className="w-full bg-tx text-bg border-0 rounded-[2px] p-[15px] cursor-pointer font-display font-bold text-[16px] tracking-[0.13em] uppercase hover:bg-gold mt-1">Seguí entrenando</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-[6px] ${className}`}><label className={labelCls}>{label}</label>{children}</div>;
}
function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return <div className={`flex justify-between text-[14px] ${gold ? 'text-gold' : 'text-mut'}`}><span>{label}</span><span className="capitalize">{value}</span></div>;
}
function PayOption({ active, onClick, title, sub, badge }: { active: boolean; onClick: () => void; title: string; sub: string; badge?: string }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between gap-3 rounded-[4px] p-4 cursor-pointer transition bg-card ${active ? 'border border-gold' : 'border border-line'}`}>
      <div className="flex items-center gap-3">
        <span className={`w-5 h-5 rounded-full shrink-0 inline-block transition ${active ? 'border-[6px] border-gold bg-bg' : 'border-2 border-line2'}`} />
        <div className="text-left"><div className="font-display font-bold text-[17px] tracking-[0.05em] uppercase">{title}</div><div className="text-mut text-[13px]">{sub}</div></div>
      </div>
      {badge && <span className="bg-gold text-bg font-display font-bold text-[12px] tracking-[0.1em] uppercase px-[10px] py-[5px] rounded-[2px]">{badge}</span>}
    </button>
  );
}
```

- [ ] **Step 3: Delete the now-unused stub** `apps/web/src/lib/placeOrder.ts` and its import in the old test if present. Update the M3 `CheckoutModal.test.tsx` if it referenced `placeOrder` prop (the new modal manages payments internally; that older happy-path test is superseded by `CheckoutModal.payments.test.tsx` — remove `CheckoutModal.test.tsx`).

```bash
git rm apps/web/src/lib/placeOrder.ts apps/web/src/components/CheckoutModal.test.tsx
```

- [ ] **Step 4: Run the full web suite + build**

Run: `npm test --workspace @resolute/web` then `npm run build --workspace @resolute/web`
Expected: green; build emits `dist/`.

- [ ] **Step 5: Manual end-to-end with MercadoPago test credentials**

Set real **test** `MP_ACCESS_TOKEN` (api) and `VITE_MP_PUBLIC_KEY` (web) from the MP test application. Use [MP test cards](https://www.mercadopago.com.ar/developers/es/docs/checkout-api/additional-content/your-integrations/test/cards). Verify: card APRO → confirmation + stock drops; card OTHE → rejected message; wallet → redirect to MP sandbox → return to `/checkout/success`. Expose the webhook with a tunnel (e.g. `ngrok http 4000`) and set `PUBLIC_API_URL` so MP can reach `/api/payments/webhook`.

- [ ] **Step 6: Commit + tag**

```bash
git add -A && git commit -m "feat(web): production checkout — transfer, card Brick, wallet (M4)"
git tag m4-mercadopago
```

---

## M4 done when

- An approved card payment marks its order `paid` and decrements stock; wallet round-trips through MP; transfer creates a pending order with bank details; the webhook finalizes wallet/async payments idempotently.
- `git tag m4-mercadopago` exists. Proceed to `…-m5-emails.md`.
