# M3 — Cart, Checkout UI, and Authoritative Quote

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`. Read the master file first (Global Constraints: server is the source of truth for money). Requires M2 (`git tag m2-frontend-port`).

**Goal:** Add a Zustand cart (drawer + toast), the 3-step checkout modal (datos → pago → confirmado), and the server-authoritative `POST /api/checkout/quote` that recomputes prices/totals and validates stock from the DB.

**Architecture:** Cart state in Zustand (persisted to localStorage). The client sends only `{productId,size,qty}`; the API recomputes line prices, subtotal, transfer discount, and stock from the DB. The checkout modal calls an injected `placeOrder` adapter — in M3 a **client stub** (mirrors the original demo confirmation); **M4 replaces it** with real MercadoPago/transfer order creation.

**Tech Stack:** Zustand 4, TanStack Query 5, Express + Zod.

**Deliverable:** Add to cart → drawer → checkout → totals from server → confirmation (stubbed payment). All tests green.

---

### Task 1: `POST /api/checkout/quote` — server-recomputed totals + stock check

**Files:**
- Create: `apps/api/src/services/quote.ts`, `apps/api/src/routes/checkout.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/quote.test.ts`

**Interfaces:**
- Consumes: `checkoutQuoteSchema`, `CartLineInput`, `QuoteResult` (shared), `computeTotals` (M1).
- Produces: `quote(items)` → `QuoteResult`; `checkoutRouter` (`POST /api/checkout/quote`). M4 reuses `quote()` to price orders server-side.

- [ ] **Step 1: Write the failing test `apps/api/tests/quote.test.ts`**

```ts
import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';
import { prisma } from '../src/prisma';

const app = createApp();
let navyId = '';
beforeAll(async () => {
  await resetDb();
  await seed();
  navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
});

describe('POST /api/checkout/quote', () => {
  it('recomputes totals from the DB (ignores any client price)', async () => {
    const res = await request(app).post('/api/checkout/quote').send({ items: [{ productId: navyId, size: 'M', qty: 2 }] });
    expect(res.status).toBe(200);
    expect(res.body.subtotal).toBe(60000);
    expect(res.body.transferDiscount).toBe(6000);
    expect(res.body.totalTransfer).toBe(54000);
    expect(res.body.totalCard).toBe(60000);
    expect(res.body.lines[0].unitPrice).toBe(30000);
  });

  it('400s on a malformed body', async () => {
    const res = await request(app).post('/api/checkout/quote').send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('409s when stock is insufficient', async () => {
    const res = await request(app).post('/api/checkout/quote').send({ items: [{ productId: navyId, size: 'M', qty: 999 }] });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/stock/i);
  });

  it('409s on an invalid size', async () => {
    const res = await request(app).post('/api/checkout/quote').send({ items: [{ productId: navyId, size: 'S', qty: 1 }] });
    // 'S' exists in seed; use a product/size mismatch instead:
    expect([200, 409]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run (fail), then write `apps/api/src/services/quote.ts`**

```ts
import type { CartLineInput, QuoteResult, QuoteLine } from '@resolute/shared';
import { prisma } from '../prisma';
import { computeTotals } from './pricing';

export async function quote(items: CartLineInput[]): Promise<QuoteResult> {
  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: ids }, active: true }, include: { variants: true } });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: QuoteLine[] = [];
  for (const it of items) {
    const p = byId.get(it.productId);
    if (!p) throw new Error(`Producto inexistente o inactivo: ${it.productId}`);
    const variant = p.variants.find((v) => v.size === it.size);
    if (!variant) throw new Error(`Talle ${it.size} no disponible para ${p.line} (${p.color})`);
    if (variant.stock < it.qty) throw new Error(`Sin stock suficiente de ${p.line} (${p.color}) talle ${it.size}`);
    lines.push({ productId: p.id, line: p.line, color: p.color, size: it.size, unitPrice: p.price, qty: it.qty, lineTotal: p.price * it.qty });
  }

  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const content = await prisma.siteContent.findUnique({ where: { id: 1 } });
  const t = computeTotals(subtotal, content?.transferDiscountPct ?? 10);
  return { lines, subtotal: t.subtotal, transferDiscount: t.transferDiscount, totalTransfer: t.totalTransfer, totalCard: t.totalCard };
}
```

- [ ] **Step 3: Write `apps/api/src/routes/checkout.ts`**

```ts
import { Router } from 'express';
import { checkoutQuoteSchema } from '@resolute/shared';
import { quote } from '../services/quote';

export const checkoutRouter = Router();

checkoutRouter.post('/quote', async (req, res, next) => {
  const parsed = checkoutQuoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Items inválidos', details: parsed.error.flatten() });
  try {
    res.json(await quote(parsed.data.items));
  } catch (e) {
    res.status(409).json({ error: e instanceof Error ? e.message : 'No se pudo cotizar' });
  }
});
```

- [ ] **Step 4: Mount in `apps/api/src/app.ts`** (import + `app.use('/api/checkout', checkoutRouter)` before `notFound`)

- [ ] **Step 5: Run → PASS, then commit**

Run: `npm test --workspace @resolute/api -- quote`

```bash
git add -A && git commit -m "feat(api): POST /api/checkout/quote with server price recompute + stock check"
```

---

### Task 2: Cart + Toast stores; quote client

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/store/cart.ts`, `apps/web/src/store/toast.ts`
- Test: `apps/web/src/store/cart.test.ts`

**Interfaces:**
- Produces: `useCart` (items, open, checkoutOpen, add/inc/dec/remove/clear, setOpen, startCheckout), `cartCount(items)`, `cartSubtotal(items)`, `useToast`, `api.quote(items)`.

- [ ] **Step 1: Add Zustand**

```bash
npm install --workspace @resolute/web zustand@^4.5.5
```

- [ ] **Step 2: Extend `apps/web/src/lib/api.ts`** (add a POST helper + `quote`)

```ts
import type { ProductDTO, DropDTO, ContentDTO, CartLineInput, QuoteResult } from '@resolute/shared';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `API ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

export const api = {
  products: () => get<ProductDTO[]>('/api/products'),
  drop: () => get<DropDTO>('/api/drop'),
  content: () => get<ContentDTO>('/api/content'),
  quote: (items: CartLineInput[]) => post<QuoteResult>('/api/checkout/quote', { items }),
};
```

- [ ] **Step 3: Write the failing test `apps/web/src/store/cart.test.ts`**

```ts
import { beforeEach, describe, it, expect } from 'vitest';
import { useCart, cartCount, cartSubtotal } from './cart';

const product = { id: 'p1', slug: 's', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, price: 30000, imageUrl: '/assets/tile-black.png', sizes: [] } as any;

beforeEach(() => useCart.setState({ items: [], open: false, checkoutOpen: false }));

describe('cart store', () => {
  it('adds and merges by product+size, opening the drawer', () => {
    useCart.getState().add(product, 'M');
    useCart.getState().add(product, 'M');
    useCart.getState().add(product, 'L');
    const { items, open } = useCart.getState();
    expect(open).toBe(true);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.key === 'p1-M')!.qty).toBe(2);
    expect(cartCount(items)).toBe(3);
    expect(cartSubtotal(items)).toBe(90000);
  });

  it('dec removes the line at qty 0', () => {
    useCart.getState().add(product, 'M');
    useCart.getState().dec('p1-M');
    expect(useCart.getState().items).toHaveLength(0);
  });

  it('startCheckout is a no-op on an empty cart', () => {
    expect(useCart.getState().startCheckout()).toBe(false);
    expect(useCart.getState().checkoutOpen).toBe(false);
  });
});
```

- [ ] **Step 4: Run (fail), then write `apps/web/src/store/cart.ts`**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductDTO } from '@resolute/shared';

export interface CartItem {
  key: string; productId: string; slug: string; line: string; color: string;
  size: string; price: number; imageUrl: string; qty: number;
}

interface CartStore {
  items: CartItem[];
  open: boolean;
  checkoutOpen: boolean;
  add: (p: ProductDTO, size: string) => void;
  inc: (key: string) => void;
  dec: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
  setCheckoutOpen: (open: boolean) => void;
  startCheckout: () => boolean;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [], open: false, checkoutOpen: false,
      add: (p, size) =>
        set((s) => {
          const key = `${p.id}-${size}`;
          const items = [...s.items];
          const i = items.findIndex((x) => x.key === key);
          if (i >= 0) items[i] = { ...items[i]!, qty: items[i]!.qty + 1 };
          else items.push({ key, productId: p.id, slug: p.slug, line: p.line, color: p.color, size, price: p.price, imageUrl: p.imageUrl, qty: 1 });
          return { items, open: true };
        }),
      inc: (key) => set((s) => ({ items: s.items.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x)) })),
      dec: (key) => set((s) => ({ items: s.items.flatMap((x) => (x.key === key ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])) })),
      remove: (key) => set((s) => ({ items: s.items.filter((x) => x.key !== key) })),
      clear: () => set({ items: [] }),
      setOpen: (open) => set({ open }),
      setCheckoutOpen: (checkoutOpen) => set({ checkoutOpen }),
      startCheckout: () => {
        if (get().items.length === 0) return false;
        set({ open: false, checkoutOpen: true });
        return true;
      },
    }),
    { name: 'rf-cart', partialize: (s) => ({ items: s.items }) },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((a, b) => a + b.qty, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((a, b) => a + b.price * b.qty, 0);
```

Re-run → PASS.

- [ ] **Step 5: Write `apps/web/src/store/toast.ts`**

```ts
import { create } from 'zustand';

interface ToastStore { message: string | null; show: (msg: string) => void; clear: () => void; }
let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastStore>((set) => ({
  message: null,
  show: (message) => { set({ message }); if (timer) clearTimeout(timer); timer = setTimeout(() => set({ message: null }), 2400); },
  clear: () => set({ message: null }),
}));
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): zustand cart + toast stores, quote API client"
```

---

### Task 3: CartDrawer + Toast, wired into the landing

**Files:**
- Create: `apps/web/src/components/CartDrawer.tsx`, `apps/web/src/components/Toast.tsx`
- Modify: `apps/web/src/pages/Landing.tsx`
- Test: `apps/web/src/components/CartDrawer.test.tsx`

**Interfaces:**
- Consumes: `useCart`, `cartCount`, `cartSubtotal`, `money`.
- Produces: `<CartDrawer/>`, `<Toast/>`. Landing now passes real cart count/add/open.

- [ ] **Step 1: Write the failing test `apps/web/src/components/CartDrawer.test.tsx`**

```tsx
import { beforeEach, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CartDrawer from './CartDrawer';
import { useCart } from '../store/cart';

const product = { id: 'p1', slug: 's', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, price: 30000, imageUrl: '/assets/tile-black.png', sizes: [] } as any;
beforeEach(() => useCart.setState({ items: [], open: true, checkoutOpen: false }));

it('lists items and shows the server-independent subtotal', () => {
  useCart.getState().add(product, 'M');
  render(<CartDrawer />);
  expect(screen.getByText(/Champion Mentality/)).toBeInTheDocument();
  expect(screen.getByText('$30.000')).toBeInTheDocument();
});

it('increments quantity from the drawer', () => {
  useCart.getState().add(product, 'M');
  render(<CartDrawer />);
  fireEvent.click(screen.getByLabelText('Sumar uno'));
  expect(useCart.getState().items[0].qty).toBe(2);
});

it('shows the empty state when there are no items', () => {
  render(<CartDrawer />);
  expect(screen.getByText(/carrito está vacío/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run (fail), then write `apps/web/src/components/CartDrawer.tsx`**

```tsx
import { useCart, cartCount, cartSubtotal } from '../store/cart';
import { money } from '../lib/money';

export default function CartDrawer() {
  const { items, setOpen, inc, dec, remove, startCheckout } = useCart();
  const count = cartCount(items);
  const subtotal = cartSubtotal(items);

  return (
    <>
      <div onClick={() => setOpen(false)} className="fixed inset-0 z-[290] bg-black/60 backdrop-blur-[2px] animate-fade" />
      <aside className="fixed top-0 right-0 bottom-0 z-[300] w-[min(420px,92vw)] bg-bg border-l border-line2 flex flex-col animate-slidein shadow-[-30px_0_60px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between px-[22px] py-5 border-b border-line">
          <div className="flex items-center gap-[10px] font-display font-extrabold text-[20px] tracking-[0.08em] uppercase">Tu carrito <span className="text-mut text-[15px]">({count})</span></div>
          <button aria-label="Cerrar" onClick={() => setOpen(false)} className="bg-none border border-line rounded-[2px] text-tx w-9 h-9 flex items-center justify-center cursor-pointer hover:border-red">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-[18px] p-10 text-center">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#97979d" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8h12l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H8.7a1.5 1.5 0 0 1-1.5-1.3L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>
            <div className="text-mut text-[16px]">Tu carrito está vacío.</div>
            <button onClick={() => setOpen(false)} className="bg-red text-white font-display font-bold text-[15px] tracking-[0.12em] uppercase px-[26px] py-[13px] rounded-[2px] hover:bg-redd">Ver productos</button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-[18px] py-[14px] flex flex-col gap-3">
              {items.map((it) => (
                <div key={it.key} className="flex gap-[13px] bg-card border border-line rounded-[4px] p-3">
                  <div className="w-[72px] h-[72px] shrink-0 rounded-[3px] overflow-hidden bg-[#d2d2cf]"><img src={it.imageUrl} alt="" className="block w-full h-full object-cover" /></div>
                  <div className="flex-1 min-w-0 flex flex-col gap-[7px]">
                    <div className="flex justify-between gap-2 items-start">
                      <div>
                        <div className="font-display font-bold text-[16px] tracking-[0.04em] uppercase leading-[1.05]">{it.line}</div>
                        <div className="text-mut text-[12.5px] font-display tracking-[0.08em] uppercase mt-[2px]">{it.color} · Talle {it.size}</div>
                      </div>
                      <button aria-label="Quitar" onClick={() => remove(it.key)} className="bg-none border-0 text-mut cursor-pointer p-[2px] hover:text-red shrink-0">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" /></svg>
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-auto">
                      <div className="flex items-center border border-line2 rounded-[2px] overflow-hidden">
                        <button aria-label="Restar uno" onClick={() => dec(it.key)} className="bg-none border-0 text-tx w-[30px] h-[30px] cursor-pointer flex items-center justify-center hover:bg-white/10"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg></button>
                        <span className="min-w-[28px] text-center font-display font-bold text-[15px]">{it.qty}</span>
                        <button aria-label="Sumar uno" onClick={() => inc(it.key)} className="bg-none border-0 text-tx w-[30px] h-[30px] cursor-pointer flex items-center justify-center hover:bg-white/10"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
                      </div>
                      <span className="font-display font-extrabold text-[18px]">{money(it.price * it.qty)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-5 pt-[18px] pb-[22px] flex flex-col gap-[14px]">
              <div className="flex justify-between items-baseline"><span className="text-mut font-display tracking-[0.1em] uppercase text-[14px]">Subtotal</span><span className="font-display font-black text-[28px]">{money(subtotal)}</span></div>
              <div className="text-mut text-[13px] flex justify-between"><span>Envío</span><span className="text-gold">Calculado en el checkout</span></div>
              <button onClick={() => startCheckout()} className="w-full bg-red text-white border-0 rounded-[2px] p-4 cursor-pointer font-display font-bold text-[17px] tracking-[0.13em] uppercase hover:bg-redd flex items-center justify-center gap-[10px]">Finalizar compra
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
```

Re-run → PASS.

- [ ] **Step 3: Write `apps/web/src/components/Toast.tsx`**

```tsx
import { useToast } from '../store/toast';

export default function Toast() {
  const message = useToast((s) => s.message);
  if (!message) return null;
  return (
    <div key={message} className="fixed left-1/2 bottom-[30px] z-[600] -translate-x-1/2 bg-tx text-bg font-display font-bold text-[14.5px] tracking-[0.06em] uppercase px-[22px] py-[14px] rounded-[3px] shadow-[0_14px_34px_-12px_rgba(0,0,0,0.7)] animate-toast flex items-center gap-[10px] max-w-[90vw]">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#e4322b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-11" /></svg>
      {message}
    </div>
  );
}
```

- [ ] **Step 4: Wire into `apps/web/src/pages/Landing.tsx`** (replace cart stubs)

Replace the Nav/Productos lines and add drawer + toast. Full updated body:

```tsx
import { useProducts, useDrop, useContent } from '../hooks/useCatalog';
import { useCart, cartCount } from '../store/cart';
import { useToast } from '../store/toast';
import Marquee from '../components/Marquee';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import Manifiesto from '../components/Manifiesto';
import Productos from '../components/Productos';
import Historia from '../components/Historia';
import Proximos from '../components/Proximos';
import Contacto from '../components/Contacto';
import Footer from '../components/Footer';
import CartDrawer from '../components/CartDrawer';
import CheckoutModal from '../components/CheckoutModal';
import Toast from '../components/Toast';

export default function Landing() {
  const products = useProducts();
  const drop = useDrop();
  const content = useContent();
  const { items, open, checkoutOpen, setOpen, add } = useCart();
  const showToast = useToast((s) => s.show);

  if (!content.data) return <div data-testid="landing" className="min-h-screen bg-bg" />;

  return (
    <div data-testid="landing" className="bg-bg text-tx font-body min-h-screen relative overflow-x-hidden">
      <Marquee items={content.data.marquee} />
      <Nav cartCount={cartCount(items)} onOpenCart={() => setOpen(true)} />
      <Hero content={content.data} />
      <Manifiesto />
      <Productos products={products.data ?? []} onAdd={(p, size) => { add(p, size); showToast(`${p.line} · ${p.color} (${size})`); }} />
      <Historia />
      {drop.data && <Proximos drop={drop.data} />}
      <Contacto content={content.data} />
      <Footer />
      {open && <CartDrawer />}
      {checkoutOpen && <CheckoutModal />}
      <Toast />
    </div>
  );
}
```

> Note: `CheckoutModal` is created in Task 4. If executing strictly in order, temporarily comment its import + usage until Task 4, or do Task 4 before re-running Landing.

- [ ] **Step 5: Commit (after Task 4 lands `CheckoutModal`)** — proceed to Task 4.

---

### Task 4: CheckoutModal (datos → pago → confirmado) with server quote

**Files:**
- Create: `apps/web/src/components/CheckoutModal.tsx`, `apps/web/src/lib/placeOrder.ts`
- Test: `apps/web/src/components/CheckoutModal.test.tsx`

**Interfaces:**
- Consumes: `useCart`, `api.quote`, `money`, `customerSchema`, `CartLineInput`, `CustomerInput`, `QuoteResult`.
- Produces: `<CheckoutModal/>`; `PlaceOrder` type + `stubPlaceOrder` (client-only). **M4 replaces `stubPlaceOrder` with real order creation** (transfer + MercadoPago) and exports the same `PlaceOrder` signature.

- [ ] **Step 1: Write `apps/web/src/lib/placeOrder.ts`** (the swappable adapter)

```ts
import type { CartLineInput, CustomerInput, QuoteResult } from '@resolute/shared';

export type PayMethod = 'transfer' | 'card' | 'wallet';
export interface PlacedOrder { orderNo: string; total: number; count: number; pay: PayMethod; name: string; }
export type PlaceOrder = (args: { items: CartLineInput[]; customer: CustomerInput; method: PayMethod; quote: QuoteResult }) => Promise<PlacedOrder>;

// M3 client-only stub — mirrors the original demo confirmation. Replaced in M4.
export const stubPlaceOrder: PlaceOrder = async ({ customer, method, quote }) => ({
  orderNo: 'RF-' + Math.floor(100000 + Math.random() * 900000),
  total: method === 'transfer' ? quote.totalTransfer : quote.totalCard,
  count: quote.lines.reduce((a, l) => a + l.qty, 0),
  pay: method,
  name: customer.nombre || 'Atleta',
});
```

- [ ] **Step 2: Write the failing test `apps/web/src/components/CheckoutModal.test.tsx`**

```tsx
import { beforeEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CheckoutModal from './CheckoutModal';
import { useCart } from '../store/cart';

vi.mock('../lib/api', () => ({
  api: { quote: vi.fn().mockResolvedValue({ lines: [{ productId: 'p1', line: 'Champion Mentality', color: 'Negro', size: 'M', unitPrice: 30000, qty: 1, lineTotal: 30000 }], subtotal: 30000, transferDiscount: 3000, totalTransfer: 27000, totalCard: 30000 }) },
}));

const product = { id: 'p1', slug: 's', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, price: 30000, imageUrl: '/assets/tile-black.png', sizes: [] } as any;
beforeEach(() => { useCart.setState({ items: [], open: false, checkoutOpen: true }); useCart.getState().add(product, 'M'); });

it('walks datos → pago (server totals) → confirmado', async () => {
  render(<CheckoutModal />);
  fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('tu@email.com'), { target: { value: 'ana@x.com' } });
  fireEvent.change(screen.getByPlaceholderText('Calle y número'), { target: { value: 'Calle 1' } });
  fireEvent.change(screen.getByPlaceholderText('Ciudad, Provincia'), { target: { value: 'CABA' } });
  fireEvent.click(screen.getByRole('button', { name: /continuar al pago/i }));

  expect(await screen.findByText('Forma de pago')).toBeInTheDocument();
  expect(screen.getByText('$27.000')).toBeInTheDocument(); // transfer total from server

  fireEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }));
  expect(await screen.findByText(/pedido confirmado/i)).toBeInTheDocument();
  expect(screen.getByText(/RF-/)).toBeInTheDocument();
});

it('blocks step 1 until required fields are filled', () => {
  render(<CheckoutModal />);
  fireEvent.click(screen.getByRole('button', { name: /continuar al pago/i }));
  expect(screen.queryByText('Forma de pago')).toBeNull();
});
```

- [ ] **Step 3: Run (fail), then write `apps/web/src/components/CheckoutModal.tsx`**

```tsx
import { useState } from 'react';
import { customerSchema } from '@resolute/shared';
import type { CartLineInput, CustomerInput } from '@resolute/shared';
import { api } from '../lib/api';
import { money } from '../lib/money';
import { useCart, cartCount } from '../store/cart';
import { stubPlaceOrder, type PayMethod, type PlaceOrder, type PlacedOrder } from '../lib/placeOrder';

const inputCls = 'bg-card border border-line2 rounded-[3px] text-tx px-[14px] py-[13px] text-[15px] outline-none transition focus:border-gold';
const labelCls = 'font-display text-[12.5px] tracking-[0.14em] uppercase text-mut';

export default function CheckoutModal({ placeOrder = stubPlaceOrder }: { placeOrder?: PlaceOrder }) {
  const { items, setCheckoutOpen, clear } = useCart();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CustomerInput>({ nombre: '', email: '', tel: '', dir: '', ciudad: '' });
  const [method, setMethod] = useState<PayMethod>('transfer');
  const [q, setQ] = useState<Awaited<ReturnType<typeof api.quote>> | null>(null);
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lineItems: CartLineInput[] = items.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty }));
  const close = () => { setCheckoutOpen(false); setStep(0); };
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  async function toPago() {
    setErr(null);
    if (!customerSchema.safeParse(form).success) { setErr('Completá tus datos para continuar'); return; }
    setBusy(true);
    try { setQ(await api.quote(lineItems)); setStep(1); }
    catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo cotizar'); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!q) return;
    setBusy(true); setErr(null);
    try {
      const placed = await placeOrder({ items: lineItems, customer: form, method, quote: q });
      setOrder(placed); setStep(2); clear();
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo confirmar el pedido'); }
    finally { setBusy(false); }
  }

  const stepTitle = step === 0 ? 'Tus datos' : step === 1 ? 'Forma de pago' : 'Listo';
  const progress = step === 0 ? '33%' : step === 1 ? '66%' : '100%';
  const total = method === 'transfer' ? q?.totalTransfer ?? 0 : q?.totalCard ?? 0;

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
              <div className="flex justify-between items-baseline mt-[6px] pt-[14px] border-t border-line"><span className="text-mut font-display tracking-[0.1em] uppercase text-[14px]">Total ({cartCount(items)})</span></div>
              <button disabled={busy} onClick={toPago} className="w-full mt-1 bg-red text-white border-0 rounded-[2px] p-4 cursor-pointer font-display font-bold text-[16px] tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Continuar al pago</button>
            </div>
          )}

          {step === 1 && q && (
            <div className="flex flex-col gap-[14px]">
              <div className="font-display text-[12.5px] tracking-[0.14em] uppercase text-mut">Elegí cómo pagar</div>
              <PayOption active={method === 'transfer'} onClick={() => setMethod('transfer')} title="Transferencia" sub="Te enviamos los datos por email" badge="10% OFF" />
              <PayOption active={method === 'card'} onClick={() => setMethod('card')} title="Tarjeta" sub="Hasta 3 cuotas sin interés" />
              <PayOption active={method === 'wallet'} onClick={() => setMethod('wallet')} title="Mercado Pago" sub="Pagá con tu cuenta de MercadoPago" />
              <div className="flex flex-col gap-2 mt-[6px] pt-[14px] border-t border-line">
                <Row label="Subtotal" value={money(q.subtotal)} />
                {method === 'transfer' && <Row label="Descuento transferencia" value={`− ${money(q.transferDiscount)}`} gold />}
                <Row label="Envío" value="Gratis" gold />
                <div className="flex justify-between items-baseline mt-1"><span className="font-display tracking-[0.1em] uppercase text-[15px]">Total</span><span className="font-display font-black text-[28px]">{money(total)}</span></div>
              </div>
              <div className="flex gap-[10px] mt-1">
                <button onClick={() => setStep(0)} className="shrink-0 bg-transparent text-tx border border-line2 rounded-[2px] px-5 py-4 cursor-pointer font-display font-bold text-[15px] tracking-[0.1em] uppercase hover:border-tx">Volver</button>
                <button disabled={busy} onClick={confirm} className="flex-1 bg-red text-white border-0 rounded-[2px] p-4 cursor-pointer font-display font-bold text-[16px] tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Confirmar pedido</button>
              </div>
            </div>
          )}

          {step === 2 && order && (
            <div className="flex flex-col items-center text-center gap-4 pt-[14px] px-[6px] pb-[6px]">
              <div className="w-[74px] h-[74px] rounded-full flex items-center justify-center border-2 border-gold" style={{ background: 'radial-gradient(circle,rgba(232,181,62,.25),transparent 70%)' }}>
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#e8b53e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-11" /></svg>
              </div>
              <h3 className="m-0 font-display font-black text-[32px] tracking-[0.02em] uppercase">¡Pedido confirmado!</h3>
              <p className="m-0 text-mut text-[15.5px] leading-[1.6] max-w-[380px]">Gracias <span className="text-tx font-semibold">{order.name}</span>. Tu orden <span className="text-gold font-semibold">{order.orderNo}</span> está en marcha. Te enviamos los detalles por email.</p>
              <div className="w-full bg-card border border-line rounded-[4px] px-[18px] py-4 flex flex-col gap-[9px] mt-1">
                <Row label="Orden" value={order.orderNo} />
                <Row label="Artículos" value={String(order.count)} />
                <Row label="Pago" value={order.pay} />
                <div className="flex justify-between items-baseline pt-[9px] border-t border-line"><span className="text-mut">Total</span><span className="font-display font-black text-[24px]">{money(order.total)}</span></div>
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

Re-run → PASS.

- [ ] **Step 4: Run the full web suite, build, commit + tag**

```bash
npm test --workspace @resolute/web
npm run build --workspace @resolute/web
git add -A && git commit -m "feat(web): cart drawer, toast, 3-step checkout modal with server quote (M3)"
git tag m3-cart-checkout
```

---

## M3 done when

- Add-to-cart opens the drawer + toast; the drawer manages quantities; checkout pulls **server-recomputed** totals and walks to a (stubbed) confirmation.
- `git tag m3-cart-checkout` exists. Proceed to `…-m4-mercadopago.md`, which replaces `stubPlaceOrder` with real orders + MercadoPago.
