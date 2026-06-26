# M5 — Order Email Notifications (admin + customer)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`. Read the master file first. Requires M4 (`git tag m4-mercadopago`).

**Goal:** On every order (card/wallet `paid` via `markPaid`, and `transfer` on creation), email the **admin** a full breakdown — each product with **size + color + qty**, customer name/email/phone/address, total, method, order number — and email the **customer** a confirmation (with bank details for transfers). Emails are fire-and-forget and never break the payment flow.

**Architecture:** `src/lib/mailer.ts` wraps Nodemailer (SMTP); it no-ops when SMTP is unconfigured so dev/CI never fail. `src/services/notify.ts` builds the HTML and sends. `markPaidByOrderNo` fires the paid-notification exactly once (on the real transition); the transfer route fires its own. Failures are swallowed (logged), so a mail outage can't roll back a payment.

**Tech Stack:** Nodemailer.

**Deliverable:** A paid order (or new transfer order) triggers two emails; the admin one lists size+color per item. All api tests green (mailer mocked / no-op).

---

### Task 1: Mailer wrapper + env

**Files:**
- Modify: `apps/api/src/env.ts`, `apps/api/package.json`, `apps/api/vitest.config.ts`
- Create: `apps/api/src/lib/mailer.ts`
- Test: `apps/api/tests/mailer.test.ts`

**Interfaces:**
- Produces: `sendMail({to,subject,html})` — sends via SMTP when configured, otherwise no-ops (resolves).

- [ ] **Step 1: Install Nodemailer**

```bash
npm install --workspace @resolute/api nodemailer@^6.9.16
npm install --workspace @resolute/api -D @types/nodemailer@^6.4.16
```

- [ ] **Step 2: Extend `apps/api/src/env.ts`** (add SMTP block to the schema)

```ts
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('Resolute Force <no-reply@resoluteforce.com>'),
  ADMIN_NOTIFY_EMAIL: z.string().default(''),
```

- [ ] **Step 3: Add test env in `apps/api/vitest.config.ts`** (so notify tests have an admin recipient; SMTP stays empty → real mailer no-ops)

```ts
    env: { DATABASE_URL: 'file:./test.db', NODE_ENV: 'test', ADMIN_NOTIFY_EMAIL: 'admin@test.com' },
```

- [ ] **Step 4: Write the failing test `apps/api/tests/mailer.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { sendMail } from '../src/lib/mailer';

describe('sendMail', () => {
  it('no-ops (resolves) when SMTP is not configured', async () => {
    await expect(sendMail({ to: 'x@y.com', subject: 'hi', html: '<p>hi</p>' })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 5: Run (fail), then write `apps/api/src/lib/mailer.ts`**

```ts
import nodemailer from 'nodemailer';
import { env } from '../env';

const enabled = Boolean(env.SMTP_HOST && env.SMTP_USER);
const transporter = enabled
  ? nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } })
  : null;

export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<void> {
  if (!transporter || !opts.to) {
    if (env.NODE_ENV !== 'test') console.log('[mail:skipped]', opts.subject, '->', opts.to || '(no recipient)');
    return;
  }
  await transporter.sendMail({ from: env.MAIL_FROM, to: opts.to, subject: opts.subject, html: opts.html });
}
```

- [ ] **Step 6: Run → PASS, then commit**

```bash
npm test --workspace @resolute/api -- mailer
git add -A && git commit -m "feat(api): nodemailer mailer wrapper (no-op when unconfigured)"
```

---

### Task 2: Notification service

**Files:**
- Create: `apps/api/src/services/notify.ts`
- Test: `apps/api/tests/notify.test.ts`

**Interfaces:**
- Consumes: `prisma`, `sendMail`, `env.ADMIN_NOTIFY_EMAIL`.
- Produces: `notifyOrderPaid(orderNo)`, `notifyTransferOrder(orderNo, {bankAlias,bankCbu})`.

- [ ] **Step 1: Write the failing test `apps/api/tests/notify.test.ts`** (mailer mocked to capture)

```ts
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/mailer', () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));

import { sendMail } from '../src/lib/mailer';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';
import { prisma } from '../src/prisma';
import { createOrder } from '../src/services/orders';
import { notifyOrderPaid } from '../src/services/notify';

const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', dir: 'Calle 1', ciudad: 'CABA' };
beforeEach(async () => { await resetDb(); await seed(); vi.clearAllMocks(); });

describe('notifyOrderPaid', () => {
  it('emails the admin and the customer with item size + color', async () => {
    const navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'L', qty: 2 }], customer, method: 'card' });
    await notifyOrderPaid(order.orderNo);

    const calls = vi.mocked(sendMail).mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);
    const admin = calls.find((c) => c.to === 'admin@test.com')!;
    const cust = calls.find((c) => c.to === 'ana@x.com')!;
    expect(admin.subject).toContain(order.orderNo);
    expect(admin.html).toContain('Azul Marino'); // color
    expect(admin.html).toContain('>L<'); // size cell
    expect(admin.html).toContain('Ana');  // customer name
    expect(cust.subject).toContain(order.orderNo);
  });
});
```

- [ ] **Step 2: Run (fail), then write `apps/api/src/services/notify.ts`**

```ts
import type { Order, OrderItem } from '@prisma/client';
import { prisma } from '../prisma';
import { sendMail } from '../lib/mailer';
import { env } from '../env';

type OrderWithItems = Order & { items: OrderItem[] };
const fmt = (n: number) => '$' + n.toLocaleString('es-AR');

function itemsTable(o: OrderWithItems): string {
  const rows = o.items
    .map((i) => `<tr><td>${i.line}</td><td>${i.color}</td><td>${i.size}</td><td>${i.qty}</td><td>${fmt(i.unitPrice * i.qty)}</td></tr>`)
    .join('');
  return `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse"><thead><tr><th>Producto</th><th>Color</th><th>Talle</th><th>Cant.</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function notifyAdmin(o: OrderWithItems): Promise<void> {
  if (!env.ADMIN_NOTIFY_EMAIL) return;
  const html = `
    <h2>🔥 Nuevo pedido ${o.orderNo} <small>(${o.status})</small></h2>
    <p><b>Cliente:</b> ${o.customerName} · ${o.customerEmail} · ${o.customerPhone ?? '—'}</p>
    <p><b>Envío:</b> ${o.address}, ${o.city}</p>
    <p><b>Pago:</b> ${o.paymentMethod} · <b>Total:</b> ${fmt(o.total)}</p>
    ${itemsTable(o)}`;
  await sendMail({ to: env.ADMIN_NOTIFY_EMAIL, subject: `Pedido ${o.orderNo} — ${o.customerName} (${fmt(o.total)})`, html });
}

async function notifyCustomer(o: OrderWithItems, bank?: { bankAlias: string; bankCbu: string }): Promise<void> {
  const bankBlock = bank?.bankAlias
    ? `<p>Para confirmar, transferí <b>${fmt(o.total)}</b> a — alias <b>${bank.bankAlias}</b>${bank.bankCbu ? ` · CBU <b>${bank.bankCbu}</b>` : ''} — y respondé este email con el comprobante.</p>`
    : '';
  const html = `
    <h2>¡Gracias por tu pedido, ${o.customerName}!</h2>
    <p>Orden <b>${o.orderNo}</b> · Total <b>${fmt(o.total)}</b> · Pago: ${o.paymentMethod}</p>
    ${bankBlock}
    ${itemsTable(o)}
    <p style="font-weight:700;text-transform:uppercase">Champion Mentality. Stop at nothing 🔥</p>`;
  await sendMail({ to: o.customerEmail, subject: `Resolute Force — Pedido ${o.orderNo}`, html });
}

async function load(orderNo: string): Promise<OrderWithItems | null> {
  return prisma.order.findUnique({ where: { orderNo }, include: { items: true } });
}

export async function notifyOrderPaid(orderNo: string): Promise<void> {
  const o = await load(orderNo);
  if (!o) return;
  await Promise.allSettled([notifyAdmin(o), notifyCustomer(o)]);
}

export async function notifyTransferOrder(orderNo: string, bank: { bankAlias: string; bankCbu: string }): Promise<void> {
  const o = await load(orderNo);
  if (!o) return;
  await Promise.allSettled([notifyAdmin(o), notifyCustomer(o, bank)]);
}
```

- [ ] **Step 3: Run → PASS, then commit**

```bash
npm test --workspace @resolute/api -- notify
git add -A && git commit -m "feat(api): order notification service (admin breakdown + customer confirmation)"
```

---

### Task 3: Wire notifications into the order lifecycle

**Files:**
- Modify: `apps/api/src/services/orders.ts` (fire paid-notify on the real transition), `apps/api/src/routes/orders.ts` (fire transfer-notify)
- Test: `apps/api/tests/notify-wiring.test.ts`

**Interfaces:**
- Consumes: `notifyOrderPaid`, `notifyTransferOrder`.
- Produces: side-effect emails on `markPaidByOrderNo` transition and on transfer order creation. Fire-and-forget — payment flow never depends on email success.

- [ ] **Step 1: Update `markPaidByOrderNo` in `apps/api/src/services/orders.ts`** to detect the transition and notify

Replace the function body's transaction + return with:

```ts
export async function markPaidByOrderNo(orderNo: string, mpPaymentId: string) {
  const { order, transitioned } = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({ where: { orderNo }, include: { items: true } });
    if (!existing) throw new Error(`Orden inexistente: ${orderNo}`);
    if (existing.status === 'paid' || existing.status === 'shipped') return { order: existing, transitioned: false };

    for (const it of existing.items) {
      if (!it.productId) continue;
      const r = await tx.variant.updateMany({ where: { productId: it.productId, size: it.size, stock: { gte: it.qty } }, data: { stock: { decrement: it.qty } } });
      if (r.count !== 1) throw new Error(`Sin stock al confirmar ${it.line} talle ${it.size}`);
    }
    const updated = await tx.order.update({ where: { id: existing.id }, data: { status: 'paid', mpPaymentId } });
    return { order: updated, transitioned: true };
  });

  if (transitioned) {
    const { notifyOrderPaid } = await import('./notify');
    void notifyOrderPaid(orderNo).catch((e) => console.error('[notify:paid]', e));
  }
  return order;
}
```

> The dynamic `import('./notify')` avoids a static import cycle and keeps notify strictly a side-effect. `markPaidByOrderNo` still returns the order, so M4's tests are unaffected.

- [ ] **Step 2: Update the transfer route in `apps/api/src/routes/orders.ts`** to notify after creating the order

After building the `res.json({...})` response object, before returning, add:

```ts
    const { notifyTransferOrder } = await import('../services/notify');
    void notifyTransferOrder(order.orderNo, { bankAlias: content?.bankAlias ?? '', bankCbu: content?.bankCbu ?? '' }).catch((e) => console.error('[notify:transfer]', e));
    return res.json({ orderNo: order.orderNo, total: order.total, count: order.items.reduce((a, i) => a + i.qty, 0), name: order.customerName, bankAlias: content?.bankAlias ?? '', bankCbu: content?.bankCbu ?? '' });
```

- [ ] **Step 3: Write the failing test `apps/api/tests/notify-wiring.test.ts`**

```ts
import { beforeEach, describe, it, expect, vi } from 'vitest';

const notifyOrderPaid = vi.fn().mockResolvedValue(undefined);
const notifyTransferOrder = vi.fn().mockResolvedValue(undefined);
vi.mock('../src/services/notify', () => ({ notifyOrderPaid, notifyTransferOrder }));

import request from 'supertest';
import { createApp } from '../src/app';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';
import { prisma } from '../src/prisma';
import { createOrder, markPaidByOrderNo } from '../src/services/orders';

const app = createApp();
const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', dir: 'Calle 1', ciudad: 'CABA' };
let navyId = '';
beforeEach(async () => { await resetDb(); await seed(); vi.clearAllMocks(); navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id; });

it('markPaid notifies once on transition, not on the idempotent repeat', async () => {
  const { order } = await createOrder({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer, method: 'card' });
  await markPaidByOrderNo(order.orderNo, 'PAY-1');
  await markPaidByOrderNo(order.orderNo, 'PAY-1');
  await new Promise((r) => setTimeout(r, 0)); // let the fire-and-forget settle
  expect(notifyOrderPaid).toHaveBeenCalledTimes(1);
});

it('transfer order creation notifies', async () => {
  await request(app).post('/api/orders/transfer').send({ items: [{ productId: navyId, size: 'M', qty: 1 }], customer });
  await new Promise((r) => setTimeout(r, 0));
  expect(notifyTransferOrder).toHaveBeenCalledOnce();
});
```

- [ ] **Step 4: Run → PASS, then run the full api suite**

Run: `npm test --workspace @resolute/api`
Expected: all green (orders, payments, notify, notify-wiring, quote, products, config, pricing, seed, prisma, mailer, health). The `markPaidByOrderNo` return shape is unchanged, so M4 tests still pass.

- [ ] **Step 5: Manual SMTP check (optional)**

Set Gmail SMTP env (`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS`=app password, `ADMIN_NOTIFY_EMAIL`). Place a transfer order via the UI and confirm both inboxes receive the breakdown.

- [ ] **Step 6: Commit + tag**

```bash
git add -A && git commit -m "feat(api): wire admin+customer emails into paid/transfer order flow (M5)"
git tag m5-emails
```

---

## M5 done when

- A paid card/wallet order and a new transfer order each send the admin a size+color+qty breakdown with customer details, plus a customer confirmation; emails never block payments and the paid-notify fires exactly once.
- `git tag m5-emails` exists. Proceed to `…-m6-admin.md` (the final milestone: auth, product CRUD + Cloudinary, drop/content config, orders management, metrics dashboard).
